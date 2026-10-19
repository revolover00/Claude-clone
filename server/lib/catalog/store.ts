/**
 * Catalog persistence: an in-memory store (dev/tests, no Supabase) and the
 * factory used by routes, the sync engine and the app-model derivation.
 */
import type { CatalogRecord, OverrideRecord, SyncRun, CatalogStore } from "./types";
import { createSupabaseCatalogStore, isSupabaseCatalogAvailable } from "./supabaseStore";
import { getCatalogSchemaHealth } from "./schemaProbe";

function recordKey(provider: string, modelId: string): string {
  return `${provider}:${modelId}`;
}

const SYNCED_FIELDS: Array<keyof CatalogRecord> = [
  "name", "description", "vendor", "family", "kind", "status", "context_length",
  "max_output_tokens", "input_modalities", "output_modalities", "supports_tools",
  "supports_vision", "supports_reasoning", "supports_json", "is_free",
  "pricing", "released_at", "source",
];

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function recordChanged(before: CatalogRecord, after: CatalogRecord): boolean {
  return SYNCED_FIELDS.some((field) => !sameValue(before[field], after[field]));
}

export class MemoryCatalogStore implements CatalogStore {
  private rows = new Map<string, CatalogRecord>();
  private runs: SyncRun[] = [];
  private overrides = new Map<string, OverrideRecord>();
  private settings = new Map<string, any>();

  async list(provider?: string): Promise<CatalogRecord[]> {
    const all = [...this.rows.values()];
    return provider ? all.filter((r) => r.provider === provider) : all;
  }

  async upsert(records: CatalogRecord[]): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;
    for (const record of records) {
      const key = recordKey(record.provider, record.model_id);
      const existing = this.rows.get(key);
      if (!existing) {
        this.rows.set(key, { ...record, first_seen_at: record.first_seen_at, last_seen_at: record.last_seen_at, last_synced_at: record.last_synced_at });
        added++;
      } else if (recordChanged(existing, record)) {
        this.rows.set(key, {
          ...existing,
          ...record,
          first_seen_at: existing.first_seen_at,
          last_seen_at: record.last_seen_at,
          last_synced_at: record.last_synced_at,
          is_recommended: existing.is_recommended,
        });
        updated++;
      } else {
        // Data unchanged — only the seen/synced timestamps move (per spec).
        this.rows.set(key, {
          ...existing,
          last_seen_at: record.last_seen_at,
          last_synced_at: record.last_synced_at,
        });
      }
    }
    return { added, updated };
  }

  async markRemoved(provider: string, modelIds: string[], _now: string): Promise<number> {
    let removed = 0;
    for (const modelId of modelIds) {
      const row = this.rows.get(recordKey(provider, modelId));
      if (row && row.status !== "removed") {
        row.status = "removed";
        removed++;
      }
    }
    return removed;
  }

  async setRecommended(entries: Array<{ provider: string; model_id: string; value: boolean }>): Promise<void> {
    for (const entry of entries) {
      const row = this.rows.get(recordKey(entry.provider, entry.model_id));
      if (row) row.is_recommended = entry.value;
    }
  }

  async insertRun(run: SyncRun): Promise<void> {
    this.runs.unshift({ ...run });
    if (this.runs.length > 200) this.runs.length = 200;
  }

  async listRuns(provider?: string, limit = 20): Promise<SyncRun[]> {
    const filtered = provider ? this.runs.filter((r) => r.provider === provider) : this.runs;
    return filtered.slice(0, limit).map((r) => ({ ...r }));
  }

  async recentRunWithin(ms: number, now = new Date().toISOString()): Promise<boolean> {
    const cutoff = Date.parse(now) - ms;
    return this.runs.some((r) => Date.parse(r.started_at) >= cutoff);
  }

  async newestSyncedAt(): Promise<string | null> {
    let newest: string | null = null;
    this.rows.forEach((row) => {
      if (row.last_synced_at && (!newest || row.last_synced_at > newest)) newest = row.last_synced_at;
    });
    return newest;
  }

  async getOverrides(): Promise<OverrideRecord[]> {
    return [...this.overrides.values()].map((o) => ({ ...o }));
  }

  async saveOverride(record: OverrideRecord): Promise<void> {
    this.overrides.set(recordKey(record.provider, record.model_id), { ...record });
  }

  async getAppSetting<T = any>(key: string): Promise<T | null> {
    return this.settings.has(key) ? (this.settings.get(key) as T) : null;
  }

  /** Test/dev helper: wipe everything. */
  reset(): void {
    this.rows.clear();
    this.runs = [];
    this.overrides.clear();
    this.settings.clear();
  }
}

export const memoryCatalogStore = new MemoryCatalogStore();

let resolved: CatalogStore | null = null;

/** Supabase-backed store when configured, otherwise the in-memory store. */
export function getCatalogStore(): CatalogStore {
  if (!resolved) {
    resolved = isSupabaseCatalogAvailable() ? createSupabaseCatalogStore() : memoryCatalogStore;
  }
  return resolved;
}

/** Initializes the selected store and awaits its read-only startup schema probe. */
export async function initializeCatalogStore(): Promise<void> {
  getCatalogStore();
  await getCatalogSchemaHealth();
}

/** Test hook: replace or reset the resolved store. */
export function setCatalogStore(store: CatalogStore | null): void {
  resolved = store;
}
