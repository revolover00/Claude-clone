/**
 * Maps the committed snapshot onto provider_catalog records for offline/fresh-deploy
 * reads. Curated Google fallback rows keep source="fallback"; no row is written.
 */
import { CATALOG_MODELS, CATALOG_PROVIDERS } from "../../../src/shared/catalog";
import { FALLBACK_MODELS } from "../../../src/shared/fallbackModels";
import type { CatalogRecord, CatalogStatus, CatalogPricing } from "./types";
import { recommendedIds } from "./recommend";

function mapStatus(status: string | null | undefined): CatalogStatus {
  if (status === "deprecated") return "deprecated";
  if (status === "removed") return "removed";
  if (status === "preview" || status === "alpha") return "preview";
  return "active";
}

let cachedRecords: CatalogRecord[] | null = null;

export function bundledCatalogRecords(): CatalogRecord[] {
  if (cachedRecords) return cachedRecords;
  const fallbackNames = new Map(FALLBACK_MODELS.map((model) => [model.api_model_id, model.display_name]));
  const records: CatalogRecord[] = CATALOG_MODELS.map((model) => {
    const pricing: CatalogPricing | null = model.pricing
      ? { inputPerMTok: model.pricing.inputPerMTok, outputPerMTok: model.pricing.outputPerMTok, currency: model.pricing.currency }
      : null;
    const isGoogleFallback = model.provider === "gemini" && fallbackNames.has(model.id);
    return {
      provider: model.provider,
      model_id: model.id,
      name: isGoogleFallback ? fallbackNames.get(model.id)! : model.name,
      description: null,
      vendor: model.provider === "gemini" ? "google" : CATALOG_PROVIDERS.find((p) => p.id === model.provider)?.vendor || model.provider,
      family: model.family || model.name,
      kind: model.kind,
      status: mapStatus(model.status),
      context_length: model.contextLength,
      max_output_tokens: model.maxOutputTokens,
      input_modalities: model.inputModalities,
      output_modalities: model.outputModalities,
      supports_tools: model.supportsTools,
      supports_vision: model.supportsVision,
      supports_reasoning: model.supportsReasoning,
      supports_json: model.supportsStructuredOutput,
      is_free: Boolean(pricing && pricing.inputPerMTok === 0 && pricing.outputPerMTok === 0),
      is_recommended: false,
      pricing,
      released_at: model.releaseDate,
      source: isGoogleFallback ? "fallback" : "bundled",
      first_seen_at: "",
      last_seen_at: "",
      last_synced_at: "",
    };
  });

  const winners = recommendedIds(records);
  for (const record of records) {
    record.is_recommended = winners.has(`${record.provider}:${record.model_id}`);
  }
  cachedRecords = records;
  return records;
}
