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
  prefs: Array<{ provider: string; modelId?: string; model_id?: string; enabled?: boolean; pinned?: boolean; alias?: string }>
): Promise<number> {
  // Callers historically sent either camelCase or snake_case model ids.
  const normalized = prefs.map((p) => ({ ...p, modelId: p.modelId ?? p.model_id ?? "" })).filter((p) => p.modelId);
  const supabase = getSupabaseClient();
  if (supabase) {
    const rows = normalized.map((p) => ({
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
  for (const p of normalized) {
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
  return normalized.length;
}

export async function getUserModelPrefs(userId: string, providerId: string): Promise<Record<string, any>> {
  const rows = await getUserModelPrefsAll(userId);
  return Object.fromEntries(rows.filter((p) => p.provider === providerId).map((p) => [p.model_id, p]));
}

/** Every preference row of one user across all providers (catalog merging). */
export async function getUserModelPrefsAll(
  userId: string
): Promise<Array<{ provider: string; model_id: string; enabled: boolean; pinned: boolean; alias: string | null }>> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from("user_model_prefs")
      .select("provider, model_id, enabled, pinned, alias")
      .eq("user_id", userId);
    if (data) {
      return data.map((p: any) => ({
        provider: p.provider,
        model_id: p.model_id,
        enabled: p.enabled ?? true,
        pinned: p.pinned ?? false,
        alias: p.alias || null,
      }));
    }
  }

  return (memoryModelPrefs.get(userId) || []).map((p: any) => ({
    provider: p.provider,
    model_id: p.model_id,
    enabled: p.enabled ?? true,
    pinned: p.pinned ?? false,
    alias: p.alias || null,
  }));
}
