import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/utils/authHeaders", () => ({ authFetch: vi.fn() }));

import { streamRealResponse, type ChatStreamOptions } from "../src/utils/streamResponse";
import { authFetch } from "../src/utils/authHeaders";

/**
 * Client liveness watchdog: neither the /api/chat fetch nor the SSE reader
 * may hang forever — a silent socket becomes onError(code 504), which the
 * auto-retry policy treats as a transient 5xx and re-requests once.
 */

const opts: ChatStreamOptions = {
  messages: [],
  style: "default",
  profileInstructions: "",
  model: "groq:test-model",
  effort: "medium",
  webSearch: false,
  extendedThinking: false,
  language: "en",
};

const enc = new TextEncoder();
const respWithRead = (read: () => Promise<any>) =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => "text/event-stream" },
    body: { getReader: () => ({ read }) },
  }) as any;

const run = (runtime?: { idleTimeoutMs?: number }) =>
  new Promise<{ type: string; err?: any; text?: string }>((resolve) => {
    streamRealResponse(
      "prompt",
      new AbortController().signal,
      opts,
      {
        onDone: (t) => resolve({ type: "done", text: t }),
        onError: (e) => resolve({ type: "error", err: e }),
      },
      runtime
    );
  });

describe("streamRealResponse idle watchdog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("errors with code 504 when the SSE reader goes silent", async () => {
    vi.mocked(authFetch).mockResolvedValue(respWithRead(() => new Promise<never>(() => {})));
    const out = await run({ idleTimeoutMs: 30 });
    expect(out.type).toBe("error");
    expect(out.err.code).toBe(504);
    expect(out.err.message).toContain("stopped responding");
  });

  it("errors with code 504 when the /api/chat fetch never returns", async () => {
    vi.mocked(authFetch).mockReturnValue(new Promise<never>(() => {}));
    const out = await run({ idleTimeoutMs: 30 });
    expect(out.type).toBe("error");
    expect(out.err.code).toBe(504);
    expect(out.err.message).toContain("did not respond");
  });

  it("does not false-positive on a normal streaming reply", async () => {
    const chunk = enc.encode('data: {"token":"Hello there"}\n\ndata: [DONE]\n\n');
    let reads = 0;
    vi.mocked(authFetch).mockResolvedValue(
      respWithRead(async () => (reads++ === 0 ? { done: false, value: chunk } : { done: true }))
    );
    const out = await run({ idleTimeoutMs: 200 });
    expect(out.type).toBe("done");
    expect(out.text).toBe("Hello there");
  });
});
