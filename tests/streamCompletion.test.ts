import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamRealResponse } from "../src/utils/streamResponse";

/**
 * The send button unfreezes only when the stream completes. Regression tests
 * for the stuck-button bug: `data: [DONE]` is the protocol-level end, so
 * completion must fire even when the response socket never closes (and an
 * error event followed by [DONE] must still surface as an error).
 */

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  let i = 0;
  // Never closes: `reader.read()` would hang forever after the last chunk.
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(encoder.encode(chunks[i++]));
      // else: stay open — deliberately no close().
    },
  });
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => null },
    body: stream,
  } as any;
}

const options = {
  messages: [],
  style: "normal",
  profileInstructions: "",
  model: "test-model",
  effort: "medium",
  webSearch: false,
  extendedThinking: false,
  language: "en",
};

describe("stream completion driven by [DONE]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fires onDone as soon as [DONE] arrives even if the socket never closes", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      sseResponse([
        'data: {"token":"Hello"}\n\n',
        'data: {"finish":"stop"}\n\n',
        "data: [DONE]\n\n",
      ])
    );

    const tokens: string[] = [];
    const onDone = vi.fn();
    const onError = vi.fn();

    streamRealResponse("hi", new AbortController().signal, options, {
      onToken: (t) => tokens.push(t),
      onDone,
      onError,
    });

    // Settles quickly even though the response stream is never closed.
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(onDone).toHaveBeenCalledWith("Hello");
    expect(onError).not.toHaveBeenCalled();
    expect(tokens).toEqual(["Hello"]);
  });

  it("routes an error event (even followed by [DONE]) to onError, not onDone", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      sseResponse([
        'data: {"error":"Model retired","code":"MODEL_NOT_FOUND"}\n\n',
        "data: [DONE]\n\n",
      ])
    );

    const onDone = vi.fn();
    const onError = vi.fn();

    streamRealResponse("hi", new AbortController().signal, options, { onDone, onError });

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect((onError.mock.calls[0][0] as any).code).toBe("MODEL_NOT_FOUND");
    expect(onDone).not.toHaveBeenCalled();
  });
});
