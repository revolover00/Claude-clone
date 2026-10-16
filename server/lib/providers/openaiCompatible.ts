import { Provider, ModelInfo, ValidationResult, ProviderStreamParams } from "./types";
import { streamOpenAICompatibleChat } from "./streamChat";
import { inferKind } from "../../../src/shared/catalog/kind";

export interface OpenAICompatibleConfig {
  id: string;
  label: string;
  docsUrl: string;
  keyHelpUrl: string;
  /** Base URL without a trailing slash, e.g. https://api.openai.com/v1 */
  apiBase: string;
  /** How the key is validated. "models" (default) lists the catalog, "chat" sends a 1-token probe. */
  validate?: "models" | "chat";
  extraHeaders?: Record<string, string>;
  /** Override for providers that do not expose the OpenAI `/chat/completions` path. */
  chatPath?: string;
  modelsPath?: string;
  /** Model id used by the 1-token key-validation probe (providers with no /models endpoint). */
  probeModel?: string;
}

/** Normalizes an OpenAI-compatible `/models` entry into the shared ModelInfo shape. */
export function normalizeOpenAICompatibleModel(providerId: string, m: any): ModelInfo {
  const id = String(m?.id || m?.name || "");
  const modalitiesIn: string[] = Array.isArray(m?.input_modalities)
    ? m.input_modalities
    : Array.isArray(m?.architecture?.input_modalities)
      ? m.architecture.input_modalities
      : ["text"];
  const modalitiesOut: string[] = Array.isArray(m?.output_modalities)
    ? m.output_modalities
    : Array.isArray(m?.architecture?.output_modalities)
      ? m.architecture.output_modalities
      : ["text"];
  const kind = inferKind(id, m?.name || id, modalitiesOut);

  return {
    provider: providerId,
    id,
    displayName: m?.name || id,
    description: m?.description || null,
    contextLength: m?.context_length ?? m?.context_window ?? m?.limit?.context ?? null,
    maxOutputTokens: m?.max_output_tokens ?? m?.limit?.output ?? null,
    inputModalities: modalitiesIn,
    outputModalities: modalitiesOut,
    supportsTools: Boolean(m?.tool_call ?? m?.supports_tools ?? true),
    supportsReasoning: Boolean(m?.reasoning ?? m?.supports_reasoning ?? false),
    supportsVision: modalitiesIn.includes("image"),
    pricing: null,
    isActive: m?.active !== false,
    raw: m,
    kind,
  } as ModelInfo;
}

/**
 * Builds a provider adapter for any service that speaks the OpenAI HTTP API.
 * Every new provider in the catalog is wired up with this factory, so adding a
 * provider is a data change rather than a new integration.
 */
export function createOpenAICompatibleProvider(cfg: OpenAICompatibleConfig): Provider {
  const base = cfg.apiBase.replace(/\/$/, "");
  const modelsUrl = `${base}${cfg.modelsPath || "/models"}`;
  const chatUrl = `${base}${cfg.chatPath || "/chat/completions"}`;

  const headersFor = (key: string): Record<string, string> => ({
    Authorization: `Bearer ${key}`,
    ...(cfg.extraHeaders || {}),
  });

  return {
    id: cfg.id,
    label: cfg.label,
    docsUrl: cfg.docsUrl,
    keyHelpUrl: cfg.keyHelpUrl,

    async validateKey(key: string): Promise<ValidationResult> {
      // A 1-token chat probe: providers without a public /models endpoint still
      // confirm the key this way.
      const probeChat = async (): Promise<ValidationResult> => {
        const probe = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headersFor(key) },
          body: JSON.stringify({ model: cfg.probeModel || "", messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
        });
        // 400/404 means "unknown model" but the key itself was accepted.
        if (probe.status === 401 || probe.status === 403) {
          return { valid: false, status: 400, code: "KEY_INVALID", message: `Invalid ${cfg.label} API key` };
        }
        return { valid: true };
      };

      try {
        if (cfg.validate === "chat") return await probeChat();

        const res = await fetch(modelsUrl, { headers: headersFor(key) });
        if (res.status === 401 || res.status === 403) {
          return { valid: false, status: 400, code: "KEY_INVALID", message: `Invalid ${cfg.label} API key` };
        }
        if (res.status === 404 || res.status === 405) {
          return await probeChat();
        }
        if (!res.ok) {
          return { valid: false, status: 502, code: "PROVIDER_UNAVAILABLE", message: `${cfg.label} error (status ${res.status})` };
        }
        return { valid: true };
      } catch {
        return { valid: false, status: 502, code: "PROVIDER_UNAVAILABLE", message: `Unable to reach ${cfg.label} service` };
      }
    },

    async listModels(key: string): Promise<ModelInfo[]> {
      const res = await fetch(modelsUrl, { headers: key ? headersFor(key) : {} });
      if (!res.ok) {
        throw new Error(`${cfg.label} API error: ${res.status}`);
      }
      const data = await res.json();
      const list: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
      return list
        .map((m) => normalizeOpenAICompatibleModel(cfg.id, m))
        .filter((m) => Boolean(m.id));
    },

    async streamChat(params: ProviderStreamParams): Promise<any> {
      return streamOpenAICompatibleChat({
        ...params,
        provider: cfg.id,
        endpoint: chatUrl,
      });
    },
  };
}
