import { describe, it, expect, vi, beforeEach } from "vitest";
import { getThinkingPlanAndConfig } from "../server/lib/thinkingRouter";
import * as geminiModule from "../server/lib/gemini";
import * as modelsStore from "../server/lib/modelsStore";
import { saveCredential } from "../server/lib/providers/credentialsStore";
import chatRouter from "../server/routes/chat";

const TEST_USER = "user-chat-thinking";

describe("Chat Route Thinking Regression Tests", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    // The chat route runs on the user's own key (the server ships none).
    await saveCredential(TEST_USER, "gemini", "default", "test-gemini-key-123456");
  });

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

    vi.spyOn(modelsStore, "getModelsFromDB").mockResolvedValue([
      {
        id: "gemini-3-8-flash",
        slug: "gemini-3-8-flash",
        display_name: "Gemini 3.8 Flash",
        provider: "google",
        api_model_id: "gemini-3.8-flash",
        kind: "chat",
        supports_thinking: true,
        supports_tools: false,
        supports_search: true,
        supports_vision: true,
        max_output_tokens: null,
        enabled: true,
        is_default: true,
        sort_order: 1,
      },
    ]);

    vi.spyOn(geminiModule, "startGeminiStream").mockImplementation(async (_apiKey, modelId, _messages, config) => {
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
      user: { id: TEST_USER },
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

  it("when the database read fails and the fallback list is used, the chat route still sends thinkingConfig with includeThoughts: true for gemini-3.* models", async () => {
    let capturedConfig: any = null;

    // Simulate database failure returning FALLBACK_MODELS (where Gemini 3.x have supports_thinking: true)
    vi.spyOn(modelsStore, "getModelsFromDB").mockResolvedValue(modelsStore.FALLBACK_MODELS);

    vi.spyOn(geminiModule, "startGeminiStream").mockImplementation(async (_apiKey, _modelId, _messages, config) => {
      capturedConfig = config;
      async function* emptyStream() {
        yield { text: () => "fallback stream response" };
      }
      return {
        stream: emptyStream(),
        fallbackApplied: false,
      };
    });

    const mockReq: any = {
      body: {
        messages: [{ role: "user", content: "Implement a binary search tree in TypeScript" }],
        model: "gemini-3-8-flash",
        extendedThinking: true,
        effort: "High",
      },
      user: { id: TEST_USER },
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

    const postRoute = chatRouter.stack.find((layer: any) => layer.route && layer.route.methods.post);
    expect(postRoute).toBeDefined();

    await postRoute!.route.stack[0].handle(mockReq, mockRes);

    expect(capturedConfig).toBeDefined();
    expect(capturedConfig.thinkingConfig).toBeDefined();
    expect(capturedConfig.thinkingConfig.includeThoughts).toBe(true);
    expect(capturedConfig.thinkingConfig.thinkingLevel).toBe("high");
  });
});
