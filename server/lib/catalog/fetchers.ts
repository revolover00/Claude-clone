/**
 * Provider fetchers for the catalog sync.
 *
 * - OpenRouter: public endpoint, no key required.
 * - Gemini / Groq / every other registered provider: any ACTIVE key a user
 *   saved in Settings > Providers (source "user-key"). The server never reads
 *   GEMINI_API_KEY / GROQ_API_KEY from the deploy environment — with no
 *   connected key the provider's sync is simply skipped.
 */
import { openRouterProvider } from "../providers/openrouter";
import { geminiProvider } from "../providers/gemini";
import { groqProvider } from "../providers/groq";
import { getProvider, providerIds } from "../providers";
import { findActiveCredentialKey } from "../providers/activeKey";
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

/** Sync one provider through any active user key; null when nobody connected it. */
export async function fetchViaUserKey(
  providerId: string,
  adapter: { listModels: (key: string) => Promise<any[]> }
): Promise<ProviderFetchResult | null> {
  const key = await findActiveCredentialKey(providerId);
  if (!key) return null;
  const models = await adapter.listModels(key);
  return { provider: providerId, source: "user-key", models: models.map(fromModelInfo) };
}

/** Gemini's model list via any user's connected Gemini key. */
export async function fetchGeminiCatalog(): Promise<ProviderFetchResult | null> {
  return fetchViaUserKey("gemini", geminiProvider);
}

/** Groq's model list via any user's connected Groq key. */
export async function fetchGroqCatalog(): Promise<ProviderFetchResult | null> {
  return fetchViaUserKey("groq", groqProvider);
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

/**
 * Dynamic fetchers for every other registered provider (OpenAI, xAI, Mistral,
 * ...) — active only while at least one user has connected a key for it. This
 * is how "add a key -> all of its models appear" keeps itself fresh.
 */
export function connectedFetchers(): CatalogFetcher[] {
  const builtin = new Set(CATALOG_FETCHERS.map((f) => f.provider));
  return providerIds
    .filter((id) => !builtin.has(id))
    .map((id) => ({
      provider: id,
      fetch: async () => {
        const adapter = getProvider(id);
        if (!adapter) return null;
        return fetchViaUserKey(id, adapter);
      },
    }));
}

/** Builtin + dynamic fetchers, deduped by provider. */
export function allCatalogFetchers(): CatalogFetcher[] {
  const seen = new Set<string>();
  return [...CATALOG_FETCHERS, ...connectedFetchers()].filter((f) => {
    if (seen.has(f.provider)) return false;
    seen.add(f.provider);
    return true;
  });
}
