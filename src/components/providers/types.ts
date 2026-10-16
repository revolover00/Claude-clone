export type ModelSource = "bundled" | "live" | "live+bundled";

/** A provider model as rendered by the settings browser and the composer picker. */
export interface ProviderModelItem {
  provider: string;
  id: string;
  displayName: string;
  description: string | null;
  contextLength: number | null;
  maxOutputTokens: number | null;
  inputModalities: string[];
  outputModalities: string[];
  supportsTools: boolean;
  supportsReasoning: boolean;
  supportsVision: boolean;
  supportsStructuredOutput?: boolean;
  pricing: { inputPerMTok: number; outputPerMTok: number; currency: string } | null;
  isActive: boolean;
  isEnabled: boolean;
  isPinned: boolean;
  alias?: string | null;
  /** Catalog classification: chat, embedding, image, audio, video, rerank, moderation, other. */
  kind?: string;
  source?: ModelSource;
  vendor?: string;
  family?: string | null;
  releaseDate?: string | null;
  knowledgeCutoff?: string | null;
  openWeights?: boolean;
  status?: string | null;
  /** True when the provider has no working credential yet, so the model needs a key. */
  requiresKey?: boolean;
}

export interface CatalogProviderView {
  id: string;
  label: string;
  vendor: string;
  docsUrl: string;
  keyHelpUrl: string;
  keyEnv?: string | null;
  apiStyle?: string;
  connected: boolean;
  modelCount: number;
  bundledModelCount: number;
  source: ModelSource;
  liveError?: string | null;
  models: ProviderModelItem[];
}

export interface CatalogStats {
  providerCount: number;
  modelCount: number;
  connectedCount: number;
  snapshotDate: string | null;
}

export function isChatKind(kind?: string): boolean {
  return !kind || kind === "chat";
}

export function kindLabel(kind?: string): string {
  switch (kind) {
    case "embedding":
      return "Embedding";
    case "image":
      return "Image";
    case "audio":
      return "Audio";
    case "video":
      return "Video";
    case "rerank":
      return "Rerank";
    case "moderation":
      return "Moderation";
    case "other":
      return "Other";
    default:
      return "Chat";
  }
}
