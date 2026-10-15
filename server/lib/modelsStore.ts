import { createClient } from "@supabase/supabase-js";
import { FALLBACK_MODELS, type FallbackModel as Model } from "../../src/shared/fallbackModels";
import { normalizeSlug } from "../../src/hooks/useModels";

export type { Model };
export { FALLBACK_MODELS };


const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const isRealSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseServiceKey && 
  !supabaseUrl.includes("YOUR_") && 
  !supabaseServiceKey.includes("YOUR_")
);

export const supabaseServer = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

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
        models = FALLBACK_MODELS;
      }
    } catch {
      models = FALLBACK_MODELS;
    }
  } else {
    try {
      const saved = localStorage.getItem("claude_clone_mock_models");
      if (saved) {
        models = JSON.parse(saved);
      } else {
        models = FALLBACK_MODELS;
      }
    } catch {
      models = FALLBACK_MODELS;
    }
  }

  models = models.map((m: any) => ({
    ...m,
    slug: normalizeSlug(m.slug),
  }));

  if (!all) {
    const enabledOnly = models.filter((m) => m.enabled);
    cachedModels = enabledOnly;
    cacheExpiry = Date.now() + 60000;
    return enabledOnly;
  }

  return models;
}
