/** Small provider traits kept outside the generated catalog data so chat stays light. */
const OPENAI_COMPATIBLE = new Set([
  "openai", "xai", "mistral", "deepseek", "cerebras", "togetherai", "fireworks",
  "nvidia", "qwen", "moonshotai", "zai", "perplexity",
]);
const EXPERIMENTAL_EXEMPTIONS = new Set(["gemini", "google", "groq", "openrouter"]);

/** True for OpenAI-compatible integrations without a verified live credential. */
export function isExperimentalProvider(providerId: string | null | undefined): boolean {
  const id = providerId?.toLowerCase();
  return Boolean(id && OPENAI_COMPATIBLE.has(id) && !EXPERIMENTAL_EXEMPTIONS.has(id));
}

/** Provider-level free tiers (beyond individual zero-priced models). */
export const FREE_TIER_PROVIDERS: ReadonlySet<string> = new Set(["gemini", "groq"]);

export function hasFreeTier(providerId: string | null | undefined): boolean {
  return Boolean(providerId && FREE_TIER_PROVIDERS.has(providerId));
}
