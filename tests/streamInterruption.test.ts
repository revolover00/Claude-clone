import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamOpenAICompatibleChat } from "../server/lib/providers/streamChat";

/**
 * Regression tests for the root cause of the generic
 * "Unable to generate complete response / temporary disruption" card:
 * when the provider closes the stream WITHOUT [DONE]/finish_reason, the
 * adapter used to emit a silent-success [DONE] — the client completed an
 * empty or truncated reply as if it were fine. It must surface a real
 * STREAM_INTERRUPTED error instead (any model on any OpenAI-compatible
 * provider; reasoning models like gpt-oss-120b hit it most because content
 * arrives after a long thinking phase).
 */

function upstreamBody(chunks: string[], opts: { close: boolean } = { close: true }) {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
        return;
      }
      if (opts.close) controller.close();
      // else: stay open (never used — kept for symmetry)
    },
  });
}

function makeFetch(chunks: string[], close = true) {
  return vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => null },
    body: upstreamBody(chunks, { close }),
  } as any);
}

function makeParams() {
  const res = { write: vi.fn(), headersSent: true, writableEnded: false };
  return {
    res,
    params: {
      provider: "groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      modelId: "gpt-oss-120b",
      apiKey: "test-key",
      messages: [{ role: "user", content: "long task" }],
      config: {},
      res,
      abortSignal: new AbortController().signal,
    } as any,
  };
}

const written = (res: { write: ReturnType<typeof vi.fn> }) =>
  res.write.mock.calls.map((c) => String(c[0])).join("");

describe("streamOpenAICompatibleChat interruption handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports STREAM_INTERRUPTED when upstream closes with neither finish nor [DONE]", async () => {
    makeFetch([
      'data: {"choices":[{"delta":{"reasoning":"thinking about it"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"partial answer"}}]}\n\n',
      // socket ends abruptly: no finish_reason, no [DONE]
    ]);

    const { res, params } = makeParams();
    await streamOpenAICompatibleChat(params);

    const out = written(res);
    expect(out).toContain("STREAM_INTERRUPTED");
    expect(out).toContain("closed the stream before the response finished");
    expect(out).toContain("[DONE]");
    // tokens still passed through before the cut
    expect(out).toContain("partial answer");
  });

  it("completes normally when finish_reason arrived (even without upstream [DONE])", async () => {
    makeFetch([
      'data: {"choices":[{"delta":{"content":"done"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    ]);

    const { res, params } = makeParams();
    await streamOpenAICompatibleChat(params);

    const out = written(res);
    expect(out).not.toContain("STREAM_INTERRUPTED");
    expect(out).not.toContain('"error"');
    expect(out).toContain("[DONE]");
    expect(out).toContain("done");
  });

  it("passes through upstream [DONE] as a clean completion", async () => {
    makeFetch([
      'data: {"choices":[{"delta":{"content":"hi"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    const { res, params } = makeParams();
    await streamOpenAICompatibleChat(params);

    const out = written(res);
    expect(out).not.toContain("STREAM_INTERRUPTED");
    expect(out).not.toContain('"error"');
    expect(out).toContain("[DONE]");
    expect(out).toContain('"finish":"stop"');
  });

  it("does not fabricate an interruption on a user abort", async () => {
    const abort = new AbortController();
    abort.abort();
    const encoder = new TextEncoder();
    vi.spyOn(global, "fetch").mockImplementation(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: { get: () => null },
          // Real fetch bodies reject with AbortError once the signal fires;
          // model that so the reader loop terminates like production does.
          body: new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"x"}}]}\n\n'));
            },
            pull() {
              const err = new Error("The operation was aborted.");
              err.name = "AbortError";
              throw err;
            },
          }),
        }) as any
    );

    const { res } = makeParams();
    await streamOpenAICompatibleChat({
      provider: "groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      modelId: "gpt-oss-120b",
      apiKey: "k",
      messages: [],
      config: {},
      res,
      abortSignal: abort.signal,
    } as any);

    expect(written(res)).not.toContain("STREAM_INTERRUPTED");
  });
});
