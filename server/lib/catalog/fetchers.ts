/**
 * Provider fetchers for the catalog sync.
 *
 * - OpenRouter: public endpoint, no key required.
 * - Gemini: the app key GEMINI_API_KEY when present (source "app-key").
 * - Groq: optional env GROQ_API_KEY as the catalog key; skipped when missing.
 */
import { openRouterProvider } from "../providers/openrouter";
import { geminiProvider } from "../providers/gemini";
import { groqProvider } from "../providers/groq";
import type { SyncedModel } from "./types";

export interface ProviderFetchResult {
  provider: string;
  source: string;
  models: SyncedModel[];
}

function fromModelInfo(m: any): SyncedModel {
  const raw = m.raw || {};
  return {
    model_id: m.id,
    name: m.displayName || m.id,
    description: m.description ?? null,
    context_length: m.contextLength ?? null,
    max_output_tokens: m.maxOutputTokens ?? null,
    input_modalities: m.inputModalities || ["text"],
    output_modalities: m.outputModalities || ["text"],
    supports_tools: Boolean(m.supportsTools),
    supports_vision: Boolean(m.supportsVision),
    supports_reasoning: Boolean(m.supportsReasoning),
    supports_json: Boolean(m.supportsJson ?? m.supportsStructuredOutput),
    pricing: m.pricing
      ? { inputPerMTok: m.pricing.inputPerMTok, outputPerMTok: m.pricing.outputPerMTok, currency: m.pricing.currency || "USD" }
      : null,
    released_at: m.releasedAt ?? null,
    expires_at: m.expiresAt ?? raw.expires_at ?? null,
    owned_by: m.ownedBy ?? raw.owned_by ?? null,
    generation_methods: raw.supportedGenerationMethods || raw.supportedActions || undefined,
    raw,
  };
}

/** OpenRouter's full model list — public endpoint, no key. */
export async function fetchOpenRouterCatalog(): Promise<ProviderFetchResult> {
  const models = await openRouterProvider.listModels("");
  return { provider: "openrouter", source: "public", models: models.map(fromModelInfo) };
}

/** Gemini's model list via the app key; null when GEMINI_API_KEY is absent. */
export async function fetchGeminiCatalog(): Promise<ProviderFetchResult | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const models = await geminiProvider.listModels(process.env.GEMINI_API_KEY);
  return { provider: "gemini", source: "app-key", models: models.map(fromModelInfo) };
}

/** Groq's model list via GROQ_API_KEY; null when the env key is missing. */
export async function fetchGroqCatalog(): Promise<ProviderFetchResult | null> {
  if (!process.env.GROQ_API_KEY) return null;
  const models = await groqProvider.listModels(process.env.GROQ_API_KEY);
  return { provider: "groq", source: "groq-key", models: models.map(fromModelInfo) };
}

export interface CatalogFetcher {
  provider: string;
  fetch: () => Promise<ProviderFetchResult | null>;
}

export const CATALOG_FETCHERS: CatalogFetcher[] = [
  { provider: "openrouter", fetch: fetchOpenRouterCatalog },
  { provider: "gemini", fetch: fetchGeminiCatalog },
  { provider: "groq", fetch: fetchGroqCatalog },
];
