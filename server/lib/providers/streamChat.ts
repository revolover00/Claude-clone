import { fetchWithConnectTimeout, readWithIdleTimeout, STREAM_IDLE_TIMEOUT_MS } from "./streamIdle";

export interface StreamChatParams {
  /** Any provider id from the registry (all OpenAI-compatible providers share this transport). */
  provider: string;
  endpoint: string;
  modelId: string;
  apiKey: string;
  messages: any[];
  config?: any;
  res: any;
  abortSignal?: AbortSignal;
  thinkingPlan?: { level: string; reason?: string };
  onInvalidKey?: () => Promise<void> | void;
  /** Idle-watchdog / connect-timeout overrides in ms (tests use tiny values). */
  idleTimeoutMs?: number;
  connectTimeoutMs?: number;
  /** Priority-ordered fallback keys; rotated past auth/quota/rate failures before the first token. */
  apiKeys?: Array<{ id?: string; label?: string; key: string }>;
  onKeyFailure?: (id: string, code: "KEY_INVALID" | "CREDITS_EXHAUSTED" | "RATE_LIMITED") => Promise<void> | void;
}

export function formatOpenAIMessages(messages: any[], systemInstruction?: string): any[] {
  const formatted: any[] = [];
  if (systemInstruction) {
    formatted.push({ role: "system", content: systemInstruction });
  }

  for (const msg of messages) {
    const role = msg.role === "model" || msg.role === "assistant" ? "assistant" : "user";
    let content = "";
    if (typeof msg.content === "string") {
      content = msg.content;
    } else if (Array.isArray(msg.parts)) {
      content = msg.parts.map((p: any) => p.text || "").join("");
    }
    formatted.push({ role, content });
  }

  return formatted;
}

export function buildReasoningPayload(provider: string, level: string): Record<string, any> {
  const effort = level === "low" || level === "medium" || level === "high" ? level : "medium";
  if (provider === "groq") {
    return {
      reasoning_format: "parsed",
      reasoning_effort: effort,
    };
  }
  if (provider === "openrouter") {
    return {
      reasoning: { effort },
    };
  }
  if (provider === "openai" || provider === "xai") {
    return { reasoning_effort: effort };
  }
  // Other providers reject unknown body fields, so no reasoning hints are sent.
  return {};
}

/**
 * Turns a raw provider error body into a friendly SSE error event.
 * Groq/OpenAI-style bodies: {"error":{"message":"...","code":"model_decommissioned"}}.
 * Decommissioned/unknown models map to MODEL_NOT_FOUND (404) so clients show
 * "model retired" instead of raw JSON, and never treat a 400 as a 5xx.
 */
export function mapProviderError(
  status: number,
  body: string,
  modelId: string
): { error: string; code: string | number; status: number } {
  let message = "";
  let innerCode: any = null;
  try {
    const parsed = JSON.parse(body);
    const e = parsed?.error ?? parsed;
    if (typeof e?.message === "string") message = e.message;
    if (e?.code !== undefined && e?.code !== null) innerCode = e.code;
  } catch {
    const m = body.match(/"message"\s*:\s*"([^"]{5,400})"/);
    if (m) message = m[1];
  }

  const retired =
    innerCode === "model_decommissioned" ||
    innerCode === "model_not_found" ||
    /decommissioned|no longer supported|has been retired|not found/i.test(message);
  if (retired || status === 404) {
    return {
      error: message || `Model '${modelId}' is no longer available`,
      code: "MODEL_NOT_FOUND",
      status: 404,
    };
  }
  if (status === 400) {
    return { error: message || "Provider rejected the request", code: "INVALID_REQUEST", status: 400 };
  }
  return {
    error: message ? `Provider error: ${message}` : `Provider error (${status})`,
    code: status,
    status,
  };
}

