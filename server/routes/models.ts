import { Router, Response } from "express";
import { ai, apiKey } from "../lib/gemini";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { runThinkingDiagnostic } from "../lib/testThinking";
import { normalizeSlug } from "../../src/shared/normalizeSlug";
import { 
  checkIsAdmin, 
  getModelsFromDB, 
  invalidateModelCache, 
  isRealSupabaseConfigured, 
  supabaseServer,
  FALLBACK_MODELS,
} from "../lib/modelsStore";
import { seedAppModelsFromCatalog, buildSeedRows } from "../lib/modelsSeed";
import { CATALOG_SNAPSHOT, catalogProviderCounts, catalogTotals } from "../../src/shared/catalog";

export { 
  checkIsAdmin, 
  getModelsFromDB, 
  invalidateModelCache, 
  isRealSupabaseConfigured, 
  supabaseServer,
  FALLBACK_MODELS,
};

const router = Router();



// GET /api/models
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await checkIsAdmin(req.user?.id || "");
    const all = req.query.all === "true" && isAdmin;
    const list = await getModelsFromDB(all);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/models/catalog - Bundled catalog summary for the Models settings tab
router.get("/catalog", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const appModels = await getModelsFromDB(true);
    const importedSlugs = new Set(appModels.map((m: any) => m.slug));
    const appRows = buildSeedRows();
    const providers = catalogProviderCounts().map((p) => {
      const providerRows = appRows.filter((row) => row.provider === p.id || row.provider === "google" && p.id === "gemini");
      return {
        ...p,
        imported: providerRows.filter((row) => importedSlugs.has(row.slug)).length,
      };
    });

    res.json({
      snapshot: CATALOG_SNAPSHOT,
      totals: catalogTotals(),
      appModelCount: appModels.length,
      catalogModelCount: appModels.filter((m: any) => m.catalog_source === "bundled").length,
      providers,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/models/catalog/import (Admin only) - Populate App models from the bundled catalog
router.post("/catalog/import", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await checkIsAdmin(req.user?.id || "");
    if (!isAdmin) {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }

    if (isRealSupabaseConfigured && supabaseServer) {
      const result = await seedAppModelsFromCatalog(supabaseServer, { force: true });
      if (result.status === "failed") {
        res.status(400).json({ error: result.reason || "Failed to import the bundled catalog" });
        return;
      }
      invalidateModelCache();
      res.json({ success: true, imported: result.inserted, snapshot: CATALOG_SNAPSHOT });
      return;
    }

    // Local/dev mode: replace the in-process model list with the bundled catalog.
    const rows = buildSeedRows();
    localStorage.setItem("claude_clone_mock_models", JSON.stringify(rows));
    invalidateModelCache();
    res.json({ success: true, imported: rows.length, snapshot: CATALOG_SNAPSHOT });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/models (Admin only)
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await checkIsAdmin(req.user?.id || "");
    if (!isAdmin) {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }

    const modelData = { ...req.body };
    if (modelData.slug) {
      modelData.slug = normalizeSlug(modelData.slug);
    }

    if (isRealSupabaseConfigured && supabaseServer) {
      const { data, error } = await supabaseServer.from("models").insert(modelData).select();
      if (error) throw error;
      invalidateModelCache();
      res.status(201).json(data[0]);
    } else {
      // Mock db insertion
      const saved = localStorage.getItem("claude_clone_mock_models");
      const current = saved ? JSON.parse(saved) : FALLBACK_MODELS;
      const newItem = {
        id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...modelData
      };
      localStorage.setItem("claude_clone_mock_models", JSON.stringify([...current, newItem]));
      invalidateModelCache();
      res.status(201).json(newItem);
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/models/:id (Admin only)
router.patch("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await checkIsAdmin(req.user?.id || "");
    if (!isAdmin) {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }

    const { id } = req.params;
    const modelData = { ...req.body };
    if (modelData.slug) {
      modelData.slug = normalizeSlug(modelData.slug);
    }

    if (isRealSupabaseConfigured && supabaseServer) {
      const { data, error } = await supabaseServer.from("models").update(modelData).eq("id", id).select();
      if (error) throw error;
      invalidateModelCache();
      res.json(data[0]);
    } else {
      const saved = localStorage.getItem("claude_clone_mock_models");
      const current = saved ? JSON.parse(saved) : FALLBACK_MODELS;
      let updatedItem = null;
      const updated = current.map((item: any) => {
        if (item.id === id || item.slug === id || normalizeSlug(item.slug) === normalizeSlug(id)) {
          updatedItem = { ...item, ...modelData };
          return updatedItem;
        }
        return item;
      });
      localStorage.setItem("claude_clone_mock_models", JSON.stringify(updated));
      invalidateModelCache();
      res.json(updatedItem);
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/models/:id (Admin only)
router.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await checkIsAdmin(req.user?.id || "");
    if (!isAdmin) {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }

    const { id } = req.params;

    if (isRealSupabaseConfigured && supabaseServer) {
      const { error } = await supabaseServer.from("models").delete().eq("id", id);
      if (error) throw error;
      invalidateModelCache();
      res.json({ success: true });
    } else {
      const saved = localStorage.getItem("claude_clone_mock_models");
      const current = saved ? JSON.parse(saved) : FALLBACK_MODELS;
      const filtered = current.filter((item: any) => item.id !== id && item.slug !== id && normalizeSlug(item.slug) !== normalizeSlug(id));
      localStorage.setItem("claude_clone_mock_models", JSON.stringify(filtered));
      invalidateModelCache();
      res.json({ success: true });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/models/discover (Admin only)
router.get("/discover", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await checkIsAdmin(req.user?.id || "");
    if (!isAdmin) {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }

    if (!apiKey) {
      res.status(403).json({ error: "API key is not configured on the server" });
      return;
    }

    const list = await ai.models.list();
    const formatted = list.models.map((m: any) => ({
      name: m.name,
      displayName: m.displayName || m.name,
      description: m.description || "",
      supportedGenerationMethods: m.supportedGenerationMethods || [],
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/models/:id/test (Admin only)
router.post("/:id/test", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await checkIsAdmin(req.user?.id || "");
    if (!isAdmin) {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }
    const all = await getModelsFromDB(true);
    const targetModel = all.find(m => m.id === req.params.id || m.slug === req.params.id || normalizeSlug(m.slug) === normalizeSlug(req.params.id));
    if (!targetModel) {
      res.status(404).json({ error: "Model not found" });
      return;
    }
    if (!apiKey || !ai) {
      res.status(403).json({ error: "API key is not configured on the server" });
      return;
    }
    const start = Date.now();
    try {
      await ai.models.generateContent({ model: targetModel.api_model_id, contents: "Hi", config: { maxOutputTokens: 3 } });
      res.json({ ok: true, latencyMs: Date.now() - start });
    } catch (apiErr: any) {
      res.json({ ok: false, latencyMs: Date.now() - start, error: apiErr.message || "API request failed" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/models/:slug/test-thinking (Admin only)
router.post("/:slug/test-thinking", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await checkIsAdmin(req.user?.id || "");
    if (!isAdmin) {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }
    const all = await getModelsFromDB(true);
    const target = all.find(m => m.slug === req.params.slug || normalizeSlug(m.slug) === normalizeSlug(req.params.slug) || m.id === req.params.slug);
    if (!target) {
      res.status(404).json({ error: "Model not found" });
      return;
    }
    if (!apiKey || !ai) {
      res.status(403).json({ error: "API key is not configured on the server" });
      return;
    }
    const result = await runThinkingDiagnostic(ai, target.api_model_id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to run thinking test" });
  }
});


export default router;
