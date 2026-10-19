import { FALLBACK_MODELS } from "../fallbackModels";
import { getCatalogModels } from "./index";
import type { CatalogModel, CatalogPricing } from "./types";

/** Row shape of the app `models` table (Supabase or in-process fallback). */
export interface AppModelRow {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  provider: string;
  api_model_id: string;
  kind: "chat" | "light" | "embedding";
  supports_thinking: boolean;
  supports_tools: boolean;
  supports_search: boolean;
  supports_vision: boolean;
  max_output_tokens: number | null;
  enabled: boolean;
  is_default: boolean;
  sort_order: number;
  vendor?: string;
  family?: string;
  context_length?: number | null;
  pricing?: CatalogPricing | null;
  release_date?: string | null;
  knowledge_cutoff?: string | null;
  catalog_source?: string;
  /** Derived from provider_catalog: deterministic per-family recommendation. */
  recommended?: boolean;
  /** Lifecycle status from the catalog: active, preview, deprecated, removed. */
  status?: string;
}

function describe(model: CatalogModel): string {
  const bits: string[] = [];
  if (model.contextLength) bits.push(`${Math.round(model.contextLength / 1000)}k context`);
  if (model.supportsReasoning) bits.push("reasoning");
  if (model.supportsTools) bits.push("tools");
  if (model.supportsVision) bits.push("vision");
  if (model.inputModalities.includes("audio")) bits.push("audio in");
  if (model.inputModalities.includes("video")) bits.push("video in");
  return bits.length > 0 ? bits.join(" · ") : `${model.name} via the bundled model catalog.`;
}

/** Maps one bundled catalog model onto an app `models` row. */
export function catalogModelToAppModel(model: CatalogModel, sortOrder: number): AppModelRow {
  return {
    id: `${model.provider}:${model.id}`,
    slug: model.id,
    display_name: model.name,
    description: describe(model),
    provider: model.provider === "gemini" ? "google" : model.provider,
    api_model_id: model.id,
    kind: model.kind === "embedding" ? "embedding" : "chat",
    supports_thinking: model.supportsReasoning,
    supports_tools: model.supportsTools,
    supports_search: model.provider === "gemini" && model.kind === "chat",
    supports_vision: model.supportsVision,
    max_output_tokens: model.maxOutputTokens,
    enabled: true,
    is_default: false,
    sort_order: sortOrder,
    vendor: "Google",
    family: model.family || undefined,
    context_length: model.contextLength,
    pricing: model.pricing,
    release_date: model.releaseDate,
    knowledge_cutoff: model.knowledgeCutoff,
    catalog_source: "bundled",
  };
}

/**
 * The default app model list: the curated offline fallback first (it owns the
 * default model), then every chat-capable model from the bundled Google catalog.
 * This is what the server serves when no database rows exist yet, so the app is
 * never empty and no model has to be added by hand.
 */
export function buildCatalogAppModels(): AppModelRow[] {
  const rows: AppModelRow[] = [];
  const seen = new Set<string>();

  FALLBACK_MODELS.forEach((model, index) => {
    rows.push({ ...model, vendor: "Google", catalog_source: "fallback", sort_order: index + 1 });
    seen.add(model.slug);
  });

  const googleModels = getCatalogModels("gemini").filter(
    (m) => m.kind === "chat" || m.kind === "embedding"
  );

  for (const model of googleModels) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    rows.push(catalogModelToAppModel(model, rows.length + 1));
  }

  return rows;
}
