import { Router, Response } from "express";
import { ai, apiKey } from "../lib/gemini";
import { createClient } from "@supabase/supabase-js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { runThinkingDiagnostic } from "../lib/testThinking";

const router = Router();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const isRealSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseServiceKey && 
  !supabaseUrl.includes("YOUR_") && 
  !supabaseServiceKey.includes("YOUR_")
);

const supabaseServer = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Stateful seed models fallback when DB is real but empty
const DEFAULT_SEED_MODELS = [
  { slug: "gemini-3-8-flash", display_name: "Gemini 3.8 Flash", description: "Fast and highly balanced intelligence, ideal for general chat and multimodal tasks.", provider: "google", api_model_id: "gemini-3.8-flash", kind: "chat", supports_thinking: false, supports_search: true, supports_vision: true, enabled: true, is_default: true, sort_order: 1 },
  { slug: "gemini-3-1-pro", display_name: "Gemini 3.1 Pro", description: "State-of-the-art capability for complex tasks and deep reasoning.", provider: "google", api_model_id: "gemini-3.1-pro-preview", kind: "chat", supports_thinking: true, supports_search: true, supports_vision: true, enabled: true, is_default: false, sort_order: 2 },
  { slug: "gemini-3-1-flash-lite", display_name: "Gemini 3.1 Flash-Lite", description: "Incredible speed and low latency for quick conversations and summaries.", provider: "google", api_model_id: "gemini-3.1-flash-lite", kind: "chat", supports_thinking: false, supports_search: false, supports_vision: true, enabled: true, is_default: false, sort_order: 3 },
  { slug: "gemini-light", display_name: "Gemini Light", description: "Internal model optimized for automated metadata, tags, and suggestions.", provider: "google", api_model_id: "gemini-3.1-flash-lite", kind: "light", supports_thinking: false, supports_search: false, supports_vision: false, enabled: true, is_default: false, sort_order: 4 },
  { slug: "gemini-embedding", display_name: "Gemini Embedding", description: "High-performance text embeddings for semantic search and knowledge.", provider: "google", api_model_id: "text-embedding-004", kind: "embedding", supports_thinking: false, supports_search: false, supports_vision: false, enabled: true, is_default: false, sort_order: 5 }
];

// In-memory cache for GET /api/models
let cachedModels: any[] | null = null;
let cacheExpiry = 0;

export function invalidateModelCache() {
  cachedModels = null;
  cacheExpiry = 0;
}

export async function checkIsAdmin(userId: string): Promise<boolean> {
  if (!isRealSupabaseConfigured || !supabaseServer) {
    return Boolean(userId);
  }
  try {
    const { data, error } = await supabaseServer
      .from("app_admins")
      .select("user_id")
      .eq("user_id", userId)
      .single();
    return Boolean(data && !error);
  } catch {
    return false;
  }
}

// Fetch helper to fetch from DB or seed if empty
export async function getModelsFromDB(all = false): Promise<any[]> {
  if (!all && cachedModels && Date.now() < cacheExpiry) {
    return cachedModels;
  }

  let models: any[];
  if (isRealSupabaseConfigured && supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from("models")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!error && data && data.length > 0) {
        models = data;
      } else {
        models = DEFAULT_SEED_MODELS;
      }
    } catch {
      models = DEFAULT_SEED_MODELS;
    }
  } else {
    // Mock database read
    try {
      const saved = localStorage.getItem("claude_clone_mock_models");
      if (saved) {
        models = JSON.parse(saved);
      } else {
        models = DEFAULT_SEED_MODELS;
      }
    } catch {
      models = DEFAULT_SEED_MODELS;
    }
  }

  if (!all) {
    const enabledOnly = models.filter(m => m.enabled);
    cachedModels = enabledOnly;
    cacheExpiry = Date.now() + 60000;
    return enabledOnly;
  }

  return models;
}

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

// POST /api/models (Admin only)
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await checkIsAdmin(req.user?.id || "");
    if (!isAdmin) {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }

    const modelData = req.body;
    if (isRealSupabaseConfigured && supabaseServer) {
      const { data, error } = await supabaseServer.from("models").insert(modelData).select();
      if (error) throw error;
      invalidateModelCache();
      res.status(201).json(data[0]);
    } else {
      // Mock db insertion
      const saved = localStorage.getItem("claude_clone_mock_models");
      const current = saved ? JSON.parse(saved) : DEFAULT_SEED_MODELS;
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
    const modelData = req.body;

    if (isRealSupabaseConfigured && supabaseServer) {
      const { data, error } = await supabaseServer.from("models").update(modelData).eq("id", id).select();
      if (error) throw error;
      invalidateModelCache();
      res.json(data[0]);
    } else {
      const saved = localStorage.getItem("claude_clone_mock_models");
      const current = saved ? JSON.parse(saved) : DEFAULT_SEED_MODELS;
      let updatedItem = null;
      const updated = current.map((item: any) => {
        if (item.id === id) {
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
      const current = saved ? JSON.parse(saved) : DEFAULT_SEED_MODELS;
      const filtered = current.filter((item: any) => item.id !== id);
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
    const targetModel = all.find(m => m.id === req.params.id || m.slug === req.params.id);
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
    const target = all.find(m => m.slug === req.params.slug || m.id === req.params.slug);
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
