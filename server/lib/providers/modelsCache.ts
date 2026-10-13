import { getSupabaseClient } from "../skills/db";
import { ModelInfo } from "./types";

const memoryModelPrefs = new Map<string, any[]>();
const modelsCache = new Map<string, { data: ModelInfo[]; timestamp: number }>();

export async function getCachedModels(
  userId: string,
  providerId: string,
  fetchFn: () => Promise<ModelInfo[]>,
  forceRefresh = false
): Promise<ModelInfo[]> {
  const cacheKey = providerId === "openrouter" ? "openrouter:public" : `${userId}:${providerId}`;
  const now = Date.now();
  const cached = modelsCache.get(cacheKey);

  if (!forceRefresh && cached && now - cached.timestamp < 60 * 60 * 1000) {
    return cached.data;
  }

  try {
    const fresh = await fetchFn();
    modelsCache.set(cacheKey, { data: fresh, timestamp: now });
    return fresh;
  } catch (err) {
    // Stale-while-revalidate on provider failure
    if (cached) {
      console.warn(`[Providers] Provider fetch failed, returning stale cache for ${providerId}:`, err);
      return cached.data;
    }
    throw err;
  }
}

export async function saveModelPrefs(
  userId: string,
  prefs: Array<{ provider: string; modelId: string; enabled?: boolean; pinned?: boolean; alias?: string }>
): Promise<number> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const rows = prefs.map((p) => ({
      user_id: userId,
      provider: p.provider,
      model_id: p.modelId,
      enabled: p.enabled ?? true,
      pinned: p.pinned ?? false,
      alias: p.alias || null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("user_model_prefs").upsert(rows, { onConflict: "user_id,provider,model_id" });
    if (error) throw error;
    return rows.length;
  }

  // Memory fallback
  const userPrefs = memoryModelPrefs.get(userId) || [];
  for (const p of prefs) {
    const idx = userPrefs.findIndex((up) => up.provider === p.provider && up.model_id === p.modelId);
    const item = {
      user_id: userId,
      provider: p.provider,
      model_id: p.modelId,
      enabled: p.enabled ?? true,
      pinned: p.pinned ?? false,
      alias: p.alias || null,
    };
    if (idx >= 0) userPrefs[idx] = item;
    else userPrefs.push(item);
  }
  memoryModelPrefs.set(userId, userPrefs);
  return prefs.length;
}

export async function getUserModelPrefs(userId: string, providerId: string): Promise<Record<string, any>> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from("user_model_prefs")
      .select("model_id, enabled, pinned, alias")
      .eq("user_id", userId)
      .eq("provider", providerId);
    if (data) {
      return Object.fromEntries(data.map((p: any) => [p.model_id, p]));
    }
  }

  const userPrefs = memoryModelPrefs.get(userId) || [];
  const filtered = userPrefs.filter((p) => p.provider === providerId);
  return Object.fromEntries(filtered.map((p) => [p.model_id, p]));
}