export async function streamOpenAICompatibleChat(params: StreamChatParams): Promise<void> {
  const { provider, endpoint, modelId, apiKey, messages, config, res, abortSignal, thinkingPlan, onKeyFailure } = params;

  const openaiMessages = formatOpenAIMessages(messages, config?.systemInstruction);
  const basePayload: Record<string, any> = {
    model: modelId,
    messages: openaiMessages,
    stream: true,
  };

  const reasoningPayload = thinkingPlan?.level ? buildReasoningPayload(provider, thinkingPlan.level) : {};
  const hasReasoning = Object.keys(reasoningPayload).length > 0;
  let payload = hasReasoning ? { ...basePayload, ...reasoningPayload } : { ...basePayload };

  // Priority-ordered fallback: rotate past auth (401/403), quota (402) and
  // rate (429) failures BEFORE the first streamed byte, so a spent key never
  // surfaces an error while another key can still answer this request.
  const candidates: Array<{ id?: string; key: string }> =
    params.apiKeys?.length ? params.apiKeys : [{ key: apiKey }];
  const startupFailure = (
    status: number
  ): "KEY_INVALID" | "CREDITS_EXHAUSTED" | "RATE_LIMITED" | null => {
    if (status === 401 || status === 403) return "KEY_INVALID";
    if (status === 402) return "CREDITS_EXHAUSTED";
    if (status === 429) return "RATE_LIMITED";
    return null;
  };

  type FetchOutcome = { done: true } | { response: Response };
  const fetchWithKey = async (key: string): Promise<FetchOutcome> => {
    const doFetch = () =>
      fetchWithConnectTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          ...(provider === "openrouter" ? { "HTTP-Referer": "https://aistudio.google.com", "X-Title": "Claude Clone" } : {}),
        },
        body: JSON.stringify(payload),
        signal: abortSignal,
      }, params.connectTimeoutMs);
    const resp = await doFetch();
    // Check if reasoning parameters were rejected by model
    if (!resp.ok && hasReasoning && resp.status === 400) {
      const errText = await resp.text();
      if (/reasoning|unrecognized|unknown parameter|extra_fields/i.test(errText)) {
        payload = { ...basePayload };
        res.write(`data: ${JSON.stringify({ warning: "Reasoning parameters rejected by model, retried without them" })}\n\n`);
        return { response: await doFetch() };
      }
      // Non-reasoning 400 (e.g. decommissioned model): answer with a mapped
      // event instead of throwing the raw provider JSON at the client.
      const mapped = mapProviderError(400, errText, modelId);
      res.write(`data: ${JSON.stringify({ error: mapped.error, code: mapped.code, status: mapped.status })}\n\n`);
      res.write("data: [DONE]\n\n");
      return { done: true };
    }
    return { response: resp };
  };

  let response: Response | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    let outcome: FetchOutcome;
    try {
      outcome = await fetchWithKey(cand.key);
    } catch (err: any) {
      // User-initiated abort (stop button): close quietly without an error event.
      if (abortSignal?.aborted || err?.name === "AbortError") {
        res.write("data: [DONE]\n\n");
        return;
      }
      const raw = String(err?.message || "Upstream connection error");
      const looksJson = raw.trim().startsWith("{");
      const mapped = looksJson ? mapProviderError(502, raw, modelId) : null;
      res.write(`data: ${JSON.stringify({ error: mapped?.error || raw, code: mapped?.code ?? 502 })}\n\n`);
      res.write("data: [DONE]\n\n");
      return;
    }
    if ("done" in outcome) return;
    response = outcome.response;
    if (response.ok) break;
    const failure = startupFailure(response.status);
    if (!failure) break;
    // Notify even for the last candidate so a dead key is not retried next request.
    await onKeyFailure?.(cand.id || "", failure);
    if (i === candidates.length - 1) break;
    response = null; // rotate: the next candidate re-assigns it
  }
  if (!response) {
    res.write(`data: ${JSON.stringify({ error: "No API key could reach the provider", code: "KEY_MISSING", status: 400 })}\n\n`);
    res.write("data: [DONE]\n\n");
    return;
  }

  // Handle HTTP error statuses
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      res.write(`data: ${JSON.stringify({ error: "Invalid API key for provider", code: "KEY_INVALID", status: 400 })}\n\n`);
    } else if (response.status === 402) {
      res.write(`data: ${JSON.stringify({ error: "Credits exhausted or quota exceeded", code: "CREDITS_EXHAUSTED", status: 402 })}\n\n`);
    } else if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after") || "60";
      res.write(`data: ${JSON.stringify({ error: "Rate limit reached", code: "RATE_LIMITED", status: 429, retryAfter })}\n\n`);
    } else if (response.status === 404) {
      res.write(`data: ${JSON.stringify({ error: `Model '${modelId}' not found`, code: "MODEL_NOT_FOUND", status: 404 })}\n\n`);
    } else {
      const errBody = await response.text().catch(() => "");
      const mapped = mapProviderError(response.status, errBody, modelId);
      res.write(`data: ${JSON.stringify({ error: mapped.error, code: mapped.code, status: mapped.status, details: mapped.status === 400 ? undefined : errBody })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    return;
  }

  if (!response.body) {
    res.write(`data: ${JSON.stringify({ error: "No response body received from provider", code: 502 })}\n\n`);
    res.write("data: [DONE]\n\n");
    return;
  }

  // Stream SSE response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // A real completion carries upstream [DONE] or a finish_reason. If the
  // socket closes with neither, the provider cut the stream mid-generation
  // (common on very long responses) and must surface as an error — otherwise
  // the client treats the interruption as a successful, empty reply.
  let sawTerminator = false;

  try {
    while (true) {
      const { done, value } = await readWithIdleTimeout(reader, params.idleTimeoutMs ?? STREAM_IDLE_TIMEOUT_MS);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") {
          sawTerminator = true;
          res.write("data: [DONE]\n\n");
          return;
        }

        try {
          const parsed = JSON.parse(dataStr);
          const choice = parsed.choices?.[0];
          const delta = choice?.delta;

          if (delta) {
            const thinking = delta.reasoning || delta.thinking;
            if (thinking) {
              res.write(`data: ${JSON.stringify({ thinking })}\n\n`);
            }
            if (delta.content) {
              res.write(`data: ${JSON.stringify({ token: delta.content })}\n\n`);
            }
          }

          if (choice?.finish_reason) {
            sawTerminator = true;
            res.write(`data: ${JSON.stringify({ finish: choice.finish_reason })}\n\n`);
          }
        } catch {
          // Ignore incomplete chunk parse error
        }
      }
    }
    if (!sawTerminator) {
      res.write(
        `data: ${JSON.stringify({
          error: "The provider closed the stream before the response finished. Very long responses can be cut off — try again or split the task into smaller parts.",
          code: "STREAM_INTERRUPTED",
        })}\n\n`
      );
    }
    res.write("data: [DONE]\n\n");
  } catch (streamErr: any) {
    if (abortSignal?.aborted) return;
    res.write(`data: ${JSON.stringify({ error: streamErr.message || "Stream interrupted", code: streamErr.code ?? 500 })}\n\n`);
    res.write("data: [DONE]\n\n");
  }
}
