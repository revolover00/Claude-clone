import { Provider, ModelInfo, ValidationResult, ProviderStreamParams } from "./types";
import { streamOpenAICompatibleChat } from "./streamChat";

export function normalizeOpenRouterModel(m: any): ModelInfo {
  const params: string[] = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
  const modalities: string[] = Array.isArray(m.architecture?.modality) ? m.architecture.modality : ["text"];
  const isVision = modalities.includes("image");

  return {
    provider: "openrouter",
    id: m.id,
    displayName: m.name || m.id,
    description: m.description || null,
    contextLength: m.context_length || null,
    maxOutputTokens: m.top_provider?.max_completion_tokens || null,
    inputModalities: isVision ? ["text", "image"] : ["text"],
    outputModalities: ["text"],
    supportsTools: params.includes("tools"),
    supportsReasoning: params.includes("reasoning"),
    supportsVision: isVision,
    pricing: m.pricing
      ? {
          inputPerMTok: parseFloat(m.pricing.prompt || "0") * 1e6,
          outputPerMTok: parseFloat(m.pricing.completion || "0") * 1e6,
          currency: "USD",
        }
      : null,
    isActive: true,
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
