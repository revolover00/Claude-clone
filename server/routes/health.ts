import { Router } from "express";
import { getModelsFromDB } from "../lib/modelsStore";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    const enabledModels = await getModelsFromDB(false);
    const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
    res.json({
      ok: true,
      hasGeminiKey: false, // the server never ships an AI key — users add their own
      hasSupabase,
      db: "reachable",
      enabledModels: enabledModels.map(m => m.id),
      runtime: process.env.VERCEL ? "vercel" : "node",
    });
  } catch {
    res.json({
      ok: false,
      hasGeminiKey: false, // the server never ships an AI key — users add their own
      db: "error",
    });
  }
});

export default router;
