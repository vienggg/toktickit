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
        // Cleanup uploaded files if validation failed
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

      // Verify category, system, and requester exist
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

      // Generate Ticket Number atomically
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
