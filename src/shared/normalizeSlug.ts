import { FALLBACK_MODELS } from "./fallbackModels";

export const MODEL_ALIAS_MAP: Record<string, string> = {
  "sonnet-5": "gemini-3-8-flash",
  "opus-5": "gemini-3-1-pro",
  "haiku-4-5": "gemini-3-1-flash-lite",
};

export function normalizeSlug(slug: string): string {
  if (!slug) return slug;
  return MODEL_ALIAS_MAP[slug] || slug;
}

/** Legacy app slug -> provider API model id (from the offline fallback list). */
const SLUG_TO_API: Record<string, { provider: string; api: string }> = {};
for (const model of FALLBACK_MODELS) {
  SLUG_TO_API[model.slug] = {
    provider: model.provider === "google" ? "gemini" : model.provider,
    api: model.api_model_id,
  };
}

/**
 * Lazily migrates stored model references to the canonical "provider:modelId"
 * form. Applied when conversations and preferences are read — the stored rows
 * themselves are left untouched until the app writes them again.
 *
 * - "provider:modelId" stays as-is (legacy slugs in the tail are normalized);
 * - legacy app slugs (e.g. "gemini-3-8-flash", aliased slugs) map through the
 *   alias table onto their API id;
 * - unknown bare values are treated as Gemini API ids (best effort).
 */
export function toCanonicalModelId(raw?: string | null): string | null {
  if (!raw) return raw ?? null;

  const colon = raw.indexOf(":");
  if (colon > 0) {
    const provider = raw.slice(0, colon);
    const tail = normalizeSlug(raw.slice(colon + 1));
    const mapped = SLUG_TO_API[tail];
    return `${provider}:${mapped ? mapped.api : tail}`;
  }

  const slug = normalizeSlug(raw);
  const known = SLUG_TO_API[slug];
  if (known) return `${known.provider}:${known.api}`;
  return `gemini:${slug}`;
}
