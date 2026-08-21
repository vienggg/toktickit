import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Welcome to TokTickIT API",
    frontend: "http://localhost:5173",
    endpoints: {
      health: "/api/health",
      categories: "/api/categories",
      devRequesters: "/api/dev/requesters"
    }
  });
});

// ---------------------------------------------------------------------------
// Lab 1 Routes
// ---------------------------------------------------------------------------
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
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 Routes — Issue 3: Development Requester Context
// ---------------------------------------------------------------------------
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
      }
    });
    res.status(200).json(activeRequesters);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch development requesters" });
  }
});

export default app;
