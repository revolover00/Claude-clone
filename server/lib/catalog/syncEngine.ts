/**
 * The catalog sync engine: applies a fetched provider model list to
 * provider_catalog and records catalog_sync_runs rows.
 *
 * Rules enforced here:
 * - Upsert by (provider, model_id); first_seen_at only on insert, while
 *   last_seen_at / last_synced_at always update.
 * - A model missing from two consecutive SUCCESSFUL full syncs becomes
 *   "removed" (rows are never deleted — conversations may reference them).
 * - Models are never marked removed when the fetch failed or returned less
 *   than 50% of the previous count (status "partial", removals skipped).
 */
import type { CatalogRecord, CatalogStore, SyncedModel, SyncOutcome, SyncRun } from "./types";
import { familyOf, kindOf, releasedAtOf, statusOf, vendorOf } from "./classify";
import { refreshRecommendations } from "./recommend";

/** Fields compared for the added/updated counters (timestamps excluded). */
function buildRecord(provider: string, source: string, model: SyncedModel, now: string): CatalogRecord {
  const status = statusOf(model);
  return {
    provider,
    model_id: model.model_id,
    name: model.name || model.model_id,
    description: model.description ?? null,
    vendor: vendorOf(provider, model.model_id, model.owned_by),
    family: familyOf(provider, model.model_id, model.name || model.model_id),
    kind: kindOf(model),
    status,
    context_length: model.context_length ?? null,
    max_output_tokens: model.max_output_tokens ?? null,
    input_modalities: model.input_modalities?.length ? model.input_modalities : ["text"],
    output_modalities: model.output_modalities?.length ? model.output_modalities : ["text"],
    supports_tools: Boolean(model.supports_tools),
    supports_vision: Boolean(model.supports_vision),
    supports_reasoning: Boolean(model.supports_reasoning),
    supports_json: Boolean(model.supports_json),
    is_free: Boolean(model.pricing && (model.pricing.inputPerMTok ?? 1) === 0 && (model.pricing.outputPerMTok ?? 1) === 0),
    is_recommended: false,
    pricing: model.pricing ?? null,
    released_at: releasedAtOf(provider, model),
    source,
    first_seen_at: now,
    last_seen_at: now,
    last_synced_at: now,
  };
}

/** Successful runs for this provider that started after `since` (removal rule). */
async function successfulRunsSince(store: CatalogStore, provider: string, since: string): Promise<number> {
  const runs = await store.listRuns(provider, 50);
  return runs.filter((r) => r.status === "success" && r.started_at > since).length;
}

async function persistFailedRun(store: CatalogStore, run: SyncRun): Promise<void> {
  try {
    await store.insertRun(run);
  } catch (error: any) {
    console.error(`[Catalog] failed to persist sync error for ${run.provider}:`, error?.message || error);
  }
}

export interface SyncProviderOptions {
  trigger: string;
  /** Injection point for deterministic tests. */
  now?: string;
}

/**
 * Applies one provider's fetched models to the store and writes the run row.
 * Returns the outcome (also persisted as a catalog_sync_runs row).
 */
export async function syncProviderWithModels(
  store: CatalogStore,
  provider: string,
  source: string,
  incoming: SyncedModel[],
  options: SyncProviderOptions
): Promise<SyncOutcome> {
  const now = options.now || new Date().toISOString();
  const previous = (await store.list(provider)).filter((r) => r.status !== "removed");

  let removed = 0;
  let status: SyncOutcome["status"] = "success";
  let error: string | null = null;

  const records = incoming.map((model) => buildRecord(provider, source, model, now));
  const { added, updated } = await store.upsert(records);

  // Partial-response guard: never mark removals from an incomplete fetch.
  const guardTripped = previous.length > 0 && incoming.length < previous.length * 0.5;
  if (guardTripped) {
    status = "partial";
    error = `guard: received ${incoming.length} of ${previous.length} known models; removals skipped`;
  } else {
    const seen = new Set(incoming.map((m) => m.model_id));
    const missing = previous.filter((row) => !seen.has(row.model_id) && row.status !== "removed");
    const toRemove: string[] = [];
    for (const row of missing) {
      // Successful runs after the model was last seen, plus this run itself
      // (which is succeeding right now): removal needs two consecutive misses.
      const runsSince = await successfulRunsSince(store, provider, row.last_seen_at);
      if (runsSince + 1 >= 2) toRemove.push(row.model_id);
    }
    removed = await store.markRemoved(provider, toRemove, now);
  }

  await refreshRecommendations(store, provider, Date.parse(now));

  const total = await store.list(provider);
  const outcome: SyncOutcome = { status, added, updated, removed, total: total.length, error };
  const run: SyncRun = {
    provider,
    trigger: options.trigger,
    status,
    started_at: now,
    finished_at: new Date().toISOString(),
    added,
    updated,
    removed,
    total: total.length,
    error,
  };
  await store.insertRun(run);
  return outcome;
}

/**
 * Fetch-failure wrapper: writes a "failed" run row (counts zero, no removals)
 * so every run is recorded, per spec.
 */
export async function syncProviderFetching(
  store: CatalogStore,
  provider: string,
  fetcher: () => Promise<{ source: string; models: SyncedModel[] } | null>,
  options: SyncProviderOptions
): Promise<SyncOutcome> {
  const now = options.now || new Date().toISOString();
  let fetched: { source: string; models: SyncedModel[] } | null = null;
  let failure: string | null = null;
  try {
    fetched = await fetcher();
  } catch (err: any) {
    failure = err?.message || String(err);
  }

  if (!fetched) {
    // Missing key (gemini/groq) or fetch error: record the run, change nothing.
    const outcome: SyncOutcome = {
      status: failure ? "failed" : "success",
      added: 0,
      updated: 0,
      removed: 0,
      total: (await store.list(provider)).length,
      error: failure || (provider === "openrouter" ? "fetch returned nothing" : "skipped: catalog key not configured"),
    };
    if (failure || provider === "openrouter") {
      await persistFailedRun(store, {
        provider,
        trigger: options.trigger,
        status: "failed",
        started_at: now,
        finished_at: new Date().toISOString(),
        added: 0,
        updated: 0,
        removed: 0,
        total: outcome.total,
        error: outcome.error,
      });
    }
    return outcome;
  }

  try {
    return await syncProviderWithModels(store, provider, fetched.source, fetched.models, options);
  } catch (err: any) {
    const message = err?.message || String(err);
    await persistFailedRun(store, {
      provider,
      trigger: options.trigger,
      status: "failed",
      started_at: now,
      finished_at: new Date().toISOString(),
      added: 0,
      updated: 0,
      removed: 0,
      total: (await store.list(provider)).length,
      error: message,
    });
    return { status: "failed", added: 0, updated: 0, removed: 0, total: 0, error: message };
  }
}
