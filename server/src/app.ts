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
import { Prisma, TicketStatus, Priority, Role } from "@prisma/client";
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

// BR-05, D-10: statuses where "Problem Appears Resolved" no longer applies.
// Single source of truth, referenced both by the resolution-signal route's
// own 409 check and by serializeTicket's canSignalResolution flag below.
// Fixed in review (PR #66): the client previously duplicated this list
// independently (with dead entries, since two of the four raw enum values
// can never actually reach it — see LEGACY_STATUS above), so a future
// change here would silently stop matching the client's copy. The client
// now reads canSignalResolution directly instead of recomputing it.
const RESOLUTION_SIGNAL_BLOCKED_STATUSES: TicketStatus[] = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.CANCELLED,
];

// The Prisma field is `requestedPriority` (Lab 3), but the Lab 2 client and
// its existing tests still read `priority` (Title-Case) and `status`
// (Title-Case/underscore) from API responses. This keeps the wire contract
// unchanged until I-4 reworks the client/tests together; I-2's scope is
// the data model only.
function serializeTicket<T extends { requestedPriority: Priority; status: TicketStatus; requesterResolvedAt?: Date | null }>(
  ticket: T
): Omit<T, "requestedPriority" | "status"> & { priority: string; status: string; canSignalResolution: boolean } {
  const { requestedPriority, status, ...rest } = ticket;
  return {
    ...rest,
    priority: LEGACY_PRIORITY[requestedPriority],
    status: LEGACY_STATUS[status] ?? status,
    canSignalResolution: !RESOLUTION_SIGNAL_BLOCKED_STATUSES.includes(status) && !ticket.requesterResolvedAt,
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
// Deliberately NOT mounting express.static(uploadsDir) at a public path.
// Fixed in review: an unauthenticated static mount here would let anyone
// who has ever seen a fileUrl (network tab, cache, shared link) fetch it
// directly with no ownership check and no 410 for removed attachments —
// exactly the gap GET /api/tickets/:id/attachments/:attachmentId/download
// exists to close. Attachments are served exclusively through that
// authenticated, ownership-checked route.

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Welcome to TokTickIT API",
    frontend: "http://localhost:5173",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth/login",
      categories: "/api/categories",
      systems: "/api/systems",
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

// Note: GET /api/dev/requesters (the Development Requester selector) is
// removed in I-4 — real authentication replaces it entirely (per the
// handout §8.2 and specification.md scope). Its test file is removed
// alongside it.

app.get("/api/categories", requireAuth, requirePasswordChanged, async (_req: Request, res: Response) => {
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

app.get("/api/systems", requireAuth, requirePasswordChanged, async (_req: Request, res: Response) => {
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

// ---------------------------------------------------------------------------
// Lab 2 — Issue 5: My Tickets Search, Filter, Sort, and Pagination (GET /api/tickets)
// Lab 3 (I-4): ownership comes from the authenticated session (BR-03), never
// from a client-supplied requesterId.
// ---------------------------------------------------------------------------
app.get("/api/tickets", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  try {
    const { search, status, categoryId, priority, sort, page, limit } = req.query;

    const where: Prisma.TicketWhereInput = {
      requesterId: req.authUser!.id,
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
// Strict integer parsing for route params. Fixed in review (PR #66):
// parseInt("5abc", 10) === 5, silently accepting trailing garbage instead
// of rejecting a malformed ID. Applied to every :id/:attachmentId param in
// this file, not just the new I-5 routes the review was looking at.
function parseStrictId(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  const id = parseInt(raw, 10);
  return Number.isSafeInteger(id) ? id : null;
}

// BR-32: a Requester requesting another Requester's Ticket gets 404, not
// 403 — the response must not confirm the Ticket exists at all. This is a
// deliberate exception to using 403 for authorization failures elsewhere.
//
// This is the SINGLE canonical implementation of that 404-masking response
// for every Ticket-scoped route below (fixed in review of PR #66, which
// had reintroduced a second, independent copy of this same masking logic
// for the I-5 comments/resolution routes — a future fix to the rule
// applied to one would not have automatically applied to the other).
// Different routes need different authorization rules (strict Requester
// ownership vs. Requester-owns-or-is-staff visibility) and different
// amounts of ticket detail, so this is a shared core parameterized by
// both, not a single fetch-everything function.
async function fetchAuthorizedTicketOr404<T extends { requesterId: number }>(
  res: Response,
  fetchTicket: () => Promise<T | null>,
  isAuthorized: (ticket: T) => boolean
): Promise<T | null> {
  const ticket = await fetchTicket();
  if (!ticket || !isAuthorized(ticket)) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
    return null;
  }
  return ticket;
}

// Full detail (category/relatedSystem/requester/attachments) for GET/PATCH,
// which return this shape directly to the client.
async function findOwnedTicketOr404(res: Response, id: number, requesterId: number) {
  return fetchAuthorizedTicketOr404(
    res,
    () =>
      getPrisma().ticket.findUnique({
        where: { id },
        include: {
          category: true,
          relatedSystem: true,
          requester: true,
          attachments: { where: { isRemoved: false }, orderBy: { id: "asc" } },
        },
      }),
    (ticket) => ticket.requesterId === requesterId
  );
}

// Same strict-ownership rule, no joins — for routes that only need
// id/status (the resolution signal). Fixed in review: this previously
// reused findOwnedTicketOr404's full-include query for a handler that
// only reads two scalar fields.
async function findOwnedTicketLightOr404(res: Response, id: number, requesterId: number) {
  return fetchAuthorizedTicketOr404(
    res,
    () => getPrisma().ticket.findUnique({ where: { id } }),
    (ticket) => ticket.requesterId === requesterId
  );
}

type OwnedTicket = NonNullable<Awaited<ReturnType<typeof findOwnedTicketOr404>>>;
type OwnedTicketLight = NonNullable<Awaited<ReturnType<typeof findOwnedTicketLightOr404>>>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireOwnedTicketParam once ownership is confirmed. */
      ownedTicket?: OwnedTicket;
      /** Set by requireOwnedTicketParamLight once ownership is confirmed. */
      ownedTicketLight?: OwnedTicketLight;
    }
  }
}

async function requireOwnedTicketParam(req: Request, res: Response, next: NextFunction) {
  const id = parseStrictId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Invalid ticket ID" });
  }
  const ticket = await findOwnedTicketOr404(res, id, req.authUser!.id);
  if (!ticket) return; // findOwnedTicketOr404 already sent the 404 response
  req.ownedTicket = ticket;
  next();
}

async function requireOwnedTicketParamLight(req: Request, res: Response, next: NextFunction) {
  const id = parseStrictId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Invalid ticket ID" });
  }
  const ticket = await findOwnedTicketLightOr404(res, id, req.authUser!.id);
  if (!ticket) return;
  req.ownedTicketLight = ticket;
  next();
}

app.get("/api/tickets/:id", requireAuth, requirePasswordChanged, requireOwnedTicketParam, async (req: Request, res: Response) => {
  try {
    const ticket = req.ownedTicket!;
    const removedAttachments = await getPrisma().attachment.findMany({
      where: { ticketId: ticket.id, isRemoved: true },
      orderBy: { id: "asc" },
    });

    return res.status(200).json({ ...serializeTicket(ticket), removedAttachments });
  } catch (err) {
    console.error("Get ticket detail error:", err);
    return res.status(500).json({ error: "Failed to fetch ticket detail" });
  }
});

app.patch("/api/tickets/:id", requireAuth, requirePasswordChanged, requireOwnedTicketParam, async (req: Request, res: Response) => {
  try {
    const id = req.ownedTicket!.id;

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

// Add attachment to existing ticket. requireOwnedTicketParam runs BEFORE
// upload.array() (fixed in review): the previous order let multer write
// files to disk ahead of the ownership check, so a non-owner repeatedly
// POSTing to another user's ticket ID still left orphaned files on disk
// under a 404 response. Ownership is now confirmed first, so multer's
// disk-write middleware never runs for a request that will be rejected.
app.post(
  "/api/tickets/:id/attachments",
  requireAuth,
  requirePasswordChanged,
  requireOwnedTicketParam,
  upload.array("attachments", 5),
  async (req: Request, res: Response) => {
    try {
      const ticket = req.ownedTicket!;
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
              ticketId: ticket.id,
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
  requireAuth,
  requirePasswordChanged,
  requireOwnedTicketParam,
  async (req: Request, res: Response) => {
    try {
      const ticket = req.ownedTicket!;
      const attachmentId = parseStrictId(req.params.attachmentId);
      const reason = req.body?.reason || "Removed by user";
      if (attachmentId === null) {
        return res.status(400).json({ error: "Invalid parameters" });
      }

      const attachment = await getPrisma().attachment.findFirst({
        where: { id: attachmentId, ticketId: ticket.id },
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

// Download an attachment. Added in I-4 — the Lab 2 client previously linked
// directly to the static /uploads/<file> path, which enforced neither
// ownership nor removal state despite the Lab 2 report describing 403/410
// protection there. Fixed in review: an unauthenticated express.static
// mount at /uploads was still live alongside this route, which would have
// let anyone with a fileUrl bypass this endpoint entirely — that mount has
// been removed, so this is now the only way to reach an attachment's file.
app.get(
  "/api/tickets/:id/attachments/:attachmentId/download",
  requireAuth,
  requirePasswordChanged,
  requireOwnedTicketParam,
  async (req: Request, res: Response) => {
    try {
      const ticket = req.ownedTicket!;
      const attachmentId = parseStrictId(req.params.attachmentId);
      if (attachmentId === null) {
        return res.status(400).json({ error: "Invalid parameters" });
      }

      const attachment = await getPrisma().attachment.findFirst({ where: { id: attachmentId, ticketId: ticket.id } });
      if (!attachment) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Attachment not found." } });
      }
      if (attachment.isRemoved) {
        return res.status(410).json({ error: { code: "ATTACHMENT_REMOVED", message: "This attachment has been removed." } });
      }

      const absolutePath = path.join(uploadsDir, path.basename(attachment.fileUrl));
      return res.download(absolutePath, attachment.fileName, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to download attachment." } });
        }
      });
    } catch (err) {
      console.error("Download attachment error:", err);
      return res.status(500).json({ error: "Failed to download attachment" });
    }
  }
);

// ---------------------------------------------------------------------------
// Lab 2 — Issue 4: Create Ticket API (POST /api/tickets)
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets",
  requireAuth,
  requirePasswordChanged,
  upload.array("attachments", 5),
  async (req: Request, res: Response) => {
    try {
      const { summary, description, priority, categoryId, relatedSystemId } = req.body;
      // BR-03: ownership is the authenticated identity, never a client-
      // supplied requesterId. The field is no longer read from the body at
      // all — requireAuth has already confirmed this user is active.
      const requesterId = req.authUser!.id;

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
          requesterId: requesterId,
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

// ---------------------------------------------------------------------------
// Lab 3 (I-5) — Public Comments and the Requester resolution signal
// ---------------------------------------------------------------------------

// BR-04: Public Comments are visible to the Requester (own Ticket only), IT
// Staff, and Administrator. A Requester who does not own the Ticket gets 404
// (BR-32) — the IT Staff/Administrator staff-side UI (I-6/I-7) reuses this
// same endpoint against any Ticket, so only the Requester path is
// ownership-scoped here. Built on the same fetchAuthorizedTicketOr404 core
// as findOwnedTicketOr404 above (fixed in review: this previously
// reimplemented the 404-masking response independently).
async function findVisibleTicketOr404(res: Response, id: number, authUser: NonNullable<Request["authUser"]>) {
  return fetchAuthorizedTicketOr404(
    res,
    () => getPrisma().ticket.findUnique({ where: { id } }),
    (ticket) => authUser.role !== Role.REQUESTER || ticket.requesterId === authUser.id
  );
}

type VisibleTicket = NonNullable<Awaited<ReturnType<typeof findVisibleTicketOr404>>>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      visibleTicket?: VisibleTicket;
    }
  }
}

async function requireTicketVisibleToUser(req: Request, res: Response, next: NextFunction) {
  const id = parseStrictId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Invalid ticket ID" });
  }
  const ticket = await findVisibleTicketOr404(res, id, req.authUser!);
  if (!ticket) return;
  req.visibleTicket = ticket;
  next();
}

function validateCommentBody(body: unknown): string | null {
  if (typeof body !== "string") return null;
  const trimmed = body.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return null;
  return trimmed;
}

app.get(
  "/api/tickets/:id/comments",
  requireAuth,
  requirePasswordChanged,
  requireTicketVisibleToUser,
  async (req: Request, res: Response) => {
    try {
      const comments = await getPrisma().publicComment.findMany({
        where: { ticketId: req.visibleTicket!.id },
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      });
      return res.status(200).json(
        comments.map((c) => ({
          id: c.id,
          ticketId: c.ticketId,
          authorId: c.authorId,
          authorName: c.author.name,
          authorRole: c.author.role,
          body: c.body,
          createdAt: c.createdAt,
        }))
      );
    } catch (err) {
      console.error("List comments error:", err);
      return res.status(500).json({ error: "Failed to fetch comments" });
    }
  }
);

app.post(
  "/api/tickets/:id/comments",
  requireAuth,
  requirePasswordChanged,
  requireTicketVisibleToUser,
  async (req: Request, res: Response) => {
    try {
      // BR-23: empty/whitespace-only rejected, 1-2000 chars.
      const body = validateCommentBody(req.body?.body);
      if (body === null) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Comment must be between 1 and 2000 characters." },
        });
      }

      // BR-22: author and timestamp are server-set, never trusted from the client.
      const comment = await getPrisma().publicComment.create({
        data: { ticketId: req.visibleTicket!.id, authorId: req.authUser!.id, body },
        include: { author: { select: { id: true, name: true, role: true } } },
      });

      return res.status(201).json({
        id: comment.id,
        ticketId: comment.ticketId,
        authorId: comment.authorId,
        authorName: comment.author.name,
        authorRole: comment.author.role,
        body: comment.body,
        createdAt: comment.createdAt,
      });
    } catch (err) {
      console.error("Create comment error:", err);
      return res.status(500).json({ error: "Failed to post comment" });
    }
  }
);

// BR-05, D-10: a Requester may indicate a problem appears resolved, but this
// is a flag plus an auto-generated Public Comment — never a status change.
// A client sending a status field alongside this call has no effect; there
// is no status field in this route's contract at all.
// (RESOLUTION_SIGNAL_BLOCKED_STATUSES is defined near serializeTicket at
// the top of this file, shared with the canSignalResolution flag.)

function createResolutionComment(tx: Prisma.TransactionClient, ticketId: number, authorId: number) {
  return tx.publicComment.create({
    data: {
      ticketId,
      authorId,
      body: "The Requester has indicated that this problem appears resolved.",
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
}

app.post(
  "/api/tickets/:id/resolution-signal",
  requireAuth,
  requirePasswordChanged,
  requireOwnedTicketParamLight,
  async (req: Request, res: Response) => {
    try {
      const ticket = req.ownedTicketLight!;
      const now = new Date();

      // Fixed in review: this previously only checked terminal status,
      // never whether requesterResolvedAt was already set, so a
      // double-click or retry on a still-open ticket would overwrite the
      // timestamp and create a duplicate comment on every call. The check
      // is also done as the WHERE clause of the UPDATE itself (inside the
      // transaction), not read-then-write from req.ownedTicketLight, so a
      // concurrent second request can't race past a stale in-memory read —
      // Postgres serializes the two UPDATEs on this row, and the second
      // one's WHERE clause simply won't match anymore once the first has
      // committed.
      // The transaction returns the created comment directly (or null if
      // the conditional update didn't match) into a plain const, rather
      // than mutating closure-captured `let`s — TypeScript narrows a
      // function's own return value normally; it does not narrow a `let`
      // reassigned from inside a nested closure.
      const createdComment = await getPrisma().$transaction(async (tx) => {
        const result = await tx.ticket.updateMany({
          where: {
            id: ticket.id,
            status: { notIn: RESOLUTION_SIGNAL_BLOCKED_STATUSES },
            requesterResolvedAt: null,
          },
          data: { requesterResolvedAt: now },
        });
        if (result.count === 0) return null;
        return createResolutionComment(tx, ticket.id, req.authUser!.id);
      });

      if (!createdComment) {
        return res.status(409).json({
          error: {
            code: "TICKET_ALREADY_TERMINAL_OR_SIGNALED",
            message: "This ticket is already resolved, closed, cancelled, or has already been signaled.",
          },
        });
      }

      return res.status(200).json({
        id: ticket.id,
        requesterResolvedAt: now,
        comment: {
          id: createdComment.id,
          ticketId: createdComment.ticketId,
          authorId: createdComment.authorId,
          authorName: createdComment.author.name,
          authorRole: createdComment.author.role,
          body: createdComment.body,
          createdAt: createdComment.createdAt,
        },
      });
    } catch (err) {
      console.error("Resolution signal error:", err);
      return res.status(500).json({ error: "Failed to record resolution signal" });
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
