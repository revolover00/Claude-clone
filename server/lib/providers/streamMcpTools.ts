import { randomUUID } from "node:crypto";
import { fetchWithConnectTimeout, readWithIdleTimeout, STREAM_IDLE_TIMEOUT_MS } from "./streamIdle";
import { toOpenAiSchema } from "../connectors/toolRegistry";
import type { StreamChatParams } from "./streamChat";
import { buildReasoningPayload, formatOpenAIMessages, mapProviderError } from "./streamChatUtils";

interface OpenAIToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

function buildOpenAIToolDefinitions(tools: Array<Record<string, any>>): Array<Record<string, any>> {
  return tools.slice(0, 80).map((tool) => ({
    type: "function",
    function: {
      name: String(tool.name || "").slice(0, 64),
      description: String(tool.description || "").slice(0, 1500),
      parameters: toOpenAiSchema(tool.parameters),
    },
  })).filter((tool) => tool.function.name);
}

export async function streamWithMcpTools(params: StreamChatParams): Promise<void> {
  const { provider, endpoint, modelId, messages, config, res, abortSignal, thinkingPlan, onKeyFailure } = params;
  const openaiMessages = formatOpenAIMessages(messages, config?.systemInstruction);
  const toolDefinitions = buildOpenAIToolDefinitions(params.externalTools || []);
  if (toolDefinitions.length === 0) return;
  const basePayload: Record<string, any> = {
    model: modelId,
    messages: openaiMessages,
    stream: true,
    tools: toolDefinitions,
    tool_choice: "auto",
  };
  const reasoningPayload = thinkingPlan?.level ? buildReasoningPayload(provider, thinkingPlan.level) : {};
  let payload: Record<string, any> = { ...basePayload, ...reasoningPayload };
  let hasReasoning = Object.keys(reasoningPayload).length > 0;
  const candidates = params.apiKeys?.length ? params.apiKeys : [{ key: params.apiKey }];
  const startupFailure = (status: number): "KEY_INVALID" | "CREDITS_EXHAUSTED" | "RATE_LIMITED" | null => {
    if (status === 401 || status === 403) return "KEY_INVALID";
    if (status === 402) return "CREDITS_EXHAUSTED";
    if (status === 429) return "RATE_LIMITED";
    return null;
  };

  const fetchWithKey = async (key: string): Promise<{ done: true } | { response: Response }> => {
    const doFetch = () => fetchWithConnectTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        ...(provider === "openrouter" ? { "HTTP-Referer": "https://aistudio.google.com", "X-Title": "Claude Clone" } : {}),
      },
      body: JSON.stringify(payload),
      signal: abortSignal,
    }, params.connectTimeoutMs);
    let response = await doFetch();
    if (!response.ok && hasReasoning && response.status === 400) {
      const body = await response.text().catch(() => "");
      if (/reasoning|unrecognized|unknown parameter|extra_fields/i.test(body)) {
        payload = { ...payload };
        for (const keyName of Object.keys(reasoningPayload)) delete payload[keyName];
        hasReasoning = false;
        res.write(`data: ${JSON.stringify({ warning: "Reasoning parameters rejected by model, retried without them" })}\n\n`);
        response = await doFetch();
      } else {
        const mapped = mapProviderError(400, body, modelId);
        res.write(`data: ${JSON.stringify({ error: mapped.error, code: mapped.code, status: mapped.status })}\n\n`);
        res.write("data: [DONE]\n\n");
        return { done: true };
      }
    }
    return { response };
  };

  let response: Response | null = null;
  let activeKey = "";
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    let outcome: { done: true } | { response: Response };
    try {
      outcome = await fetchWithKey(candidate.key);
    } catch (error: any) {
      if (abortSignal?.aborted || error?.name === "AbortError") {
        res.write("data: [DONE]\n\n");
        return;
      }
      res.write(`data: ${JSON.stringify({ error: String(error?.message || "Upstream connection error"), code: 502 })}\n\n`);
      res.write("data: [DONE]\n\n");
      return;
    }
    if ("done" in outcome) return;
    response = outcome.response;
    if (response.ok) {
      activeKey = candidate.key;
      break;
    }
    const failure = startupFailure(response.status);
    if (!failure) break;
    await onKeyFailure?.(candidate.id || "", failure);
    if (index < candidates.length - 1) response = null;
  }

  const writeHttpError = async (failedResponse: Response) => {
    if (failedResponse.status === 401 || failedResponse.status === 403) {
      res.write(`data: ${JSON.stringify({ error: "Invalid API key for provider", code: "KEY_INVALID", status: 400 })}\n\n`);
    } else if (failedResponse.status === 402) {
      res.write(`data: ${JSON.stringify({ error: "Credits exhausted or quota exceeded", code: "CREDITS_EXHAUSTED", status: 402 })}\n\n`);
    } else if (failedResponse.status === 429) {
      const retryAfter = failedResponse.headers.get("retry-after") || "60";
      res.write(`data: ${JSON.stringify({ error: "Rate limit reached", code: "RATE_LIMITED", status: 429, retryAfter })}\n\n`);
    } else if (failedResponse.status === 404) {
      res.write(`data: ${JSON.stringify({ error: `Model '${modelId}' not found`, code: "MODEL_NOT_FOUND", status: 404 })}\n\n`);
    } else {
      const body = await failedResponse.text().catch(() => "");
      const mapped = mapProviderError(failedResponse.status, body, modelId);
      res.write(`data: ${JSON.stringify({ error: mapped.error, code: mapped.code, status: mapped.status, details: mapped.status === 400 ? undefined : body })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
  };

  const maxToolCalls = 5;
  let executedToolCalls = 0;
  let currentResponse = response;
  for (let round = 0; round <= maxToolCalls; round++) {
    if (abortSignal?.aborted) return;
    if (!currentResponse) {
      let outcome: { done: true } | { response: Response };
      try {
        outcome = await fetchWithKey(activeKey);
      } catch (error: any) {
        if (abortSignal?.aborted || error?.name === "AbortError") return;
        res.write(`data: ${JSON.stringify({ error: String(error?.message || "Upstream connection error"), code: 502 })}\n\n`);
        res.write("data: [DONE]\n\n");
        return;
      }
      if ("done" in outcome) return;
      currentResponse = outcome.response;
    }
    if (!currentResponse.ok) {
      await writeHttpError(currentResponse);
      return;
    }
    if (!currentResponse.body) {
      res.write(`data: ${JSON.stringify({ error: "No response body received from provider", code: 502 })}\n\n`);
      res.write("data: [DONE]\n\n");
      return;
    }

    const reader = currentResponse.body.getReader();
    const decoder = new TextDecoder();
    const toolCalls = new Map<number, OpenAIToolCall>();
    let buffer = "";
    let assistantContent = "";
    let finishReason: string | null = null;
    let sawTerminator = false;
    let interrupted = false;

    const consumeLine = (line: string): boolean => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return false;
      const data = trimmed.slice(5).trim();
      if (!data) return false;
      if (data === "[DONE]") {
        sawTerminator = true;
        return true;
      }
      try {
        const parsed = JSON.parse(data);
        const choice = parsed.choices?.[0];
        const delta = choice?.delta;
        if (delta) {
          const thinking = delta.reasoning || delta.thinking;
          if (thinking) res.write(`data: ${JSON.stringify({ thinking })}\n\n`);
          if (typeof delta.content === "string" && delta.content) {
            assistantContent += delta.content;
            res.write(`data: ${JSON.stringify({ token: delta.content })}\n\n`);
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const call of delta.tool_calls) {
              const index = Number.isInteger(call.index) ? call.index : 0;
              const previous = toolCalls.get(index) || { index, id: "", name: "", arguments: "" };
              if (typeof call.id === "string") previous.id += call.id;
              if (typeof call.function?.name === "string") previous.name += call.function.name;
              if (typeof call.function?.arguments === "string") previous.arguments += call.function.arguments;
              toolCalls.set(index, previous);
            }
          }
        }
        if (choice?.finish_reason) {
          finishReason = String(choice.finish_reason);
          if (finishReason !== "tool_calls") res.write(`data: ${JSON.stringify({ finish: finishReason })}\n\n`);
        }
      } catch {
        // Ignore provider keepalives and incomplete JSON fragments.
      }
      return false;
    };

    try {
      streamLoop: while (true) {
        const { done, value } = await readWithIdleTimeout(reader, params.idleTimeoutMs ?? STREAM_IDLE_TIMEOUT_MS);
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (consumeLine(line)) break streamLoop;
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeLine(buffer);
    } catch (error: any) {
      if (abortSignal?.aborted) return;
      interrupted = true;
      res.write(`data: ${JSON.stringify({ error: error?.message || "Stream interrupted", code: error?.code ?? 500 })}\n\n`);
    } finally {
      reader.releaseLock();
    }

    if (interrupted || (!sawTerminator && !finishReason)) {
      if (!interrupted) {
        res.write(`data: ${JSON.stringify({ error: "The provider closed the stream before the response finished.", code: "STREAM_INTERRUPTED" })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      return;
    }

    const calls = [...toolCalls.values()].sort((a, b) => a.index - b.index).filter((call) => call.name);
    if (calls.length === 0) {
      if (finishReason === "tool_calls") res.write(`data: ${JSON.stringify({ finish: "stop" })}\n\n`);
      res.write("data: [DONE]\n\n");
      return;
    }

    payload.messages.push({
      role: "assistant",
      content: assistantContent || null,
      tool_calls: calls.map((call) => ({
        id: call.id || randomUUID(),
        type: "function",
        function: { name: call.name, arguments: call.arguments || "{}" },
      })),
    });
    const assistantToolCalls = payload.messages[payload.messages.length - 1].tool_calls;
    for (let index = 0; index < calls.length; index++) {
      const call = calls[index];
      const toolCallId = assistantToolCalls[index].id;
      if (executedToolCalls >= maxToolCalls) {
        const eventId = randomUUID();
        res.write(`data: ${JSON.stringify({ tool: { id: eventId, name: call.name, skill: call.name, status: "error" }})}\n\n`);
        res.write(`data: ${JSON.stringify({ error: "MCP tool-call limit reached for this reply.", code: "TOOL_CALL_LIMIT" })}\n\n`);
        res.write("data: [DONE]\n\n");
        return;
      }
      executedToolCalls++;
      const eventId = randomUUID();
      let args: Record<string, any> = {};
      let toolResult: { result: string; skillName?: string; toolError?: boolean } | null = null;
      let errorMessage = "";
      try {
        const parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
        args = parsedArgs && typeof parsedArgs === "object" && !Array.isArray(parsedArgs) ? parsedArgs : {};
      } catch {
        errorMessage = "The model returned invalid JSON arguments for this tool.";
      }
      res.write(`data: ${JSON.stringify({ tool: { id: eventId, name: call.name, skill: call.name, status: "executing" } })}\n\n`);
      if (!errorMessage) {
        try {
          toolResult = await params.executeToolCall?.({ name: call.name, args }) || null;
        } catch (error: any) {
          errorMessage = String(error?.message || "Tool execution failed").slice(0, 300);
        }
      }
      const output = toolResult?.result || errorMessage || "This connector tool is no longer available.";
      const toolStatus = errorMessage || toolResult?.toolError || !toolResult ? "error" : "completed";
      res.write(`data: ${JSON.stringify({ tool: { id: eventId, name: call.name, skill: toolResult?.skillName || call.name, status: toolStatus } })}\n\n`);
      payload.messages.push({ role: "tool", tool_call_id: toolCallId, content: output.slice(0, 80_000) });
    }
    currentResponse = null;
  }

  res.write(`data: ${JSON.stringify({ error: "The connector tool loop exceeded its limit.", code: "TOOL_CALL_LIMIT" })}\n\n`);
  res.write("data: [DONE]\n\n");
}
