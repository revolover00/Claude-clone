export interface UnifiedModel {
  id: string; // raw model id
  uniqueKey: string; // "provider:id"
  provider: string; // e.g. "gemini", "groq", "openrouter", "app"
  providerLabel: string; // e.g. "Google AI Studio", "Groq", "OpenRouter", "App models"
  displayName: string;
  alias?: string | null;
  description?: string | null;
  contextLength?: number | null;
  supportsThinking: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsSearch: boolean;
  pricing?: { inputPerMTok: number; outputPerMTok: number; currency: string } | null;
  isEnabled: boolean;
  isPinned: boolean;
  isDefault?: boolean;
  /** Catalog kind (chat, embedding, image, audio, video, ...). */
  kind?: string;
  vendor?: string | null;
  /** Catalog family grouping (e.g. "Gemini 3.8 Flash", "Llama 4"). */
  family?: string | null;
  /** Lifecycle status: active, preview, deprecated, removed. */
  status?: string;
  /** Deterministic per-(provider, family) recommendation flag. */
  recommended?: boolean;
  releasedAt?: string | null;
  firstSeenAt?: string | null;
  isFree?: boolean;
  /** The provider has no API key yet, so this model cannot run until one is connected. */
  requiresKey?: boolean;
  /** Whether a saved active provider key has passed a live verification check. */
  isProviderVerified?: boolean;
  [key: string]: any;
}

export interface ProviderGroup {
  providerId: string;
  providerLabel: string;
  models: UnifiedModel[];
}
