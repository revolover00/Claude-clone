/**
 * Types for the bundled model catalog.
 *
 * The catalog is a committed snapshot of every model each supported provider
 * offers, so the app ships fully populated: no manual model entry, no API key
 * and no network access required just to see and organize models.
 */

export type CatalogKind =
  | "chat"
  | "embedding"
  | "image"
  | "audio"
  | "video"
  | "rerank"
  | "moderation"
  | "other";

/**
 * Model lifecycle, aligned with the server catalog:
 * active | preview (upstream `beta`) | deprecated | removed, plus legacy `alpha`.
 */
export type CatalogStatus = "active" | "preview" | "deprecated" | "removed" | "alpha";

/** Compact authored row shape used inside `src/shared/catalog/providers/*`. */
export interface CatalogEntry {
  id: string;
  name: string;
  family: string;
  kind: CatalogKind;
  /** Context window in tokens. */
  ctx: number | null;
  /** Maximum output tokens. */
  out: number | null;
  /** Capability letters: t=tools r=reasoning s=structured T=temperature w=open weights. */
  caps: string;
  /** Comma separated input modalities: text,image,audio,video,pdf. */
  in: string;
  /** Comma separated output modalities: text,image,audio,video. */
  outMod: string;
  /** USD per 1M tokens: [input, output, cache read]. `null` when the provider does not publish pricing. */
  price: [number, number, number] | null;
  release: string;
  updated: string;
  knowledge: string;
  status?: CatalogStatus;
}

export interface CatalogPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number | null;
  currency: string;
}

/** Fully decoded catalog model — the single shape the server and UI consume. */
export interface CatalogModel {
  provider: string;
  id: string;
  name: string;
  family: string | null;
  kind: CatalogKind;
  contextLength: number | null;
  maxOutputTokens: number | null;
  inputModalities: string[];
  outputModalities: string[];
  supportsTools: boolean;
  supportsReasoning: boolean;
  supportsStructuredOutput: boolean;
  supportsTemperature: boolean;
  supportsVision: boolean;
  openWeights: boolean;
  pricing: CatalogPricing | null;
  releaseDate: string | null;
  lastUpdated: string | null;
  knowledgeCutoff: string | null;
  status: CatalogStatus | null;
  source: "bundled";
}

export interface CatalogProviderDefinition {
  id: string;
  label: string;
  vendor: string;
  /** Key used by the upstream public dataset this snapshot came from. */
  sourceId: string;
  docsUrl: string;
  keyHelpUrl: string;
  apiBase: string;
  apiStyle: "gemini" | "openai";
  keyEnv: string;
  /** How an API key is validated: by listing models (default) or by a tiny chat call. */
  validate?: "models" | "chat";
}

export interface CatalogProvider extends CatalogProviderDefinition {
  models: CatalogModel[];
  modelCount: number;
}

export interface CatalogSnapshot {
  generatedAt: string;
  source: string;
  totalModels: number;
}
