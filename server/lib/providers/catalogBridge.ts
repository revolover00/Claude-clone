import { Provider, ModelInfo } from "./types";
import { CATALOG_PROVIDERS, CATALOG_MODELS, getCatalogProvider, getCatalogModels } from "../../../src/shared/catalog";
import type { CatalogModel } from "../../../src/shared/catalog";

/**
 * Bridges the bundled model catalog into the provider layer.
 *
 * The catalog is committed to the repository, so every provider always has a
 * complete, detailed model list — with or without an API key, and without any
 * manual entry in settings.
 */

/** Converts a bundled catalog model into the provider `ModelInfo` shape. */
export function catalogModelToModelInfo(model: CatalogModel): ModelInfo {
  return {
    provider: model.provider,
    id: model.id,
    displayName: model.name,
    description: null,
    contextLength: model.contextLength,
    maxOutputTokens: model.maxOutputTokens,
    inputModalities: model.inputModalities,
    outputModalities: model.outputModalities,
    supportsTools: model.supportsTools,
    supportsReasoning: model.supportsReasoning,
    supportsVision: model.supportsVision,
    pricing: model.pricing
      ? {
          inputPerMTok: model.pricing.inputPerMTok,
          outputPerMTok: model.pricing.outputPerMTok,
          currency: model.pricing.currency,
        }
      : null,
    isActive: true,
    kind: model.kind,
    raw: model,
  };
}

export interface CatalogModelInfo extends ModelInfo {
  source: "bundled" | "live" | "live+bundled";
  vendor?: string;
  family?: string | null;
  knowledgeCutoff?: string | null;
  releaseDate?: string | null;
  openWeights?: boolean;
  supportsStructuredOutput?: boolean;
}

/** Bundled models for one provider (empty when the provider is unknown). */
export function bundledModelsFor(providerId: string): ModelInfo[] {
  return getCatalogModels(providerId).map(catalogModelToModelInfo);
}

/**
 * Merges a live provider catalog over the bundled one: live entries win on
 * conflicts (fresh names, context windows, pricing), bundled entries fill the
 * gaps so the list is never partially empty.
 */
export function mergeCatalogAndLive(
  providerId: string,
  live: ModelInfo[] | null | undefined
): CatalogModelInfo[] {
  const catalog = getCatalogProvider(providerId);
  const liveList = Array.isArray(live) ? live : [];
  const liveById = new Map(liveList.map((m) => [m.id, m]));
  const merged: CatalogModelInfo[] = [];

  for (const detail of catalog?.models || []) {
    const liveModel = liveById.get(detail.id);
    merged.push({
      ...catalogModelToModelInfo(detail),
      ...(liveModel || {}),
      provider: providerId,
      kind: liveModel?.kind || detail.kind,
      source: liveModel ? "live+bundled" : "bundled",
      vendor: catalog?.vendor,
      family: detail.family,
      knowledgeCutoff: detail.knowledgeCutoff,
      releaseDate: detail.releaseDate,
      openWeights: detail.openWeights,
      supportsStructuredOutput: detail.supportsStructuredOutput,
    });
  }

  // Live-only models: releases newer than the committed snapshot.
  for (const model of liveList) {
    if (merged.some((m) => m.id === model.id)) continue;
    merged.push({
      ...model,
      provider: providerId,
      source: "live",
      vendor: catalog?.vendor,
    });
  }

  return merged;
}

/** Provider registry entry enriched with bundled catalog information. */
export function providerCatalogInfo(provider: Provider) {
  const catalog = getCatalogProvider(provider.id);
  return {
    id: provider.id,
    label: provider.label,
    // The catalog carries richer, provider-specific documentation links.
    docsUrl: catalog?.docsUrl || provider.docsUrl,
    keyHelpUrl: catalog?.keyHelpUrl || provider.keyHelpUrl,
    vendor: catalog?.vendor || provider.label,
    apiStyle: catalog?.apiStyle || "openai",
    keyEnv: catalog?.keyEnv || null,
    bundledModelCount: catalog?.modelCount ?? 0,
  };
}

export function catalogTotalsFromBundle() {
  return { providers: CATALOG_PROVIDERS.length, models: CATALOG_MODELS.length };
}
