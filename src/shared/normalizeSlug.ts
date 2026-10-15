export const MODEL_ALIAS_MAP: Record<string, string> = {
  "sonnet-5": "gemini-3-8-flash",
  "opus-5": "gemini-3-1-pro",
  "haiku-4-5": "gemini-3-1-flash-lite",
};

export function normalizeSlug(slug: string): string {
  if (!slug) return slug;
  return MODEL_ALIAS_MAP[slug] || slug;
}
