import { Router, Request, Response } from "express";
import { getStoredDocumentByToken } from "../lib/documents/storage";
import { createDocumentService } from "../lib/documents/service";

const router = Router();

// GET /api/documents/download/:token - Download file via signed token
router.get("/download/:token", (req: Request, res: Response) => {
  const token = req.params.token;
  const entry = getStoredDocumentByToken(token);

  if (!entry) {
    res.status(404).send("File not found or link has expired (1 hour limit).");
    return;
  }

  res.setHeader("Content-Type", entry.contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(entry.fileName)}"`
  );
  res.setHeader("Content-Length", entry.buffer.length);
  res.end(entry.buffer);
});

// POST /api/documents/create - Direct document creation or retry
router.post("/create", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req.headers["x-user-id"] as string);
    const { format, title, spec } = req.body;

    const doc = await createDocumentService({
      format,
      title,
      spec,
      userId,
    });

    res.json(doc);
  } catch (err: any) {
    res.status(400).json({
      error: err.message || "Failed to create document",
    });
  }
});

export default router;
