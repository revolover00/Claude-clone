import { describe, it, expect } from "vitest";
import { shouldAutoRetryStream } from "../src/components/chat/streamRetry";

describe("shouldAutoRetryStream", () => {
  it("retries a true transport failure when nothing is rendered yet", () => {
    expect(shouldAutoRetryStream({ message: "Backend unreachable" }, false, 0)).toBe(true);
    expect(shouldAutoRetryStream({ message: "Backend unreachable", code: 502 }, false, 0)).toBe(true);
    expect(shouldAutoRetryStream({ message: "any", code: 500 }, false, 1)).toBe(true);
  });

  it("never retries once any reply content is on screen", () => {
    // This is the duplicated-answer bug: a retry re-runs the full prompt and
    // appends a second copy after the rendered one.
    expect(shouldAutoRetryStream({ message: "Backend unreachable", code: 502 }, true, 0)).toBe(false);
    expect(shouldAutoRetryStream({ message: "raw upstream JSON", code: 502 }, true, 1)).toBe(false);
  });

  it("never retries explicit provider errors (4xx / coded)", () => {
    expect(shouldAutoRetryStream({ message: '{"error":{...}}', code: 400 }, false, 0)).toBe(false);
    expect(shouldAutoRetryStream({ message: "Model retired", code: "MODEL_NOT_FOUND" }, false, 0)).toBe(false);
    expect(shouldAutoRetryStream({ message: "No API key", code: "KEY_MISSING" }, false, 0)).toBe(false);
    expect(shouldAutoRetryStream({ message: "anything", code: 404 }, false, 0)).toBe(false);
  });

  it("retries a provider-cut stream only while nothing is on screen", () => {
    const cut = { message: "The provider closed the stream before the response finished.", code: "STREAM_INTERRUPTED" };
    expect(shouldAutoRetryStream(cut, false, 0)).toBe(true);
    expect(shouldAutoRetryStream(cut, false, 1)).toBe(true);
    expect(shouldAutoRetryStream(cut, false, 2)).toBe(false);
    // Partial content must never be re-sent (it would duplicate the reply).
    expect(shouldAutoRetryStream(cut, true, 0)).toBe(false);
  });

  it("stops retrying after the attempt budget", () => {
    expect(shouldAutoRetryStream({ message: "Backend unreachable", code: 502 }, false, 2)).toBe(false);
    expect(shouldAutoRetryStream({ message: "Backend unreachable", code: 502 }, false, 1)).toBe(true);
  });
});
