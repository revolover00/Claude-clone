import { createClient } from "@supabase/supabase-js";
import { FALLBACK_MODELS, type FallbackModel as Model } from "../../src/shared/fallbackModels";
import { normalizeSlug } from "../../src/shared/normalizeSlug";
import { getAppModelRows, invalidateAppModelCache } from "./catalog/appModels";

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
  invalidateAppModelCache();
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

/**
 * The app's own model list, derived from provider_catalog (see
 * server/lib/catalog/appModels.ts): catalog rows first, live Gemini fetch
 * second, the shared fallback list only when both fail. The manual `models`
 * table is intentionally never read or written anymore (read-only for
 * backward compatibility).
 */
export async function getModelsFromDB(all = false): Promise<any[]> {
  if (!all && cachedModels && Date.now() < cacheExpiry) {
    return cachedModels;
  }

  const rows = await getAppModelRows();
  const models = rows.map((m: any) => ({
    ...m,
    slug: normalizeSlug(m.slug),
    enabled: m.enabled !== false,
  }));
  const enabledOnly = models.filter((m) => m.enabled);

  if (!all) {
    cachedModels = enabledOnly;
    cacheExpiry = Date.now() + 60000;
    return enabledOnly;
  }

  return models;
}
