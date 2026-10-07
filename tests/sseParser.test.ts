import { describe, it, expect, vi } from "vitest";
import { SSEParser } from "../src/utils/sseParser";

describe("SSEParser", () => {
  it("parses normal tokens correctly", () => {
    const onToken = vi.fn();
    const parser = new SSEParser({ onToken });

    parser.feed('data: {"token": "Hello "}\n\ndata: {"token": "World!"}\n\n');

    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenNthCalledWith(1, "Hello ");
    expect(onToken).toHaveBeenNthCalledWith(2, "World!");
  });

  it("parses thinking chunks correctly", () => {
    const onThinking = vi.fn();
    const onToken = vi.fn();
    const parser = new SSEParser({ onThinking, onToken });

    parser.feed('data: {"thinking": "Analyzing request..."}\n\n');
    parser.feed('data: {"thinking": "Done thinking."}\n\n');
    parser.feed('data: {"token": "Here is the answer."}\n\n');

    expect(onThinking).toHaveBeenCalledTimes(2);
    expect(onThinking).toHaveBeenNthCalledWith(1, "Analyzing request...");
    expect(onThinking).toHaveBeenNthCalledWith(2, "Done thinking.");
    expect(onToken).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledWith("Here is the answer.");
  });

  it("handles error events mid-stream without swallowing in JSON try/catch", () => {
    const onToken = vi.fn();
    const onError = vi.fn();
    const parser = new SSEParser({ onToken, onError });

    parser.feed('data: {"token": "Beginning of response"}\n\n');
    expect(onToken).toHaveBeenCalledTimes(1);

    // Send mid-stream error
    parser.feed('data: {"error": "Rate limit reached, try again in a minute", "code": 429, "details": "Resource exhausted"}\n\n');

    expect(onError).toHaveBeenCalledTimes(1);
    const errArg = onError.mock.calls[0][0];
    expect(errArg).toBeInstanceOf(Error);
    expect(errArg.message).toBe("Rate limit reached, try again in a minute");
    expect(errArg.code).toBe(429);
    expect(errArg.details).toBe("Resource exhausted");
  });

  it("correctly handles chunks split across multiple reads/feeds", () => {
    const onToken = vi.fn();
    const parser = new SSEParser({ onToken });

    // Stream split across three arbitrary feed chunks
    parser.feed('data: {"tok');
    expect(onToken).not.toHaveBeenCalled();

    parser.feed('en": "Partial ');
    expect(onToken).not.toHaveBeenCalled();

    parser.feed('Message"}\n\n');
    expect(onToken).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledWith("Partial Message");
  });

  it("parses grounding search sources correctly", () => {
    const onSources = vi.fn();
    const onToken = vi.fn();
    const parser = new SSEParser({ onSources, onToken });

    parser.feed('data: {"sources": [{"title": "Wikipedia", "url": "https://en.wikipedia.org/wiki/React"}]}\n\n');
    parser.feed('data: {"token": "React is a JavaScript library."}\n\n');

    expect(onSources).toHaveBeenCalledTimes(1);
    expect(onSources).toHaveBeenCalledWith([
      { title: "Wikipedia", url: "https://en.wikipedia.org/wiki/React" },
    ]);
    expect(onToken).toHaveBeenCalledWith("React is a JavaScript library.");
  });

  it("handles [DONE] termination event", () => {
    const onDone = vi.fn();
    const onToken = vi.fn();
    const parser = new SSEParser({ onToken, onDone });

    parser.feed('data: {"token": "Finished."}\n\n');
    expect(onDone).not.toHaveBeenCalled();

    parser.feed("data: [DONE]\n\n");
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
