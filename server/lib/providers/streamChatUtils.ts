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
