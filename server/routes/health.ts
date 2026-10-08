import { Router } from "express";
import { apiKey } from "../lib/gemini";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(apiKey),
    models: ["gemini-3.8-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite"],
  });
});

export default router;
