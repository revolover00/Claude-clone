import type { CatalogKind } from "./types";

/**
 * Classifies a model into a catalog kind from its id, name and output modalities.
 *
 * Mirrored by `inferKind` in `scripts/generate-model-catalog.mjs` (which cannot
 * import TypeScript). `tests/modelCatalog.test.ts` asserts both stay in sync.
 */
export function inferKind(id: string, name: string, outputModalities: string[] = ["text"]): CatalogKind {
  const hay = `${String(id).toLowerCase()} ${String(name || "").toLowerCase()}`;
  const out = outputModalities.map((m) => String(m).toLowerCase());

  if (/embed/.test(hay)) return "embedding";
  if (/rerank|re-rank/.test(hay)) return "rerank";
  if (/guard|shield|moderation|safety/.test(hay)) return "moderation";
  if (/ocr|table-parsing|parse/.test(hay) && !/vision/.test(hay)) return "other";
  if (/tts|text-to-speech|whisper|parakeet|asr|speech|voice|live|realtime/.test(hay)) return "audio";
  if (/veo|video|cosmos|sora/.test(hay) && !/vision/.test(hay)) return "video";
  if (/imagen|dall-e|image|flux|diffusion|sdxl|stable-diffusion/.test(hay) && out.includes("image")) return "image";
  if (out.includes("image")) return "image";
  if (out.includes("video")) return "video";
  if (out.includes("audio")) return "audio";
  return "chat";
}

/** Kinds that can serve a normal text chat turn. */
export function isChatCapable(kind: CatalogKind): boolean {
  return kind === "chat";
}
