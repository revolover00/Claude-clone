import { Router } from "express";
import { apiKey } from "../lib/gemini";
import { getModelsFromDB } from "./models";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    const enabledModels = await getModelsFromDB(false);
    res.json({
      ok: true,
      hasKey: Boolean(apiKey),
      enabledModelsCount: enabledModels.length,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
