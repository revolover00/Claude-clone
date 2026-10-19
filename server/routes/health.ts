import { Router } from "express";
import { getModelsFromDB } from "../lib/modelsStore";
import { getCatalogStore } from "../lib/catalog/store";
import { getCatalogSchemaHealth } from "../lib/catalog/schemaProbe";
import type { CatalogStore } from "../lib/catalog/types";

const router = Router();

async function readCatalogHealth() {
  let store: CatalogStore;
  try {
    store = getCatalogStore();
  } catch {
    return { db: "unreachable" as const, missing: [], lastSync: [] };
  }
  const schema = await getCatalogSchemaHealth();
  let lastSync: Array<{ provider: string; status: string; at: string }> = [];
  try {
    const runs = await store.listRuns(undefined, 5);
    lastSync = runs.map((run) => ({
      provider: run.provider,
      status: run.status,
      at: run.finished_at || run.started_at,
    }));
  } catch {
    // Health stays useful when the sync history table itself is unavailable.
  }
  return { ...schema, lastSync };
}

router.get("/health", async (_req, res) => {
  const catalog = await readCatalogHealth();
  try {
    const enabledModels = await getModelsFromDB(false);
    const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
    res.json({
      ok: true,
      hasGeminiKey: false,
      hasSupabase,
      db: "reachable",
      enabledModels: enabledModels.map((model) => model.id),
      runtime: process.env.VERCEL ? "vercel" : "node",
      catalog,
    });
  } catch {
    res.json({
      ok: false,
      hasGeminiKey: false,
      db: "error",
      catalog,
    });
  }
});

export default router;
