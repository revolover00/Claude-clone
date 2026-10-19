import { Provider } from "./types";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { openRouterProvider } from "./openrouter";
import { createOpenAICompatibleProvider } from "./openaiCompatible";
import { CATALOG_PROVIDERS } from "../../../src/shared/catalog";

/**
 * Every provider that ships with the app. The three providers with bespoke
 * request handling (Gemini SDK, Groq, OpenRouter) are declared explicitly; the
 * rest are generated from the bundled catalog definitions, which carry the API
 * base URL, docs links and key help links for each vendor.
 */
export const providers: Record<string, Provider> = {
  gemini: geminiProvider,
  groq: groqProvider,
  openrouter: openRouterProvider,
};

for (const def of CATALOG_PROVIDERS) {
  if (providers[def.id]) continue;
  providers[def.id] = createOpenAICompatibleProvider({
    id: def.id,
    label: def.label,
    docsUrl: def.docsUrl,
    keyHelpUrl: def.keyHelpUrl,
    apiBase: def.apiBase,
    validate: def.validate,
    // Used when a provider has no public /models endpoint: the probe sends the
    // provider's first bundled chat model so validation answers honestly.
    probeModel: def.models.find((m) => m.kind === "chat")?.id,
  });
}

export const providerIds: string[] = Object.keys(providers);

export function getProvider(id: string): Provider | undefined {
  return providers[id];
}

export function isKnownProvider(id: string): boolean {
  return Boolean(providers[id]);
}
