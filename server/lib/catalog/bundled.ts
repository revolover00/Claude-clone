/**
 * Maps the committed bundled catalog onto provider_catalog record shape, used
 * only as a read fallback when the synced catalog table is empty (fresh deploys,
 * tests, offline dev). Never written to the database.
 */
import { CATALOG_MODELS, CATALOG_PROVIDERS } from "../../../src/shared/catalog";
import type { CatalogRecord, CatalogStatus, CatalogPricing } from "./types";
import { recommendedIds } from "./recommend";

function mapStatus(status: string | null | undefined): CatalogStatus {
  if (status === "deprecated") return "deprecated";
  if (status === "alpha") return "preview";
  return "active";
}

export function bundledCatalogRecords(): CatalogRecord[] {
  const records: CatalogRecord[] = CATALOG_MODELS.map((model) => {
    const pricing: CatalogPricing | null = model.pricing
      ? { inputPerMTok: model.pricing.inputPerMTok, outputPerMTok: model.pricing.outputPerMTok, currency: model.pricing.currency }
      : null;
    return {
      provider: model.provider,
      model_id: model.id,
      name: model.name,
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
      source: "bundled",
      first_seen_at: "",
      last_seen_at: "",
      last_synced_at: "",
    };
  });

  const winners = recommendedIds(records);
  for (const record of records) {
    record.is_recommended = winners.has(`${record.provider}:${record.model_id}`);
  }
  return records;
}
