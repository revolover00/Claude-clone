import { Provider, ModelInfo, ValidationResult, ProviderStreamParams } from "./types";
import { streamOpenAICompatibleChat } from "./streamChat";

/**
 * OpenRouter `architecture.modality` is a STRING like "text+image->text".
 * `input_modalities` / `output_modalities` arrays win when present; the string
 * is parsed as the fallback (legacy array payloads are tolerated too).
 */
export function parseModalityString(modality: any): { input: string[]; output: string[] } {
  if (Array.isArray(modality)) {
    // Legacy payloads listed the input modalities as a flat array.
    return { input: modality.length > 0 ? modality : ["text"], output: ["text"] };
  }
  if (typeof modality !== "string" || !modality.trim()) {
    return { input: ["text"], output: ["text"] };
  }
  const [left, right] = modality.split("->");
  const split = (part?: string) =>
    (part || "")
      .split("+")
      .map((m) => m.trim())
      .filter(Boolean);
  const input = split(left);
  const output = split(right);
  return {
    input: input.length > 0 ? input : ["text"],
    output: output.length > 0 ? output : ["text"],
  };
}

/** USD per token strings -> per million; "-1"/missing -> null (variable). */
export function parseOpenRouterPricing(pricing: any): ModelInfo["pricing"] {
  if (!pricing || typeof pricing !== "object") return null;
  const convert = (value: any): number | null => {
    if (value === undefined || value === null || value === "" || value === "-1") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed * 1e6;
  };
  const input = convert(pricing.prompt);
  const output = convert(pricing.completion);
  if (input === null && output === null) return null;
  return {
    inputPerMTok: input ?? output ?? 0,
    outputPerMTok: output ?? input ?? 0,
    currency: "USD",
  };
}

export function normalizeOpenRouterModel(m: any): ModelInfo {
  const params: string[] = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
  const arch = m.architecture || {};
  const fromArrays =
    Array.isArray(arch.input_modalities) && arch.input_modalities.length > 0
      ? { input: arch.input_modalities, output: Array.isArray(arch.output_modalities) && arch.output_modalities.length > 0 ? arch.output_modalities : ["text"] }
      : null;
  const parsed = fromArrays || parseModalityString(arch.modality);
  const inputModalities = parsed.input;
  const outputModalities = parsed.output;
  const supportsVision = inputModalities.includes("image");

  const kind = outputModalities.includes("image")
    ? "image"
    : outputModalities.includes("audio")
      ? "audio"
      : outputModalities.includes("video")
        ? "video"
        : "chat";

  const pricing = parseOpenRouterPricing(m.pricing);

  return {
    provider: "openrouter",
    id: m.id,
    displayName: m.name || m.id,
    description: m.description || null,
    contextLength: m.context_length || null,
    maxOutputTokens: m.top_provider?.max_completion_tokens || null,
    inputModalities,
    outputModalities,
    supportsTools: params.includes("tools"),
    supportsReasoning: params.includes("reasoning") || params.includes("include_reasoning"),
    supportsVision,
    supportsJson: params.includes("response_format") || params.includes("structured_outputs"),
    pricing,
    releasedAt: typeof m.created === "number" && m.created > 0 ? new Date(m.created * 1000).toISOString().slice(0, 10) : null,
    isActive: true,
    kind,
    raw: m,
  };
}

export const openRouterProvider: Provider = {
  id: "openrouter",
  label: "OpenRouter",
  docsUrl: "https://openrouter.ai/",
  keyHelpUrl: "https://openrouter.ai/keys",

  async validateKey(key: string): Promise<ValidationResult> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          status: 400,
          code: "KEY_INVALID",
          message: "Invalid OpenRouter API key",
        };
      }
      if (!response.ok) {
        // Fallback test by requesting models endpoint
        const modelsRes = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (modelsRes.status === 401 || modelsRes.status === 403) {
          return {
            valid: false,
            status: 400,
            code: "KEY_INVALID",
            message: "Invalid OpenRouter API key",
          };
        }
      }
      return { valid: true };
    } catch {
      return {
        valid: false,
        status: 502,
        code: "PROVIDER_UNAVAILABLE",
        message: "Unable to reach OpenRouter service",
      };
    }
  },

  async listModels(key: string): Promise<ModelInfo[]> {
    const headers: Record<string, string> = {};
    if (key) headers["Authorization"] = `Bearer ${key}`;
    const response = await fetch("https://openrouter.ai/api/v1/models", { headers });
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }
    const data = await response.json();
    return (data.data || []).map(normalizeOpenRouterModel);
  },

  async streamChat(params: ProviderStreamParams): Promise<any> {
    return streamOpenAICompatibleChat({
      ...params,
      provider: "openrouter",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
    });
  },
};
