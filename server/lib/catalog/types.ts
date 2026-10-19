/**
 * Types for the automatic model catalog layer.
 *
 * The catalog tables and app_settings already exist in the database. All
 * access goes through `CatalogStore` so the
 * sync engine, routes and tests share one shape. Column assumptions are
 * documented on the Supabase store implementation.
 */

export type CatalogStatus = "active" | "preview" | "deprecated" | "removed";

export interface CatalogPricing {
  /** USD per 1M tokens. null means variable pricing (shown as "Variable"). */
  inputPerMTok: number | null;
  outputPerMTok: number | null;
  currency: string;
}

/** One row of provider_catalog (normalized + classified). */
export interface CatalogRecord {
  provider: string;
  model_id: string;
  name: string;
  description: string | null;
  vendor: string;
  family: string;
  kind: string;
  status: CatalogStatus;
  context_length: number | null;
  max_output_tokens: number | null;
  input_modalities: string[];
  output_modalities: string[];
  supports_tools: boolean;
  supports_vision: boolean;
  supports_reasoning: boolean;
  supports_json: boolean;
  is_free: boolean;
  is_recommended: boolean;
  pricing: CatalogPricing | null;
  released_at: string | null;
  source: string;
  first_seen_at: string;
  last_seen_at: string;
  last_synced_at: string;
}

/** Normalized model as produced by a provider fetcher, before classification. */
export interface SyncedModel {
  model_id: string;
  name: string;
  description?: string | null;
  context_length?: number | null;
  max_output_tokens?: number | null;
  input_modalities?: string[];
  output_modalities?: string[];
  supports_tools?: boolean;
  supports_vision?: boolean;
  supports_reasoning?: boolean;
  supports_json?: boolean;
  pricing?: CatalogPricing | null;
  released_at?: string | null;
  /** API-reported expiration date — makes the model deprecated. */
  expires_at?: string | null;
  owned_by?: string | null;
  generation_methods?: string[];
  raw?: any;
}

export type SyncStatus = "success" | "partial" | "failed";

export type CatalogDbStatus = "ok" | "schema_mismatch" | "unreachable";

export interface SyncRun {
  id?: string;
  provider: string;
  trigger: string;
  status: SyncStatus;
  started_at: string;
  finished_at: string;
  added: number;
  updated: number;
  removed: number;
  total: number;
  error: string | null;
}

export interface SyncOutcome {
  status: SyncStatus;
  added: number;
  updated: number;
  removed: number;
  total: number;
  error: string | null;
}

export interface OverrideRecord {
  provider: string;
  model_id: string;
  hidden: boolean;
  force_recommended: boolean;
  alias: string | null;
  /** Optional admin pick for the app default model. */
  is_default?: boolean;
}

export interface CatalogStore {
  list(provider?: string): Promise<CatalogRecord[]>;
  /** Upsert by (provider, model_id). first_seen_at is only set on insert. */
  upsert(records: CatalogRecord[]): Promise<{ added: number; updated: number }>;
  markRemoved(provider: string, modelIds: string[], now: string): Promise<number>;
  setRecommended(entries: Array<{ provider: string; model_id: string; value: boolean }>): Promise<void>;
  insertRun(run: SyncRun): Promise<void>;
  listRuns(provider?: string, limit?: number): Promise<SyncRun[]>;
  /** True when another run started less than `ms` ago (multi-instance lock). */
  recentRunWithin(ms: number, now?: string): Promise<boolean>;
  newestSyncedAt(): Promise<string | null>;
  getOverrides(): Promise<OverrideRecord[]>;
  saveOverride(record: OverrideRecord): Promise<void>;
  getAppSetting<T = any>(key: string): Promise<T | null>;
}
