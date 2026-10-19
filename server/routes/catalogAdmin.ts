import { Router, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { getCatalogStore } from "../lib/catalog/store";
import { runProviderSync, runCatalogSync, catalogSyncEnabled } from "../lib/catalog/scheduler";
import { checkIsAdmin } from "../lib/modelsStore";

const router = Router();

async function requireAdmin(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  const isAdmin = await checkIsAdmin(req.user?.id || "");
  if (!isAdmin) {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return false;
  }
  return true;
}

/**
 * POST /api/catalog/sync — the per-provider "Sync now" button (admin).
 * Body: { provider?: string }. Without a provider every catalog fetcher runs.
 * Manual runs bypass the multi-instance lock but never run concurrently here.
 */
router.post("/sync", async (req: AuthenticatedRequest, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const provider = typeof req.body?.provider === "string" && req.body.provider ? req.body.provider : null;
    if (!catalogSyncEnabled()) {
      res.status(503).json({ error: "Catalog syncing is disabled in this environment" });
      return;
    }
    const results = provider ? [await runProviderSync(provider, "manual")] : await runCatalogSync("manual");
    if (results === null) {
      res.status(409).json({ error: "A catalog sync is already running" });
      return;
    }
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Sync failed" });
  }
});

/** GET /api/catalog/overrides — current admin curation rows (admin). */
router.get("/overrides", async (req: AuthenticatedRequest, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const overrides = await getCatalogStore().getOverrides();
    res.json({ overrides });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load overrides" });
  }
});

/**
 * PUT /api/catalog/overrides — admin curation through catalog_overrides.
 * Body: { provider, model_id, hidden?, force_recommended?, alias?, is_default? }.
 * null/undefined leaves a field untouched; empty string clears an alias;
 * { clear: true } removes the override row.
 */
router.put("/overrides", async (req: AuthenticatedRequest, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { provider, model_id: modelId } = req.body || {};
    if (typeof provider !== "string" || !provider || typeof modelId !== "string" || !modelId) {
      res.status(400).json({ error: "provider and model_id are required" });
      return;
    }
    const store = getCatalogStore();
    const existing = (await store.getOverrides()).find((o) => o.provider === provider && o.model_id === modelId);

    if (req.body.clear === true) {
      await store.saveOverride({ ...existing, provider, model_id: modelId, hidden: false, force_recommended: false, alias: null, is_default: false });
      res.json({ success: true, cleared: true });
      return;
    }

    const next = {
      provider,
      model_id: modelId,
      hidden: req.body.hidden === undefined ? Boolean(existing?.hidden) : Boolean(req.body.hidden),
      force_recommended: req.body.force_recommended === undefined ? Boolean(existing?.force_recommended) : Boolean(req.body.force_recommended),
      alias: req.body.alias === undefined ? (existing?.alias ?? null) : req.body.alias === null || req.body.alias === "" ? null : String(req.body.alias),
      is_default: req.body.is_default === undefined ? Boolean(existing?.is_default) : Boolean(req.body.is_default),
    };
    await store.saveOverride(next);
    res.json({ success: true, override: next });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to save override" });
  }
});

export default router;
