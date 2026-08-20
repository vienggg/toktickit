import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getPrisma } from "./prisma.js";
import { formatTicketNumber } from "./utils/ticketNumber.js";
import { Priority } from "@prisma/client";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer storage setup for attachments
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("INVALID_FILE_TYPE"));
    }
  }
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Welcome to TokTickIT API",
    frontend: "http://localhost:5173",
    endpoints: {
      health: "/api/health",
      categories: "/api/categories",
      devRequesters: "/api/dev/requesters",
      systems: "/api/systems",
      tickets: "/api/tickets"
    }
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true }
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch categories" } });
  }
});

app.get("/api/systems", async (_req: Request, res: Response) => {
  try {
    const systems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true, description: true, isActive: true }
    });
    res.json(systems);
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch related systems" } });
  }
});

app.get("/api/dev/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true, email: true, isActive: true }
    });
    res.json(requesters);
  } catch (err) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch development requesters" } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tickets — List & Filter Tickets by Requester
// ---------------------------------------------------------------------------
app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const {
      requesterId,
      search,
      categoryId,
      relatedSystemId,
      priority,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      pageSize = "10"
    } = req.query;

    const parsedRequesterId = parseInt(requesterId as string, 10);
    if (isNaN(parsedRequesterId)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "requesterId query parameter is required to view owned tickets."
        }
      });
    }

    const where: any = {
      requesterId: parsedRequesterId
    };

    if (search && typeof search === "string" && search.trim() !== "") {
      const q = search.trim();
      where.OR = [
        { ticketNumber: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } }
      ];
    }

    if (categoryId && typeof categoryId === "string" && categoryId !== "ALL") {
      const catId = parseInt(categoryId, 10);
      if (!isNaN(catId)) where.categoryId = catId;
    }

    if (relatedSystemId && typeof relatedSystemId === "string" && relatedSystemId !== "ALL") {
      const sysId = parseInt(relatedSystemId, 10);
      if (!isNaN(sysId)) where.relatedSystemId = sysId;
    }

    if (priority && typeof priority === "string" && priority !== "ALL") {
      where.requestedPriority = priority as Priority;
    }

    if (status && typeof status === "string" && status !== "ALL") {
      where.currentStatus = status;
    }

    const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
    const parsedPageSize = Math.max(1, Math.min(100, parseInt(pageSize as string, 10) || 10));
    const skip = (parsedPage - 1) * parsedPageSize;

    const validSortFields = ["createdAt", "requestedPriority", "ticketNumber", "summary"];
    const sortField = validSortFields.includes(sortBy as string) ? (sortBy as string) : "createdAt";
    const orderDirection = (sortOrder as string)?.toLowerCase() === "asc" ? "asc" : "desc";

    const prisma = getPrisma();

    const [totalCount, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy: { [sortField]: orderDirection },
        skip,
        take: parsedPageSize,
        include: {
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          requester: { select: { id: true, name: true, email: true } },
          _count: {
            select: {
              attachments: {
                where: { isRemoved: false }
              }
            }
          }
        }
      })
    ]);

    const totalPages = Math.ceil(totalCount / parsedPageSize) || 1;

    res.json({
      data: tickets,
      pagination: {
        page: parsedPage,
        pageSize: parsedPageSize,
        totalCount,
        totalPages
      }
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch tickets."
      }
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tickets/:id — Get Ticket Details by ID
// ---------------------------------------------------------------------------
app.get("/api/tickets/:id", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "INVALID_ID", message: "Invalid ticket ID." } });
    }

    const { requesterId } = req.query;
    const parsedRequesterId = requesterId ? parseInt(requesterId as string, 10) : undefined;

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true, email: true } },
        attachments: {
          where: { isRemoved: false },
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            isRemoved: true,
            createdAt: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
    }

    if (parsedRequesterId && ticket.requesterId !== parsedRequesterId) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied to this ticket." } });
    }

    res.json(ticket);
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch ticket details." } });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/tickets/:id — Edit Ticket Details (Only if status === 'New')
// ---------------------------------------------------------------------------
app.put("/api/tickets/:id", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: { code: "INVALID_ID", message: "Invalid ticket ID." } });
    }

    const { summary, description, categoryId, relatedSystemId, requestedPriority, requesterId } = req.body;
    const prisma = getPrisma();

    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    });

    if (!existingTicket) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
    }

    if (requesterId && existingTicket.requesterId !== parseInt(requesterId, 10)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "You can only edit your own tickets." } });
    }

    if (existingTicket.currentStatus !== "New") {
      return res.status(400).json({
        error: { code: "IMMUTABLE_STATUS", message: "Tickets cannot be modified once they transition beyond 'New' status." }
      });
    }

    const validationErrors: { field: string; message: string }[] = [];

    const trimmedSummary = typeof summary === "string" ? summary.trim() : "";
    if (!trimmedSummary || trimmedSummary.length < 5 || trimmedSummary.length > 200) {
      validationErrors.push({ field: "summary", message: "Summary must be between 5 and 200 characters." });
    }

    const trimmedDescription = typeof description === "string" ? description.trim() : "";
    if (!trimmedDescription || trimmedDescription.length < 10 || trimmedDescription.length > 2000) {
      validationErrors.push({ field: "description", message: "Description must be between 10 and 2000 characters." });
    }

    const parsedCatId = parseInt(categoryId, 10);
    if (isNaN(parsedCatId)) {
      validationErrors.push({ field: "categoryId", message: "Category is required." });
    }

    const parsedSysId = parseInt(relatedSystemId, 10);
    if (isNaN(parsedSysId)) {
      validationErrors.push({ field: "relatedSystemId", message: "Related system is required." });
    }

    const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (!requestedPriority || !validPriorities.includes(requestedPriority)) {
      validationErrors.push({ field: "requestedPriority", message: "Requested priority must be LOW, MEDIUM, HIGH, or URGENT." });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Validation failed.", details: validationErrors }
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        summary: trimmedSummary,
        description: trimmedDescription,
        categoryId: parsedCatId,
        relatedSystemId: parsedSysId,
        requestedPriority: requestedPriority as Priority
      },
      include: {
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true, email: true } },
        attachments: {
          where: { isRemoved: false },
          select: { id: true, fileName: true, fileSize: true, mimeType: true, isRemoved: true, createdAt: true }
        }
      }
    });

    res.json(updatedTicket);
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update ticket." } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/attachments/:id/download — Download Attachment File
// ---------------------------------------------------------------------------
app.get("/api/attachments/:id/download", async (req: Request, res: Response) => {
  try {
    const attachmentId = parseInt(req.params.id, 10);
    if (isNaN(attachmentId)) {
      return res.status(400).json({ error: { code: "INVALID_ID", message: "Invalid attachment ID." } });
    }

    const prisma = getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId }
    });

    if (!attachment || attachment.isRemoved) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Attachment not found or has been removed." } });
    }

    const filePath = path.join(uploadsDir, attachment.storedFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: { code: "FILE_NOT_FOUND", message: "Attachment file missing from storage." } });
    }

    res.download(filePath, attachment.fileName);
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to download attachment." } });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/attachments/:id — Soft-Delete Attachment (Only if status === 'New')
// ---------------------------------------------------------------------------
app.delete("/api/attachments/:id", async (req: Request, res: Response) => {
  try {
    const attachmentId = parseInt(req.params.id, 10);
    if (isNaN(attachmentId)) {
      return res.status(400).json({ error: { code: "INVALID_ID", message: "Invalid attachment ID." } });
    }

    const prisma = getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: true }
    });

    if (!attachment || attachment.isRemoved) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Attachment not found or already removed." } });
    }

    if (attachment.ticket.currentStatus !== "New") {
      return res.status(400).json({
        error: { code: "IMMUTABLE_STATUS", message: "Attachments cannot be removed once the ticket is in progress." }
      });
    }

    const updatedAttachment = await prisma.attachment.update({
      where: { id: attachmentId },
      data: { isRemoved: true }
    });

    res.json({
      success: true,
      message: "Attachment removed successfully.",
      attachmentId: updatedAttachment.id,
      isRemoved: updatedAttachment.isRemoved
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove attachment." } });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tickets — Create Ticket with Attachments
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets",
  (req: Request, res: Response, next: NextFunction) => {
    upload.array("attachments", 5)(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: {
              code: "FILE_TOO_LARGE",
              message: "Each attachment file size must not exceed 5 MB."
            }
          });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            error: {
              code: "TOO_MANY_FILES",
              message: "A maximum of 5 attachments are allowed per ticket."
            }
          });
        }
        if (err.message === "INVALID_FILE_TYPE") {
          return res.status(400).json({
            error: {
              code: "INVALID_FILE_TYPE",
              message: "Allowed file formats are JPG, PNG, WEBP, and PDF."
            }
          });
        }
        return res.status(400).json({
          error: {
            code: "UPLOAD_ERROR",
            message: err.message || "File upload failed."
          }
        });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const { summary, description, categoryId, relatedSystemId, requestedPriority, requesterId } = req.body;
      const files = (req.files as Express.Multer.File[]) || [];

      const validationErrors: { field: string; message: string }[] = [];

      const trimmedSummary = typeof summary === "string" ? summary.trim() : "";
      if (!trimmedSummary || trimmedSummary.length < 5 || trimmedSummary.length > 200) {
        validationErrors.push({
          field: "summary",
          message: "Summary is required and must be between 5 and 200 characters."
        });
      }

      const trimmedDescription = typeof description === "string" ? description.trim() : "";
      if (!trimmedDescription || trimmedDescription.length < 10 || trimmedDescription.length > 2000) {
        validationErrors.push({
          field: "description",
          message: "Description is required and must be between 10 and 2000 characters."
        });
      }

      const parsedCategoryId = parseInt(categoryId, 10);
      if (isNaN(parsedCategoryId)) {
        validationErrors.push({ field: "categoryId", message: "Category is required." });
      }

      const parsedSystemId = parseInt(relatedSystemId, 10);
      if (isNaN(parsedSystemId)) {
        validationErrors.push({ field: "relatedSystemId", message: "Related system is required." });
      }

      const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
      if (!requestedPriority || !validPriorities.includes(requestedPriority)) {
        validationErrors.push({ field: "requestedPriority", message: "Requested priority must be LOW, MEDIUM, HIGH, or URGENT." });
      }

      const parsedRequesterId = parseInt(requesterId, 10);
      if (isNaN(parsedRequesterId)) {
        validationErrors.push({ field: "requesterId", message: "Active requester context is required." });
      }

      if (validationErrors.length > 0) {
        for (const file of files) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed on submitted ticket data.",
            details: validationErrors
          }
        });
      }

      const prisma = getPrisma();

      const [category, system, requester] = await Promise.all([
        prisma.category.findUnique({ where: { id: parsedCategoryId } }),
        prisma.relatedSystem.findFirst({ where: { id: parsedSystemId, isActive: true } }),
        prisma.requesterUser.findFirst({ where: { id: parsedRequesterId, isActive: true } })
      ]);

      if (!category) {
        return res.status(400).json({ error: { code: "INVALID_CATEGORY", message: "Selected category does not exist." } });
      }
      if (!system) {
        return res.status(400).json({ error: { code: "INVALID_SYSTEM", message: "Selected related system is invalid or inactive." } });
      }
      if (!requester) {
        return res.status(400).json({ error: { code: "INVALID_REQUESTER", message: "Selected requester is invalid or inactive." } });
      }

      const createdTicket = await prisma.$transaction(async (tx) => {
        const count = await tx.ticket.count();
        const ticketNumber = formatTicketNumber(count + 1);

        const ticket = await tx.ticket.create({
          data: {
            ticketNumber,
            summary: trimmedSummary,
            description: trimmedDescription,
            requestedPriority: requestedPriority as Priority,
            currentStatus: "New",
            requesterId: parsedRequesterId,
            categoryId: parsedCategoryId,
            relatedSystemId: parsedSystemId,
            attachments: {
              create: files.map((f) => ({
                fileName: f.originalname,
                storedFileName: f.filename,
                fileSize: f.size,
                mimeType: f.mimetype
              }))
            }
          },
          include: {
            requester: { select: { id: true, name: true, email: true } },
            category: { select: { id: true, name: true } },
            relatedSystem: { select: { id: true, name: true } },
            attachments: {
              select: {
                id: true,
                fileName: true,
                fileSize: true,
                mimeType: true,
                isRemoved: true,
                createdAt: true
              }
            }
          }
        });

        return ticket;
      });

      return res.status(201).json(createdTicket);
    } catch (err: any) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred while creating your ticket. Please try again."
        }
      });
    }
  }
);

export default app;
