import { GoogleGenAI } from "@google/genai";
import { CATALOG_PROVIDERS } from "../../../src/shared/catalog";

export interface ProviderConnectionTestResult {
  model: string;
  latencyMs: number;
  tokens: number | null;
}

function safeError(message: string, key: string): string {
  const exactKeyRemoved = key ? message.split(key).join("[REDACTED]") : message;
  return exactKeyRemoved.replace(/(sk-[\w-]{8,}|gsk_[\w-]{8,}|AIza[\w-]{8,})/g, "[REDACTED]").slice(0, 800);
}

function tokenCount(usage: any): number | null {
  const total = Number(usage?.total_tokens ?? usage?.totalTokens);
  if (Number.isFinite(total)) return total;
  const input = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.promptTokenCount);
  const output = Number(usage?.completion_tokens ?? usage?.output_tokens ?? usage?.candidatesTokenCount);
  return Number.isFinite(input) && Number.isFinite(output) ? input + output : null;
}

function responseError(data: any, raw: string, status: number, key: string): Error {
  const detail = data?.error?.message || data?.error || data?.message || raw || `Provider returned HTTP ${status}`;
  const message = typeof detail === "string" ? detail : JSON.stringify(detail);
  return new Error(safeError(message, key));
}

/** Sends one non-streaming, eight-token chat probe to a user's provider. */
export async function testProviderConnection(
  providerId: string,
  apiKey: string,
  fetcher: typeof fetch = fetch
): Promise<ProviderConnectionTestResult> {
  const provider = CATALOG_PROVIDERS.find((item) => item.id === providerId);
  const model = provider?.models.find((item) => item.kind === "chat");
  if (!provider || !model) throw new Error(`No bundled chat model is available for ${providerId}`);

  const startedAt = Date.now();
  if (provider.apiStyle === "gemini") {
    try {
      const response = await new GoogleGenAI({ apiKey, httpOptions: { timeout: 15_000 } }).models.generateContent({
        model: model.id,
        contents: "Reply with exactly OK.",
        config: { maxOutputTokens: 8 },
      });
      return { model: model.id, latencyMs: Date.now() - startedAt, tokens: tokenCount(response.usageMetadata) };
    } catch (error: any) {
      throw new Error(safeError(String(error?.message || error), apiKey), { cause: error });
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  const endpoint = `${provider.apiBase.replace(/\/$/, "")}/chat/completions`;
  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(providerId === "openrouter" ? { "HTTP-Referer": "https://aistudio.google.com", "X-Title": "Claude Clone" } : {}),
      },
      body: JSON.stringify({
        model: model.id,
        messages: [{ role: "user", content: "Reply with exactly OK." }],
        max_tokens: 8,
        stream: false,
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { /* provider returned non-JSON text */ }
    if (!response.ok) throw responseError(data, raw, response.status, apiKey);
    if (!data?.choices?.[0]) throw new Error(`${provider.label} returned no chat completion`);
    return { model: model.id, latencyMs: Date.now() - startedAt, tokens: tokenCount(data.usage) };
  } catch (error: any) {
    throw new Error(safeError(String(error?.message || error), apiKey), { cause: error });
  } finally {
    clearTimeout(timer);
  }
}
