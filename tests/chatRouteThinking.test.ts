import { describe, it, expect, vi } from "vitest";
import { getThinkingPlanAndConfig } from "../server/lib/thinkingRouter";
import * as geminiModule from "../server/lib/gemini";
import chatRouter from "../server/routes/chat";

describe("Chat Route Thinking Regression Tests", () => {
  it("for provider 'gemini' + a Gemini 3 model + the toggle OFF and ON, config.includeThoughts is true", () => {
    // Toggle OFF
    const off = getThinkingPlanAndConfig(
      "gemini",
      "gemini-3.8-flash",
      { content: "test message" },
      { extendedThinking: false }
    );
    expect(off.config.includeThoughts).toBe(true);
    expect(off.config.thinkingLevel).toBeDefined();

    // Toggle ON
    const on = getThinkingPlanAndConfig(
      "gemini",
      "gemini-3.8-flash",
      { content: "test message" },
      { extendedThinking: true, effort: "High" }
    );
    expect(on.config.includeThoughts).toBe(true);
    expect(on.config.thinkingLevel).toBe("high");
  });

  it("chat route builds config with the right provider/model (mocking Gemini stream)", async () => {
    let capturedModelId = "";
    let capturedConfig: any = null;

    vi.spyOn(geminiModule, "startGeminiStream").mockImplementation(async (modelId, _messages, config) => {
      capturedModelId = modelId;
      capturedConfig = config;
      async function* emptyStream() {
        yield { text: () => "mock response" };
      }
      return {
        stream: emptyStream(),
        fallbackApplied: false,
      };
    });

    const mockReq: any = {
      body: {
        messages: [{ role: "user", content: "Write a quick test function" }],
        model: "gemini-3.8-flash",
        extendedThinking: true,
        effort: "High",
      },
      on: vi.fn(),
    };

    const writtenChunks: string[] = [];
    const mockRes: any = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn((chunk: string) => writtenChunks.push(chunk)),
      end: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      headersSent: true,
    };

    // Find the POST "/" route layer in chatRouter
    const postRoute = chatRouter.stack.find((layer: any) => layer.route && layer.route.methods.post);
    expect(postRoute).toBeDefined();

    await postRoute!.route.stack[0].handle(mockReq, mockRes);

    expect(capturedModelId).toBe("gemini-3.8-flash");
    expect(capturedConfig).toBeDefined();
    expect(capturedConfig.thinkingConfig).toBeDefined();
    expect(capturedConfig.thinkingConfig.includeThoughts).toBe(true);
    expect(capturedConfig.thinkingConfig.thinkingLevel).toBe("high");

    // SSE wrote thinkingPlan
    const planChunk = writtenChunks.find((c) => c.includes("thinkingPlan"));
    expect(planChunk).toBeDefined();
  });
});
