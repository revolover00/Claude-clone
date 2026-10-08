import { Router } from "express";
import { apiKey } from "../lib/gemini";
import { getModelsFromDB } from "./models";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    const enabledModels = await getModelsFromDB(false);
    const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
    res.json({
      ok: true,
      hasGeminiKey: Boolean(apiKey),
      hasSupabase,
      db: "reachable",
      enabledModels: enabledModels.map(m => m.id),
      runtime: process.env.VERCEL ? "vercel" : "node",
    });
  } catch (err: any) {
    res.json({
      ok: false,
      hasGeminiKey: Boolean(apiKey),
      db: "error",
    });
  }
});

export default router;
