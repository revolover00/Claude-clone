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

export async function streamOpenAICompatibleChat(params: StreamChatParams): Promise<void> {
  const { provider, endpoint, modelId, apiKey, messages, config, res, abortSignal, thinkingPlan, onInvalidKey } = params;

  const openaiMessages = formatOpenAIMessages(messages, config?.systemInstruction);
  const basePayload: Record<string, any> = {
    model: modelId,
    messages: openaiMessages,
    stream: true,
  };

  const reasoningPayload = thinkingPlan?.level ? buildReasoningPayload(provider, thinkingPlan.level) : {};
  const hasReasoning = Object.keys(reasoningPayload).length > 0;
  let payload = hasReasoning ? { ...basePayload, ...reasoningPayload } : { ...basePayload };

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider === "openrouter" ? { "HTTP-Referer": "https://aistudio.google.com", "X-Title": "Claude Clone" } : {}),
      },
      body: JSON.stringify(payload),
      signal: abortSignal,
    });

    // Check if reasoning parameters were rejected by model
    if (!response.ok && hasReasoning && response.status === 400) {
      const errText = await response.text();
      if (/reasoning|unrecognized|unknown parameter|extra_fields/i.test(errText)) {
        payload = { ...basePayload };
        res.write(`data: ${JSON.stringify({ warning: "Reasoning parameters rejected by model, retried without them" })}\n\n`);
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(provider === "openrouter" ? { "HTTP-Referer": "https://aistudio.google.com", "X-Title": "Claude Clone" } : {}),
          },
          body: JSON.stringify(payload),
          signal: abortSignal,
        });
      } else {
        // Re-wrap text into response-like error
        throw new Error(errText);
      }
    }
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message || "Upstream connection error", code: 502 })}\n\n`);
    res.write("data: [DONE]\n\n");
    return;
  }

  // Handle HTTP error statuses
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await onInvalidKey?.();
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
      res.write(`data: ${JSON.stringify({ error: `Provider error (${response.status})`, details: errBody, code: response.status })}\n\n`);
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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") {
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
            res.write(`data: ${JSON.stringify({ finish: choice.finish_reason })}\n\n`);
          }
        } catch {
          // Ignore incomplete chunk parse error
        }
      }
    }
    res.write("data: [DONE]\n\n");
  } catch (streamErr: any) {
    if (abortSignal?.aborted) return;
    res.write(`data: ${JSON.stringify({ error: streamErr.message || "Stream interrupted", code: 500 })}\n\n`);
    res.write("data: [DONE]\n\n");
  }
}
