import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { hashPassword, verifyPassword, meetsPasswordPolicy } from "./utils/password.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./utils/ticketNumber.js";
import { Prisma, TicketStatus, Priority } from "@prisma/client";
import {
  requireAuth,
  requirePasswordChanged,
  issueSessionCookie,
  clearSessionCookie,
} from "./auth.js";

// Lab 3 introduced TicketStatus/Priority as native Prisma enums (uppercase,
// underscore-separated). The Lab 2 client still sends legacy casing
// ("New", "In Progress", "High") until it is reworked in I-4; these
// normalizers keep both old and new client requests working against the
// new enum columns without changing observable Lab 2 behavior.
function normalizeStatus(value: string): TicketStatus | undefined {
  const key = value.trim().toUpperCase().replace(/\s+/g, "_");
  return (Object.values(TicketStatus) as string[]).includes(key) ? (key as TicketStatus) : undefined;
}
function normalizePriority(value: string): Priority | undefined {
  const key = value.trim().toUpperCase();
  return (Object.values(Priority) as string[]).includes(key) ? (key as Priority) : undefined;
}

// Reverse mapping back to the exact casing Lab 2 established, for the 4
// status/priority values that already existed pre-Lab-3. The 4 new
// statuses (OPEN, WAITING_FOR_REQUESTER, REOPENED, CANCELLED) have no
// legacy equivalent and pass through unchanged — no Lab 2 contract ever
// covered them, and this Requester-facing endpoint is fully reworked in I-4.
const LEGACY_STATUS: Partial<Record<TicketStatus, string>> = {
  NEW: "New",
  IN_PROGRESS: "In_Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};
const LEGACY_PRIORITY: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

// The Prisma field is `requestedPriority` (Lab 3), but the Lab 2 client and
// its existing tests still read `priority` (Title-Case) and `status`
// (Title-Case/underscore) from API responses. This keeps the wire contract
// unchanged until I-4 reworks the client/tests together; I-2's scope is
// the data model only.
function serializeTicket<T extends { requestedPriority: Priority; status: TicketStatus }>(
  ticket: T
): Omit<T, "requestedPriority" | "status"> & { priority: string; status: string } {
  const { requestedPriority, status, ...rest } = ticket;
  return {
    ...rest,
    priority: LEGACY_PRIORITY[requestedPriority],
    status: LEGACY_STATUS[status] ?? status,
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  },
});

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Permitted types: JPG, PNG, WEBP, PDF.`
      )
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5, // Max 5 attachments
  },
  fileFilter,
});

export const app = express();

// credentials: true is required for the httpOnly session cookie (D-01) to
// be sent/received cross-origin; wildcard "*" origin is not permitted by
// browsers when credentials are enabled, so the client origin is read from
// an env var with a sane local-dev default.
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(uploadsDir));

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Welcome to TokTickIT API",
    frontend: "http://localhost:5173",
    endpoints: {
      health: "/api/health",
      categories: "/api/categories",
      systems: "/api/systems",
      devRequesters: "/api/dev/requesters",
      tickets: "/api/tickets",
    },
  });
});

// ---------------------------------------------------------------------------
// Lab 1 & 2 Core Endpoints
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Lab 3 — Authentication (I-3)
// ---------------------------------------------------------------------------

// BR-06: an invalid email/password combination always returns this exact
// generic message, whether or not the email exists — never leak which
// field was wrong or whether the account exists.
const INVALID_CREDENTIALS_RESPONSE = {
  error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
};

function safeUser(user: { id: number; name: string; email: string; role: string; department: string; mustChangePassword: boolean }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    mustChangePassword: user.mustChangePassword,
  };
}

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email and password are required." } });
    }

    // BR-01, BR-06: email comparison is case-insensitive; a non-existent
    // email and a wrong password produce the identical response.
    const user = await getPrisma().user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
    });
    if (!user) {
      return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);
    }

    const passwordMatches = verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);
    }

    // BR-07: only reveal deactivation *after* the password has already
    // proven the account exists — never before, and never for a wrong
    // password against an inactive account (that case still returns the
    // generic 401 above, indistinguishable from a wrong password on an
    // active account).
    if (!user.isActive) {
      return res.status(403).json({ error: { code: "ACCOUNT_INACTIVE", message: "This account has been deactivated." } });
    }

    await getPrisma().user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    issueSessionCookie(res, user.id);
    return res.status(200).json({ user: safeUser(user) });
  } catch (err) {
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unable to log in right now." } });
  }
});

// BR-08: idempotent — clearing an already-cleared/absent cookie still
// succeeds. requireAuth is deliberately NOT applied here: logging out
// while already logged out (or with an expired token) must not itself
// require a valid session.
app.post("/api/auth/logout", (_req: Request, res: Response) => {
  clearSessionCookie(res);
  return res.status(204).send();
});

app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
  // req.authUser is guaranteed by requireAuth; requirePasswordChanged is
  // deliberately not applied to this route (it's on the allowlist) so the
  // client can always learn its own mustChangePassword state.
  return res.status(200).json({ user: req.authUser });
});

app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "All password fields are required." } });
    }

    // BR-09: at least 8 characters, at least one letter and one digit.
    const meetsPolicy = newPassword.length >= 8 && /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword);
    if (!meetsPolicy) {
      return res.status(400).json({
        error: { code: "WEAK_PASSWORD", message: "Password must be at least 8 characters and include a letter and a digit." },
      });
    }
    // BR-11: confirmation must match exactly.
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: { code: "PASSWORD_MISMATCH", message: "New password and confirmation do not match." } });
    }

    const user = await getPrisma().user.findUnique({ where: { id: req.authUser!.id } });
    if (!user) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Login required." } });
    }

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: { code: "INVALID_CURRENT_PASSWORD", message: "Current password is incorrect." } });
    }
    // BR-10: on a forced change, the new password must differ from the
    // initial one (a user cannot "change" their password to itself and
    // remain stuck in the mustChangePassword state).
    if (verifyPassword(newPassword, user.passwordHash)) {
      return res.status(400).json({ error: { code: "PASSWORD_UNCHANGED", message: "New password must be different from your current password." } });
    }

    const newHash = hashPassword(newPassword);
    const updated = await getPrisma().user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    return res.status(200).json({ user: safeUser(updated) });
  } catch (err) {
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unable to change password right now." } });
  }
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

app.get("/api/systems", async (_req: Request, res: Response) => {
  try {
    const systems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true, description: true },
    });
    res.json(systems);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch systems" });
  }
});

app.get("/api/dev/requesters", async (_req: Request, res: Response) => {
  try {
    const activeRequesters = await getPrisma().user.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.status(200).json(activeRequesters);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch development requesters" });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 — Issue 5: My Tickets Search, Filter, Sort, and Pagination (GET /api/tickets)
// ---------------------------------------------------------------------------
app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const { requesterId, search, status, categoryId, priority, sort, page, limit } =
      req.query;

    if (!requesterId) {
      return res.status(400).json({ error: "requesterId query parameter is required" });
    }

    const parsedRequesterId = parseInt(String(requesterId), 10);
    if (isNaN(parsedRequesterId)) {
      return res.status(400).json({ error: "requesterId must be a valid integer" });
    }

    const where: Prisma.TicketWhereInput = {
      requesterId: parsedRequesterId,
    };

    if (status && status !== "All") {
      const normalized = normalizeStatus(String(status));
      if (normalized) where.status = normalized;
    }

    if (categoryId && categoryId !== "All") {
      const parsedCatId = parseInt(String(categoryId), 10);
      if (!isNaN(parsedCatId)) {
        where.categoryId = parsedCatId;
      }
    }

    if (priority && priority !== "All") {
      const normalized = normalizePriority(String(priority));
      if (normalized) where.requestedPriority = normalized;
    }

    if (search && typeof search === "string" && search.trim().length > 0) {
      const query = search.trim();
      where.OR = [
        { ticketNumber: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
      ];
    }

    let orderBy: Prisma.TicketOrderByWithRelationInput = { createdAt: "desc" };
    if (sort && typeof sort === "string") {
      const [field, direction] = sort.split(":");
      const dir: Prisma.SortOrder = direction === "asc" ? "asc" : "desc";
      if (field === "createdAt" || field === "updatedAt" || field === "status") {
        orderBy = { [field]: dir };
      } else if (field === "priority") {
        // Client-facing sort key stays "priority"; the underlying Prisma
        // field is "requestedPriority" (D-09).
        orderBy = { requestedPriority: dir };
      }
    }

    const pageNum = Math.max(1, parseInt(String(page || 1), 10) || 1);
    const take = Math.min(50, Math.max(1, parseInt(String(limit || 10), 10) || 10));
    const skip = (pageNum - 1) * take;

    const [totalItems, tickets] = await Promise.all([
      getPrisma().ticket.count({ where }),
      getPrisma().ticket.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          category: true,
          relatedSystem: true,
          requester: true,
          attachments: {
            where: { isRemoved: false },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / take) || 1;

    return res.status(200).json({
      tickets: tickets.map(serializeTicket),
      pagination: {
        page: pageNum,
        limit: take,
        totalItems,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    console.error("Fetch tickets error:", err);
    return res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 — Issue 6: Ticket Detail, Attachment Lifecycle, and Edit Mode
// ---------------------------------------------------------------------------
app.get("/api/tickets/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ticket ID" });
    }

    const ticket = await getPrisma().ticket.findUnique({
      where: { id },
      include: {
        category: true,
        relatedSystem: true,
        requester: true,
        attachments: {
          where: { isRemoved: false },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const requesterId = req.query.requesterId ? parseInt(String(req.query.requesterId), 10) : undefined;
    if (requesterId !== undefined && !isNaN(requesterId) && ticket.requesterId !== requesterId) {
      return res.status(403).json({
        error: "Forbidden: You do not have permission to view this ticket.",
        code: "FORBIDDEN_TICKET_ACCESS",
        ticketId: id,
        requestedBy: requesterId,
      });
    }

    const removedAttachments = await getPrisma().attachment.findMany({
      where: { ticketId: id, isRemoved: true },
      orderBy: { id: "asc" },
    });

    return res.status(200).json({ ...serializeTicket(ticket), removedAttachments });
  } catch (err) {
    console.error("Get ticket detail error:", err);
    return res.status(500).json({ error: "Failed to fetch ticket detail" });
  }
});

app.patch("/api/tickets/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ticket ID" });
    }

    const { summary, description, priority, categoryId, relatedSystemId } = req.body;

    const dataToUpdate: Prisma.TicketUpdateInput = {};

    if (summary !== undefined) {
      if (typeof summary !== "string" || summary.trim().length < 3 || summary.trim().length > 200) {
        return res.status(400).json({ error: "Summary must be between 3 and 200 characters" });
      }
      dataToUpdate.summary = summary.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string" || description.trim().length < 5 || description.trim().length > 10000) {
        return res.status(400).json({ error: "Description must be between 5 and 10,000 characters" });
      }
      dataToUpdate.description = description.trim();
    }

    if (priority !== undefined) {
      const normalized = normalizePriority(String(priority));
      if (!normalized) {
        return res.status(400).json({ error: "Invalid priority value" });
      }
      dataToUpdate.requestedPriority = normalized;
    }

    if (categoryId !== undefined) {
      const parsedCatId = parseInt(String(categoryId), 10);
      if (isNaN(parsedCatId)) {
        return res.status(400).json({ error: "Invalid category ID" });
      }
      dataToUpdate.category = { connect: { id: parsedCatId } };
    }

    if (relatedSystemId !== undefined) {
      if (relatedSystemId === null || relatedSystemId === "") {
        dataToUpdate.relatedSystem = { disconnect: true };
      } else {
        const parsedSysId = parseInt(String(relatedSystemId), 10);
        if (!isNaN(parsedSysId)) {
          dataToUpdate.relatedSystem = { connect: { id: parsedSysId } };
        }
      }
    }

    const updatedTicket = await getPrisma().ticket.update({
      where: { id },
      data: dataToUpdate,
      include: {
        category: true,
        relatedSystem: true,
        requester: true,
        attachments: {
          where: { isRemoved: false },
        },
      },
    });

    return res.status(200).json(serializeTicket(updatedTicket));
  } catch (err) {
    console.error("Update ticket error:", err);
    return res.status(500).json({ error: "Failed to update ticket" });
  }
});

// Add attachment to existing ticket
app.post(
  "/api/tickets/:id/attachments",
  upload.array("attachments", 5),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ticket ID" });
      }

      const ticket = await getPrisma().ticket.findUnique({
        where: { id },
        include: { attachments: { where: { isRemoved: false } } },
      });

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      if (ticket.attachments.length + files.length > 5) {
        return res
          .status(400)
          .json({ error: "Maximum 5 active attachments allowed per ticket." });
      }

      const createdAttachments = await Promise.all(
        files.map((file) =>
          getPrisma().attachment.create({
            data: {
              ticketId: id,
              fileName: file.originalname,
              fileUrl: `/uploads/${file.filename}`,
              fileSize: file.size,
              mimeType: file.mimetype,
              isRemoved: false,
            },
          })
        )
      );

      return res.status(201).json(createdAttachments);
    } catch (err) {
      console.error("Upload attachment error:", err);
      return res.status(500).json({ error: "Failed to upload attachments" });
    }
  }
);

// Soft-remove attachment
app.delete(
  "/api/tickets/:id/attachments/:attachmentId",
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const attachmentId = parseInt(req.params.attachmentId, 10);
      const reason = req.body?.reason || "Removed by user";

      if (isNaN(id) || isNaN(attachmentId)) {
        return res.status(400).json({ error: "Invalid parameters" });
      }

      const attachment = await getPrisma().attachment.findFirst({
        where: { id: attachmentId, ticketId: id },
      });

      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      const updated = await getPrisma().attachment.update({
        where: { id: attachmentId },
        data: {
          isRemoved: true,
          removedReason: reason,
          removedAt: new Date(),
        },
      });

      return res.status(200).json({
        message: "Attachment soft-removed successfully",
        attachment: updated,
      });
    } catch (err) {
      console.error("Delete attachment error:", err);
      return res.status(500).json({ error: "Failed to remove attachment" });
    }
  }
);

// ---------------------------------------------------------------------------
// Lab 2 — Issue 4: Create Ticket API (POST /api/tickets)
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets",
  upload.array("attachments", 5),
  async (req: Request, res: Response) => {
    try {
      const { summary, description, priority, categoryId, relatedSystemId, requesterId } =
        req.body;

      const errors: { field: string; message: string }[] = [];

      if (!summary || typeof summary !== "string" || summary.trim().length < 3 || summary.trim().length > 200) {
        errors.push({
          field: "summary",
          message: "Summary is required and must be between 3 and 200 characters.",
        });
      }

      if (!description || typeof description !== "string" || description.trim().length < 5 || description.trim().length > 10000) {
        errors.push({
          field: "description",
          message: "Description is required and must be between 5 and 10,000 characters.",
        });
      }

      const parsedCategoryId = parseInt(categoryId, 10);
      if (isNaN(parsedCategoryId)) {
        errors.push({
          field: "categoryId",
          message: "A valid category must be selected.",
        });
      }

      const parsedRequesterId = parseInt(requesterId, 10);
      if (isNaN(parsedRequesterId)) {
        errors.push({
          field: "requesterId",
          message: "A valid requester ID is required.",
        });
      }

      if (errors.length > 0) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors,
        });
      }

      const category = await getPrisma().category.findUnique({
        where: { id: parsedCategoryId },
      });
      if (!category) {
        return res.status(400).json({
          error: "Invalid category",
          details: [{ field: "categoryId", message: "Category does not exist." }],
        });
      }

      const requester = await getPrisma().user.findUnique({
        where: { id: parsedRequesterId },
      });
      if (!requester || !requester.isActive) {
        return res.status(400).json({
          error: "Invalid requester",
          details: [{ field: "requesterId", message: "Requester is not active or does not exist." }],
        });
      }

      const parsedSystemId = relatedSystemId ? parseInt(relatedSystemId, 10) : null;
      const validPriority = normalizePriority(String(priority)) ?? Priority.MEDIUM;

      const ticketNumber = generateTicketNumber();

      const files = (req.files as Express.Multer.File[]) || [];
      const attachmentsData = files.map((file) => ({
        fileName: file.originalname,
        fileUrl: `/uploads/${file.filename}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        isRemoved: false,
      }));

      const newTicket = await getPrisma().ticket.create({
        data: {
          ticketNumber,
          summary: summary.trim(),
          description: description.trim(),
          requestedPriority: validPriority,
          status: TicketStatus.NEW,
          categoryId: parsedCategoryId,
          relatedSystemId: parsedSystemId && !isNaN(parsedSystemId) ? parsedSystemId : null,
          requesterId: parsedRequesterId,
          attachments: {
            create: attachmentsData,
          },
        },
        include: {
          category: true,
          relatedSystem: true,
          requester: true,
          attachments: true,
        },
      });

      return res.status(201).json(serializeTicket(newTicket));
    } catch (err) {
      console.error("Create ticket error:", err);
      return res.status(500).json({ error: "Failed to create ticket" });
    }
  }
);

// Global Error Handler for Multer upload errors
app.use(
  (
    err: Error | multer.MulterError,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "File too large. Maximum permitted file size is 5MB." });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res
          .status(400)
          .json({ error: "Too many files. Maximum 5 attachments allowed." });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
  }
);

export default app;
