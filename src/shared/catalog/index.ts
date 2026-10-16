import { buildCatalogProviders } from "./definitions";
import type { CatalogModel, CatalogProvider } from "./types";
import { CATALOG_SNAPSHOT } from "./snapshot";

export * from "./types";
export { inferKind, isChatCapable } from "./kind";
export { decodeEntry, decodeCaps } from "./decode";
export { CATALOG_SNAPSHOT };

/**
 * The bundled catalog: every model of every supported provider, committed to the
 * repo so the app is fully populated out of the box (no manual model entry).
 */
export const CATALOG_PROVIDERS: CatalogProvider[] = buildCatalogProviders();

export const CATALOG_MODELS: CatalogModel[] = CATALOG_PROVIDERS.flatMap((p) => p.models);

export const CATALOG_PROVIDER_IDS: string[] = CATALOG_PROVIDERS.map((p) => p.id);

const PROVIDER_BY_ID = new Map(CATALOG_PROVIDERS.map((p) => [p.id, p]));

/** Provider ids that ship with a bundled catalog, in display order. */
export function isCatalogProvider(providerId: string): boolean {
  return PROVIDER_BY_ID.has(providerId);
}

export function getCatalogProvider(providerId: string): CatalogProvider | undefined {
  return PROVIDER_BY_ID.get(providerId);
}

export function getCatalogModels(providerId: string): CatalogModel[] {
  return PROVIDER_BY_ID.get(providerId)?.models || [];
}

export function getCatalogModel(providerId: string, modelId: string): CatalogModel | undefined {
  const provider = PROVIDER_BY_ID.get(providerId);
  if (!provider) return undefined;
  return provider.models.find((m) => m.id === modelId);
}

export function providerLabel(providerId: string): string {
  return PROVIDER_BY_ID.get(providerId)?.label || providerId;
}

export function catalogTotals(): { providers: number; models: number } {
  return { providers: CATALOG_PROVIDERS.length, models: CATALOG_MODELS.length };
}

export interface CatalogFilter {
  provider?: string;
  query?: string;
  kinds?: string[];
  capability?: "reasoning" | "tools" | "vision" | "structured";
  minContext?: number;
}

/** Shared filter used by the server route and the client browser. */
export function filterCatalogModels(models: CatalogModel[], filter: CatalogFilter = {}): CatalogModel[] {
  const query = (filter.query || "").trim().toLowerCase();
  return models.filter((m) => {
    if (filter.provider && filter.provider !== "all" && m.provider !== filter.provider) return false;
    if (filter.kinds && filter.kinds.length > 0 && !filter.kinds.includes(m.kind)) return false;
    if (filter.minContext && (m.contextLength || 0) < filter.minContext) return false;
    if (filter.capability === "reasoning" && !m.supportsReasoning) return false;
    if (filter.capability === "tools" && !m.supportsTools) return false;
    if (filter.capability === "vision" && !m.supportsVision) return false;
    if (filter.capability === "structured" && !m.supportsStructuredOutput) return false;
    if (!query) return true;
    return (
      m.id.toLowerCase().includes(query) ||
      m.name.toLowerCase().includes(query) ||
      (m.family || "").toLowerCase().includes(query) ||
      providerLabel(m.provider).toLowerCase().includes(query)
    );
  });
}

/** Per-provider counts, used by settings summaries and provider cards. */
export function catalogProviderCounts(): Array<{ id: string; label: string; vendor: string; modelCount: number; chatCount: number }> {
  return CATALOG_PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    vendor: p.vendor,
    modelCount: p.modelCount,
    chatCount: p.models.filter((m) => m.kind === "chat").length,
  }));
}
