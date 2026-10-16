/**
 * Supabase-backed CatalogStore.
 *
 * Assumes the tables already exist (no migrations are run from the app):
 *
 *   provider_catalog(provider, model_id, name, description, vendor, family,
 *     kind, status, context_length, max_output_tokens, input_modalities,
 *     output_modalities, supports_tools, supports_vision, supports_reasoning,
 *     supports_json, is_free, is_recommended, pricing, released_at, source,
 *     first_seen_at, last_seen_at, last_synced_at) with UNIQUE(provider, model_id)
 *   catalog_sync_runs(provider, trigger, status, started_at, finished_at,
 *     added, updated, removed, total, error)
 *   catalog_overrides(provider, model_id, hidden, force_recommended, alias)
 *   app_settings(key, value)
 *
 * Every write is best-effort: a schema mismatch logs a warning instead of
 * taking the API down, and reads degrade to an empty list.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { CatalogRecord, CatalogStore, OverrideRecord, SyncRun, SyncStatus } from "./types";
import { recordChanged } from "./store";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function isSupabaseCatalogAvailable(): boolean {
  return Boolean(supabaseUrl && serviceKey && !supabaseUrl.includes("YOUR_") && !serviceKey.includes("YOUR_"));
}

const RECORD_COLUMNS =
  "provider, model_id, name, description, vendor, family, kind, status, context_length, max_output_tokens, input_modalities, output_modalities, supports_tools, supports_vision, supports_reasoning, supports_json, is_free, is_recommended, pricing, released_at, source, first_seen_at, last_seen_at, last_synced_at";

function warn(scope: string, error: any): void {
  console.warn(`[Catalog] ${scope}:`, error?.message || error);
}

export function createSupabaseCatalogStore(): CatalogStore {
  const client: SupabaseClient = createClient(supabaseUrl, serviceKey);

  const store: CatalogStore = {
    async list(provider?: string): Promise<CatalogRecord[]> {
      let query = client.from("provider_catalog").select(RECORD_COLUMNS);
      if (provider) query = query.eq("provider", provider);
      const { data, error } = await query;
      if (error) {
        warn("list failed", error);
        return [];
      }
      return (data || []) as CatalogRecord[];
    },

    async upsert(records: CatalogRecord[]): Promise<{ added: number; updated: number }> {
      if (records.length === 0) return { added: 0, updated: 0 };
      const provider = records[0].provider;
      const ids = records.map((r) => r.model_id);

      const read = await client.from("provider_catalog").select(RECORD_COLUMNS).eq("provider", provider).in("model_id", ids);
      if (read.error) warn("upsert pre-read failed", read.error);
      const existing = (read.data || []) as CatalogRecord[];
      const byId = new Map(existing.map((row) => [row.model_id, row]));

      let added = 0;
      let updated = 0;
      const payload = records.map((record) => {
        const before = byId.get(record.model_id);
        if (!before) {
          added++;
          return record;
        }
        if (recordChanged(before, record)) updated++;
        // first_seen_at must survive the upsert untouched.
        return { ...record, first_seen_at: before.first_seen_at };
      });

      const { error } = await client.from("provider_catalog").upsert(payload, { onConflict: "provider,model_id" });
      if (error) {
        warn("upsert failed", error);
        return { added: 0, updated: 0 };
      }
      return { added, updated };
    },

    async markRemoved(provider: string, modelIds: string[], _now: string): Promise<number> {
      if (modelIds.length === 0) return 0;
      const { error } = await client
        .from("provider_catalog")
        .update({ status: "removed" })
        .eq("provider", provider)
        .in("model_id", modelIds)
        .neq("status", "removed");
      if (error) {
        warn("markRemoved failed", error);
        return 0;
      }
      return modelIds.length;
    },

    async setRecommended(entries): Promise<void> {
      if (entries.length === 0) return;
      for (const entry of entries) {
        const { error } = await client
          .from("provider_catalog")
          .update({ is_recommended: entry.value })
          .eq("provider", entry.provider)
          .eq("model_id", entry.model_id);
        if (error) warn("setRecommended failed", error);
      }
    },

    async insertRun(run: SyncRun): Promise<void> {
      const { error } = await client.from("catalog_sync_runs").insert({
        provider: run.provider,
        trigger: run.trigger,
        status: run.status,
        started_at: run.started_at,
        finished_at: run.finished_at,
        added: run.added,
        updated: run.updated,
        removed: run.removed,
        total: run.total,
        error: run.error,
      });
      if (error) warn("insertRun failed", error);
    },

    async listRuns(provider?: string, limit = 20): Promise<SyncRun[]> {
      let query = client.from("catalog_sync_runs").select("*").order("started_at", { ascending: false }).limit(limit);
      if (provider) query = query.eq("provider", provider);
      const { data, error } = await query;
      if (error) {
        warn("listRuns failed", error);
        return [];
      }
      return (data || []) as SyncRun[];
    },

    async recentRunWithin(ms: number, now = new Date().toISOString()): Promise<boolean> {
      const cutoff = new Date(Date.parse(now) - ms).toISOString();
      const { data, error } = await client
        .from("catalog_sync_runs")
        .select("id")
        .gt("started_at", cutoff)
        .limit(1);
      if (error) {
        warn("recentRunWithin failed", error);
        return false;
      }
      return (data || []).length > 0;
    },

    async newestSyncedAt(): Promise<string | null> {
      const { data, error } = await client
        .from("provider_catalog")
        .select("last_synced_at")
        .not("last_synced_at", "is", null)
        .order("last_synced_at", { ascending: false })
        .limit(1);
      if (error) {
        warn("newestSyncedAt failed", error);
        return null;
      }
      return data && data[0] ? (data[0] as any).last_synced_at : null;
    },

    async getOverrides(): Promise<OverrideRecord[]> {
      const { data, error } = await client.from("catalog_overrides").select("*");
      if (error) {
        warn("getOverrides failed", error);
        return [];
      }
      return (data || []) as OverrideRecord[];
    },

    async saveOverride(record: OverrideRecord): Promise<void> {
      const { error } = await client
        .from("catalog_overrides")
        .upsert(record, { onConflict: "provider,model_id" });
      if (error) warn("saveOverride failed", error);
    },

    async getAppSetting<T = any>(key: string): Promise<T | null> {
      const { data, error } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
      if (error) {
        warn("getAppSetting failed", error);
        return null;
      }
      return data ? ((data as any).value as T) : null;
    },
  };

  return store;
}

export type CatalogSyncStatus = SyncStatus;
