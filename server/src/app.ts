import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./utils/ticketNumber.js";
import { Prisma } from "@prisma/client";

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

app.use(cors());
app.use(express.json());
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
    const activeRequesters = await getPrisma().requesterUser.findMany({
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
      where.status = String(status);
    }

    if (categoryId && categoryId !== "All") {
      const parsedCatId = parseInt(String(categoryId), 10);
      if (!isNaN(parsedCatId)) {
        where.categoryId = parsedCatId;
      }
    }

    if (priority && priority !== "All") {
      where.priority = String(priority);
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
      if (field === "createdAt" || field === "updatedAt" || field === "priority" || field === "status") {
        orderBy = { [field]: dir };
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
      tickets,
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

    return res.status(200).json(ticket);
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
      if (!["Low", "Medium", "High", "Urgent"].includes(priority)) {
        return res.status(400).json({ error: "Invalid priority value" });
      }
      dataToUpdate.priority = priority;
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

    return res.status(200).json(updatedTicket);
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

      const requester = await getPrisma().requesterUser.findUnique({
        where: { id: parsedRequesterId },
      });
      if (!requester || !requester.isActive) {
        return res.status(400).json({
          error: "Invalid requester",
          details: [{ field: "requesterId", message: "Requester is not active or does not exist." }],
        });
      }

      const parsedSystemId = relatedSystemId ? parseInt(relatedSystemId, 10) : null;
      const validPriority = ["Low", "Medium", "High", "Urgent"].includes(priority)
        ? priority
        : "Medium";

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
          priority: validPriority,
          status: "New",
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

      return res.status(201).json(newTicket);
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
