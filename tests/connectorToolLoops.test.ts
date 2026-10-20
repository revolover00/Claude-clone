import { afterEach, describe, expect, it, vi } from "vitest";
import { streamOpenAICompatibleChat } from "../server/lib/providers/streamChat";
import { pumpGeminiStream } from "../server/lib/chatStreamHelpers";

function responseSink() {
  const writes: string[] = [];
  return { writes, res: { write: (value: string) => { writes.push(value); return true; } } };
}

function sseResponse(events: Array<Record<string, any> | "[DONE]">): Response {
  const data = events.map((event) => `data: ${event === "[DONE]" ? event : JSON.stringify(event)}\n\n`).join("");
  return new Response(data, { headers: { "content-type": "text/event-stream" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MCP tool loop on OpenAI-compatible models", () => {
  it("runs a connector tool and continues the model response", async () => {
    const requestBodies: any[] = [];
    let requestIndex = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: any, init: RequestInit = {}) => {
      requestBodies.push(JSON.parse(String(init.body || "{}")));
      requestIndex++;
      if (requestIndex === 1) {
        return sseResponse([
          { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "mcp_abcd_search", arguments: "{\"query\":\"alpha\"}" } }] }, finish_reason: null }] },
          { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
          "[DONE]",
        ]);
      }
      return sseResponse([
        { choices: [{ delta: { content: "Found alpha in the connector." }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
        "[DONE]",
      ]);
    }) as any);

    const executeToolCall = vi.fn(async () => ({ result: "Tool result: alpha found", skillName: "My MCP / search" }));
    const { res, writes } = responseSink();
    await streamOpenAICompatibleChat({
      provider: "openai",
      endpoint: "https://api.openai.example/v1/chat/completions",
      modelId: "gpt-test",
      apiKey: "server-key",
      messages: [{ role: "user", content: "Search alpha" }],
      config: { systemInstruction: "Use connected tools when useful." },
      res,
      externalTools: [{ name: "mcp_abcd_search", description: "Search items", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } }],
      executeToolCall,
      idleTimeoutMs: 1000,
    });

    expect(executeToolCall).toHaveBeenCalledWith({ name: "mcp_abcd_search", args: { query: "alpha" } });
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0].tools[0].function.name).toBe("mcp_abcd_search");
    expect(requestBodies[1].messages.some((message: any) => message.role === "tool" && message.content === "Tool result: alpha found")).toBe(true);
    expect(writes.join("")).toContain("Found alpha in the connector.");
    expect(writes.join("")).toContain('"status":"completed"');
    expect(writes.join("")).toContain("data: [DONE]");
  });
});

describe("Gemini MCP tool loop", () => {
  it("supports a second MCP call from a tool continuation", async () => {
    const { res, writes } = responseSink();
    const executeToolCall = vi.fn(async (call: any) => ({ result: `result for ${call.name}`, skillName: call.name }));
    const continuationCalls: any[] = [];
    const runSkillToolStream = vi.fn(async (_modelId: string, history: any[], _config: any, call: any) => {
      continuationCalls.push({ history, call });
      if (call.name === "mcp_first") {
        return (async function* () {
          yield { candidates: [{ content: { parts: [{ functionCall: { name: "mcp_second", args: { value: "x" } } }] } }] };
        })();
      }
      return (async function* () {
        yield { candidates: [{ content: { parts: [{ text: "Finished after both tools." }] } }] };
      })();
    });

    await pumpGeminiStream({
      res,
      stream: (async function* () {
        yield { candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "mcp_first", args: {} } }] } }] };
      })(),
      abortCtrl: new AbortController(),
      userId: "user-1",
      modelId: "gemini-test",
      formattedMessages: [{ role: "user", parts: [{ text: "Use tools" }] }],
      config: { tools: [] },
      executeSkillFunctionCall: vi.fn(async () => ({ result: "fallback" })),
      executeToolCall,
      runSkillToolStream,
      idleTimeoutMs: 1000,
    });

    expect(executeToolCall).toHaveBeenCalledTimes(2);
    expect(continuationCalls).toHaveLength(2);
    expect(continuationCalls[1].history).toHaveLength(3);
    expect(writes.join("")).toContain("Finished after both tools.");
    expect(writes.join("")).toContain('"status":"completed"');
  });
});
