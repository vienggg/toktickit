import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./utils/ticketNumber.js";

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

      if (!summary || typeof summary !== "string" || summary.trim().length < 3) {
        errors.push({
          field: "summary",
          message: "Summary is required and must be at least 3 characters.",
        });
      }

      if (!description || typeof description !== "string" || description.trim().length < 5) {
        errors.push({
          field: "description",
          message: "Description is required and must be at least 5 characters.",
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

      // Verify category and active requester in database
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
