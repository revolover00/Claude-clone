import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamOpenAICompatibleChat } from "../server/lib/providers/streamChat";

/**
 * The transport rotates through priority-ordered keys BEFORE the first
 * streamed byte: an exhausted (402) or invalid (401/403) key hands over to
 * the next candidate instead of surfacing an error, and every dead key is
 * reported via onKeyFailure so the store can mark it.
 */

function okStream() {
  const enc = new TextEncoder();
  const chunks = [
    'data: {"choices":[{"delta":{"content":"fallback works"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
  ];
  let i = 0;
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => null },
    body: new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
        else controller.close();
      },
    }),
  } as any;
}

function status(code: number) {
  return {
    ok: false,
    status: code,
    statusText: "ERR",
    headers: { get: () => null },
    text: async () => `{"error":{"message":"upstream ${code}"}}`,
  } as any;
}

function makeParams(overrides: Record<string, any> = {}) {
  const res = { write: vi.fn(), headersSent: true, writableEnded: false };
  return {
    res,
    params: {
      provider: "groq",
      endpoint: "http://localhost:0/chat",
      modelId: "test-model",
      apiKey: "primary-key",
      messages: [{ role: "user", content: "hi" }],
      config: {},
      res,
      abortSignal: new AbortController().signal,
      ...overrides,
    } as any,
  };
}

const written = (res: { write: ReturnType<typeof vi.fn> }) =>
  res.write.mock.calls.map((c) => String(c[0])).join("");

describe("streamOpenAICompatibleChat key fallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rotates past an exhausted key and streams with the next one", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(status(402))
      .mockResolvedValueOnce(okStream());

    const onKeyFailure = vi.fn();
    const { res, params } = makeParams({
      apiKeys: [
        { id: "cred-1", key: "spent-key" },
        { id: "cred-2", key: "fresh-key" },
      ],
      onKeyFailure,
    });
    await streamOpenAICompatibleChat(params);

    const out = written(res);
    expect(onKeyFailure).toHaveBeenCalledWith("cred-1", "CREDITS_EXHAUSTED");
    expect(onKeyFailure).toHaveBeenCalledTimes(1);
    expect(out).toContain("fallback works");
    expect(out).toContain("[DONE]");
    expect(out).not.toContain("CREDITS_EXHAUSTED");
    const secondInit = spy.mock.calls[1][1] as any;
    expect(secondInit.headers.Authorization).toBe("Bearer fresh-key");
  });

  it("reports the chain as exhausted when every key fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(status(401));
    const onKeyFailure = vi.fn();
    const { res, params } = makeParams({
      apiKeys: [
        { id: "c1", key: "k1" },
        { id: "c2", key: "k2" },
      ],
      onKeyFailure,
    });
    await streamOpenAICompatibleChat(params);

    const out = written(res);
    expect(onKeyFailure).toHaveBeenCalledTimes(2);
    expect(onKeyFailure).toHaveBeenNthCalledWith(1, "c1", "KEY_INVALID");
    expect(onKeyFailure).toHaveBeenNthCalledWith(2, "c2", "KEY_INVALID");
    expect(out).toContain("KEY_INVALID");
    expect(out).toContain("[DONE]");
  });

  it("single-key requests keep the old behavior: RATE_LIMITED surfaces", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(status(429));
    const onKeyFailure = vi.fn();
    const { res, params } = makeParams({ onKeyFailure });
    await streamOpenAICompatibleChat(params);

    const out = written(res);
    expect(out).toContain("RATE_LIMITED");
    expect(out).toContain("[DONE]");
    // No id available for a bare key → reported with an empty id (no-op in the store).
    expect(onKeyFailure).toHaveBeenCalledWith("", "RATE_LIMITED");
  });

  it("does not rotate on non-key failures (model missing)", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(status(404));
    const onKeyFailure = vi.fn();
    const { res, params } = makeParams({
      apiKeys: [
        { id: "c1", key: "k1" },
        { id: "c2", key: "k2" },
      ],
      onKeyFailure,
    });
    await streamOpenAICompatibleChat(params);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(onKeyFailure).not.toHaveBeenCalled();
    expect(written(res)).toContain("MODEL_NOT_FOUND");
  });
});
