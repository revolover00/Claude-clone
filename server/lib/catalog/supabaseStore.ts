/** Supabase-backed catalog persistence. The app only probes and uses an existing schema; it never runs migrations. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CatalogRecord, CatalogStore, OverrideRecord, SyncRun, SyncStatus } from "./types";
import { recordChanged } from "./store";
import { startCatalogSchemaProbe } from "./schemaProbe";

function readConfig() {
  return {
    url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

export function isSupabaseCatalogAvailable(): boolean {
  const { url, serviceKey } = readConfig();
  return Boolean(url && serviceKey && !url.includes("YOUR_") && !serviceKey.includes("YOUR_"));
}

const RECORD_COLUMNS =
  "provider, model_id, name, description, vendor, family, kind, status, context_length, max_output_tokens, input_modalities, output_modalities, supports_tools, supports_vision, supports_reasoning, supports_json, is_free, is_recommended, pricing, released_at, source, first_seen_at, last_seen_at, last_synced_at";

function messageOf(error: any): string {
  return String(error?.message || error || "Unknown database error");
}

function warn(scope: string, error: any): void {
  console.warn(`[Catalog] ${scope}: ${messageOf(error)}`);
}

async function recordOverrideWriteFailure(client: SupabaseClient, provider: string, message: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    const { error } = await client.from("catalog_sync_runs").insert({
      provider,
      trigger: "catalog-write",
      status: "failed",
      started_at: now,
      finished_at: now,
      added: 0,
      updated: 0,
      removed: 0,
      total: 0,
      error: message.slice(0, 2000),
    });
    if (error) throw error;
  } catch (error) {
    console.error(`[Catalog] could not record failed write in catalog_sync_runs: ${messageOf(error)}`);
  }
}

export function createSupabaseCatalogStore(clientOverride?: SupabaseClient): CatalogStore {
  const { url, serviceKey } = readConfig();
  const client = clientOverride || createClient(url, serviceKey);
  void startCatalogSchemaProbe(client);

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
      if (read.error) {
        warn("upsert pre-read failed", read.error);
        throw new Error(`Catalog upsert pre-read failed: ${messageOf(read.error)}`);
      }
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
        return { ...record, first_seen_at: before.first_seen_at };
      });

      const { error } = await client.from("provider_catalog").upsert(payload, { onConflict: "provider,model_id" });
      if (error) {
        warn("upsert failed", error);
        throw new Error(`Catalog upsert failed: ${messageOf(error)}`);
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
        throw new Error(`Catalog markRemoved failed: ${messageOf(error)}`);
      }
      return modelIds.length;
    },

    async setRecommended(entries): Promise<void> {
      for (const entry of entries) {
        const { error } = await client
          .from("provider_catalog")
          .update({ is_recommended: entry.value })
          .eq("provider", entry.provider)
          .eq("model_id", entry.model_id);
        if (error) {
          warn("setRecommended failed", error);
          throw new Error(`Catalog setRecommended failed: ${messageOf(error)}`);
        }
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
      if (error) {
        warn("insertRun failed", error);
        throw new Error(`Catalog sync-run write failed: ${messageOf(error)}`);
      }
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
      const { data, error } = await client.from("catalog_sync_runs").select("id").gt("started_at", cutoff).limit(1);
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
      const { error } = await client.from("catalog_overrides").upsert(record, { onConflict: "provider,model_id" });
      if (!error) return;
      const message = `catalog_overrides upsert failed: ${messageOf(error)}`;
      warn("saveOverride failed", error);
      await recordOverrideWriteFailure(client, record.provider, message);
      throw new Error(message);
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
