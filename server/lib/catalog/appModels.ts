/**
 * The app's own Gemini model list, derived from provider_catalog.
 *
 * Chain: catalog rows (chat kind, active/preview) -> the shared fallback list,
 * which is the only hard-coded list and is used only when the catalog is empty.
 * The server never ships an AI key, so there is no env-based live fetch.
 *
 * Default resolution: app_settings "default_model" (admin) > catalog_overrides
 * marked is_default > the best recommended Gemini Flash model.
 */
import { FALLBACK_MODELS, type FallbackModel } from "../../../src/shared/fallbackModels";
import { normalizeSlug } from "../../../src/shared/normalizeSlug";
import { getCatalogStore } from "./store";
import type { CatalogRecord } from "./types";
import type { AppModelRow } from "../../../src/shared/catalog/appModels";

const STATUS_OK = new Set(["active", "preview"]);

let chainCache: { rows: AppModelRow[]; at: number } | null = null;

export function invalidateAppModelCache(): void {
  chainCache = null;
}

function recordToRow(record: CatalogRecord, sortOrder: number): AppModelRow {
  return {
    id: `gemini:${record.model_id}`,
    slug: record.model_id,
    display_name: record.name,
    description: describe(record),
    provider: "google",
    api_model_id: record.model_id,
    kind: "chat",
    supports_thinking: record.supports_reasoning,
    supports_tools: record.supports_tools,
    supports_search: record.kind === "chat",
    supports_vision: record.supports_vision,
    max_output_tokens: record.max_output_tokens,
    enabled: true,
    is_default: false,
    sort_order: sortOrder,
    vendor: record.vendor,
    family: record.family,
    context_length: record.context_length,
    pricing: record.pricing,
    release_date: record.released_at,
    knowledge_cutoff: null,
    catalog_source: "catalog",
    recommended: record.is_recommended,
    status: record.status,
  };
}

function describe(record: CatalogRecord): string {
  const bits: string[] = [];
  if (record.context_length) bits.push(`${Math.round(record.context_length / 1000)}k context`);
  if (record.supports_reasoning) bits.push("reasoning");
  if (record.supports_tools) bits.push("tools");
  if (record.supports_vision) bits.push("vision");
  return bits.length > 0 ? bits.join(" · ") : `${record.name} via the model catalog.`;
}

/** Rows derived from provider_catalog: gemini chat models that are not removed. */
export async function catalogAppRows(): Promise<AppModelRow[]> {
  try {
    const store = getCatalogStore();
    const records = (await store.list("gemini")).filter((r) => r.kind === "chat" && STATUS_OK.has(r.status));
    records.sort((a, b) => (b.released_at || "").localeCompare(a.released_at || "") || a.model_id.localeCompare(b.model_id));
    return records.map((record, index) => recordToRow(record, index + 1));
  } catch {
    return [];
  }
}

/** Marks the admin default (app_settings or catalog_overrides), else best Flash. */
async function applyDefault(rows: AppModelRow[]): Promise<AppModelRow[]> {
  if (rows.length === 0) return rows;
  let defaultKey: string | null = null;
  try {
    const setting = await getCatalogStore().getAppSetting<string | null>("default_model");
    if (typeof setting === "string" && setting) defaultKey = setting;
  } catch {
    /* ignore */
  }
  if (!defaultKey) {
    try {
      const overrides = await getCatalogStore().getOverrides();
      const forced = overrides.find((o) => o.is_default);
      if (forced) defaultKey = forced.model_id;
    } catch {
      /* ignore */
    }
  }

  const choose = (): AppModelRow => {
    if (defaultKey) {
      const wanted = normalizeSlug(defaultKey.replace(/^gemini:/, "").replace(/^google:/, ""));
      const match = rows.find((r) => r.slug === wanted || r.id === defaultKey || r.api_model_id === wanted);
      if (match) return match;
    }
    // Best recommended Gemini Flash model, newest release first.
    const flash = rows.filter((r) => /flash/i.test(r.slug));
    const pool = flash.some((r: any) => r.recommended) ? flash.filter((r: any) => r.recommended) : flash;
    const sorted = [...pool].sort(
      (a, b) => String(b.release_date || "").localeCompare(String(a.release_date || "")) || String(b.slug).localeCompare(String(a.slug))
    );
    if (sorted.length > 0) return sorted[0];
    // Fallback rows already carry exactly one is_default flag.
    return rows.find((r) => r.is_default) || rows[0];
  };

  const winner = choose();
  return rows.map((r) => ({ ...r, is_default: r.id === winner.id }));
}

/** Full derivation chain with a short-lived cache. */
export async function getAppModelRows(): Promise<AppModelRow[]> {
  if (chainCache && Date.now() - chainCache.at < 30_000) return chainCache.rows;
  // Catalog rows first; the shared fallback list only when the catalog is empty
  // (there is no server-side live fetch anymore — the server ships no AI key).
  let rows = await catalogAppRows();
  if (rows.length === 0) {
    rows = (FALLBACK_MODELS as FallbackModel[]).map((m, index) => ({
      ...m,
      vendor: "Google",
      catalog_source: "fallback",
      sort_order: index + 1,
    })) as AppModelRow[];
  }
  rows = await applyDefault(rows);
  chainCache = { rows, at: Date.now() };
  return rows;
}
