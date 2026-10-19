import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readWithIdleTimeout, fetchWithConnectTimeout, IdleTimeoutError, STREAM_IDLE_TIMEOUT_MS } from "../server/lib/providers/streamIdle";
import { streamOpenAICompatibleChat } from "../server/lib/providers/streamChat";
import { pumpGeminiStream } from "../server/lib/chatStreamHelpers";

/**
 * The hang fix: a provider socket that goes silent must TERMINATE the SSE
 * response with a STREAM_INTERRUPTED error (which the client auto-retries)
 * instead of leaving the composer spinning forever.
 */

const written = (res: { write: ReturnType<typeof vi.fn> }) =>
  res.write.mock.calls.map((c) => String(c[0])).join("");

describe("readWithIdleTimeout", () => {
  it("resolves promptly when data flows", async () => {
    const reader = { read: async () => ({ done: false, value: "x" }) };
    await expect(readWithIdleTimeout(reader, 50)).resolves.toEqual({ done: false, value: "x" });
  });

  it("raises a STREAM_INTERRUPTED error when the reader goes silent", async () => {
    const reader = { read: () => new Promise<never>(() => {}) };
    const err = await readWithIdleTimeout(reader, 25).catch((e) => e);
    expect(err).toBeInstanceOf(IdleTimeoutError);
    expect(err.code).toBe("STREAM_INTERRUPTED");
    expect(err.message).toContain("stopped responding");
  });

  it("ships a sane production default", () => {
    expect(STREAM_IDLE_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
  });
});

describe("streamOpenAICompatibleChat idle watchdog", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("emits STREAM_INTERRUPTED + [DONE] when upstream hangs mid-stream", async () => {
    const enc = new TextEncoder();
    const hangingBody = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"first chunk"}}]}\n\n'));
      },
      pull() {
        return new Promise<never>(() => {}); // second read never settles
      },
    });
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      body: hangingBody,
    } as any);

    const res = { write: vi.fn(), headersSent: true, writableEnded: false };
    await streamOpenAICompatibleChat({
      provider: "groq",
      endpoint: "http://localhost:0/chat",
      modelId: "m",
      apiKey: "k",
      messages: [{ role: "user", content: "hi" }],
      config: {},
      res,
      abortSignal: new AbortController().signal,
      idleTimeoutMs: 30,
    } as any);

    const out = written(res);
    expect(out).toContain("first chunk");
    expect(out).toContain("STREAM_INTERRUPTED");
    expect(out).toContain("stopped responding");
    expect(out).toContain("[DONE]");
  });
});

const makeRes = () => ({ write: vi.fn(), headersSent: true, writableEnded: false });
const pumpArgs = (stream: any, res: any, idleTimeoutMs?: number) => ({
  res,
  stream,
  abortCtrl: new AbortController(),
  modelId: "gemini-test",
  formattedMessages: [],
  config: {},
  executeSkillFunctionCall: vi.fn(() => {
    throw new Error("not used");
  }),
  runSkillToolStream: vi.fn(() => {
    throw new Error("not used");
  }),
  idleTimeoutMs,
});

const iterOf = (items: any[], hangAfter = false) => ({
  [Symbol.asyncIterator]() {
    let i = 0;
    return {
      next: () => {
        if (i < items.length) return Promise.resolve({ done: false, value: items[i++] });
        if (hangAfter) return new Promise<never>(() => {});
        return Promise.resolve({ done: true, value: undefined });
      },
    };
  },
});

describe("pumpGeminiStream watchdog", () => {
  it("completes normally when finishReason arrives", async () => {
    const res = makeRes();
    const stream = iterOf([
      { candidates: [{ content: { parts: [{ text: "Hello" }] } }] },
      { candidates: [{ content: { parts: [{ text: " world" }] }, finishReason: "STOP" }] },
    ]);
    await pumpGeminiStream(pumpArgs(stream, res, 100) as any);
    const out = written(res);
    expect(out).toContain("Hello");
    expect(out).toContain("world");
    expect(out).toContain('"finish"');
    expect(out).not.toContain("STREAM_INTERRUPTED");
    expect(out).toContain("[DONE]");
  });

  it("terminates with STREAM_INTERRUPTED when the Gemini stream hangs silently", async () => {
    const res = makeRes();
    const stream = iterOf([{ candidates: [{ content: { parts: [{ text: "partial" }] } }] }], true);
    await pumpGeminiStream(pumpArgs(stream, res, 30) as any);
    const out = written(res);
    expect(out).toContain("partial");
    expect(out).toContain("STREAM_INTERRUPTED");
    expect(out).toContain("[DONE]");
  });
});

describe("fetchWithConnectTimeout", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fails with a 504 when the provider never answers", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      (_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }))
          );
        }) as any
    );
    const err = await fetchWithConnectTimeout("http://provider.test/v1", {}, 25).catch((e) => e);
    expect(err.code).toBe(504);
    expect(err.message).toContain("did not start responding");
  });

  it("passes the response through when the provider answers in time", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200 } as any);
    const res = await fetchWithConnectTimeout("http://provider.test/v1", {}, 500);
    expect(res.status).toBe(200);
  });
});
