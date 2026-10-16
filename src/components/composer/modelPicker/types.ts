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
  vendor?: string;
  /** The provider has no API key yet, so this model cannot run until one is connected. */
  requiresKey?: boolean;
}

export interface ProviderGroup {
  providerId: string;
  providerLabel: string;
  models: UnifiedModel[];
}
