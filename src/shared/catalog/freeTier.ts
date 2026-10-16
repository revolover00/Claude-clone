/**
 * Providers whose own API keys expose a standing, rate-limited **free tier**:
 * every model on these providers is usable at $0 within the published limits
 * (Google AI Studio free tier; Groq free developer tier). Beyond those limits
 * the catalog's list price applies.
 *
 * Price-zero models elsewhere are free per model (`is_free`) and do not need
 * this flag.
 */
export const FREE_TIER_PROVIDERS: ReadonlySet<string> = new Set(["gemini", "groq"]);

export function hasFreeTier(providerId: string | null | undefined): boolean {
  return Boolean(providerId && FREE_TIER_PROVIDERS.has(providerId));
}
