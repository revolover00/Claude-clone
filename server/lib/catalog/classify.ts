/**
 * Pure classification rules for catalog models: vendor, family, kind, status
 * and release date. No I/O — every function is deterministic and unit-tested
 * in tests/catalogClassify.test.ts.
 */
import type { CatalogStatus, SyncedModel } from "./types";

/** OpenRouter ids are "vendor/model"; Gemini maps to google; Groq uses owned_by. */
export function vendorOf(provider: string, modelId: string, ownedBy?: string | null): string {
  if (provider === "gemini") return "google";
  if (provider === "groq") {
    if (ownedBy && ownedBy.trim()) return ownedBy.trim();
    return inferVendorFromId(modelId);
  }
  const slash = modelId.indexOf("/");
  if (slash > 0) return modelId.slice(0, slash);
  if (ownedBy && ownedBy.trim()) return ownedBy.trim();
  return inferVendorFromId(modelId);
}

function inferVendorFromId(modelId: string): string {
  const id = modelId.toLowerCase();
  if (/deepseek/.test(id)) return "DeepSeek";
  if (/qwen/.test(id)) return "Qwen";
  if (/mistral|mixtral/.test(id)) return "Mistral";
  if (/gemma/.test(id)) return "Google";
  if (/llama/.test(id)) return "Meta";
  if (/kimi|moonshot/.test(id)) return "Moonshot AI";
  if (/gpt|o[134]-/.test(id)) return "OpenAI";
  if (/grok/.test(id)) return "xAI";
  if (/whisper/.test(id)) return "OpenAI";
  const slash = modelId.indexOf("/");
  return slash > 0 ? modelId.slice(0, slash) : providerGuess(modelId);
}

function providerGuess(modelId: string): string {
  const first = modelId.split(/[-_/:.]/)[0] || modelId;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/**
 * Family grouping used for organization and per-family recommendations:
 * Gemini 3.x Flash/Pro/Flash-Lite, Gemma, Llama 4/3.x, GPT-OSS, DeepSeek R1/V3,
 * Qwen, Mistral … Fallback: the display name without the version suffix.
 */
export function familyOf(provider: string, modelId: string, displayName: string): string {
  const id = modelId.toLowerCase();
  const name = displayName || modelId;

  const gemini = id.match(/gemini[-.]?(\d+(?:\.\d+)?).*(flash-lite|flash|pro)/);
  if (provider === "gemini" || gemini) {
    if (gemini) {
      const tier = gemini[2] === "flash-lite" ? "Flash-Lite" : gemini[2] === "pro" ? "Pro" : "Flash";
      return `Gemini ${gemini[1]} ${tier}`;
    }
    const lite = name.match(/gemini.*lite/i);
    if (lite) return "Gemini Flash-Lite";
    const generic = name.match(/gemini/i);
    if (generic) return "Gemini";
  }

  if (/gemma/.test(id)) {
    const v = id.match(/gemma[-.]?(\d)/);
    return v ? `Gemma ${v[1]}` : "Gemma";
  }
  const ossProbe = `${id} ${name.toLowerCase().replace(/\s+/g, "-")}`;
  if (/gpt-oss/.test(ossProbe)) return "GPT-OSS";
  if (/deepseek[-.]?r1|deepseek[-.]?reasoner/.test(id)) return "DeepSeek R1";
  if (/deepseek[-.]?v3/.test(id)) return "DeepSeek V3";
  if (/deepseek/.test(id)) return "DeepSeek";
  if (/llama[-.]?4/.test(id)) return "Llama 4";
  const llama3 = id.match(/llama[-.]?(3(?:\.\d+)?)/);
  if (llama3) return `Llama ${llama3[1]}`;
  if (/llama/.test(id)) return "Llama";
  const qwen = id.match(/qwen[-.]?(\d+(?:\.\d+)?)/);
  if (qwen) return `Qwen ${qwen[1]}`;
  if (/qwen/.test(id)) return "Qwen";
  if (/mistral|mixtral/.test(id)) return "Mistral";
  if (/grok/.test(id)) return id.match(/grok[-.]?(\d)/) ? `Grok ${id.match(/grok[-.]?(\d)/)![1]}` : "Grok";
  if (/^gpt|^o[134]-/.test(id.replace(/^[^/]+\//, ""))) {
    const g = id.replace(/^[^/]+\//, "").match(/^(gpt)[-.]?(\d+(?:\.\d+)?|oss)?/);
    if (g) return g[2] ? `GPT-${g[2]}` : "GPT";
    return "OpenAI o-series";
  }

  return stripVersionSuffix(name);
}

/** Fallback family: display name without the trailing version suffix. */
export function stripVersionSuffix(name: string): string {
  return name
    .replace(/(?:\s*[:\-–]?\s*v?\d+(?:\.\d+)*[a-z]*)+$/i, "")
    .replace(/\s*-\s*\d+[bB]\b.*$/, "")
    .replace(/\s+/g, " ")
    .trim() || name;
}

/** Embedding/image/audio/video/moderation rules, else chat. */
export function kindOf(model: Pick<SyncedModel, "name" | "model_id" | "output_modalities" | "generation_methods">): string {
  const id = model.model_id.toLowerCase();
  const name = (model.name || model.model_id).toLowerCase();
  const out = (model.output_modalities || []).map((m) => m.toLowerCase());
  const methods = model.generation_methods || [];

  if (name.includes("embed") || id.includes("embed") || (methods.length > 0 && methods.every((m) => m === "embedContent"))) {
    return "embedding";
  }
  if (name.includes("guard") || id.includes("guard") || name.includes("moderation")) return "moderation";
  if (out.includes("image") || /imagen|diffusion|stable-diffusion/.test(id) || /imagen/.test(name)) return "image";
  if (out.includes("audio") || /\btts\b|whisper|transcribe|speech/.test(id) || /text to speech/.test(name)) return "audio";
  if (out.includes("video") || /video/.test(name)) return "video";
  if (methods.length > 0 && !methods.includes("generateContent") && !methods.includes("embedContent")) {
    if (methods.includes("predict")) return "image";
  }
  return "chat";
}

const KNOWN_DEPRECATED = [/(^|[-/])palm/, /bison/, /-legacy$/, /^gpt-3\.5(-|$)/, /gemini-1\.0/];

/** "preview" when id/name contains preview/beta/exp; "deprecated" on expiry. */
export function statusOf(model: Pick<SyncedModel, "name" | "model_id" | "expires_at">): CatalogStatus {
  if (model.expires_at) return "deprecated";
  const id = model.model_id.toLowerCase();
  const name = (model.name || "").toLowerCase();
  if (KNOWN_DEPRECATED.some((re) => re.test(id) || re.test(name))) return "deprecated";
  if (/(^|[^a-z])preview([^a-z]|$)/.test(id) || name.includes("preview")) return "preview";
  if (/(^|[^a-z])beta([^a-z]|$)/.test(id) || name.includes("beta")) return "preview";
  if (/(^|[^a-z])exp([^a-z]|$)/.test(id) || name.includes("experimental")) return "preview";
  return "active";
}

/** ISO date from provider release data (OpenRouter "created" is unix seconds). */
export function releasedAtOf(provider: string, model: SyncedModel): string | null {
  if (model.released_at) return model.released_at;
  const raw = model.raw;
  if (provider === "openrouter" && raw && typeof raw.created === "number" && raw.created > 0) {
    return new Date(raw.created * 1000).toISOString().slice(0, 10);
  }
  return null;
}
