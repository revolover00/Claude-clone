import { describe, expect, it, vi } from "vitest";
import { testProviderConnection } from "../server/lib/providers/connectionTest";

describe("provider connection probe", () => {
  it("sends one bounded, non-streaming chat request and returns latency and usage", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "OK" } }],
      usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
    }), { status: 200 })) as unknown as typeof fetch;

    const result = await testProviderConnection("openai", "sk-test-key-123456", fetcher);
    const [url, init] = vi.mocked(fetcher).mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(body.messages).toHaveLength(1);
    expect(body.max_tokens).toBeLessThanOrEqual(8);
    expect(body.stream).toBe(false);
    expect(result).toMatchObject({ tokens: 4 });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns the provider error while redacting the submitted secret", async () => {
    const fetcher = (async () => new Response(JSON.stringify({ error: { message: "Invalid key sk-test-key-123456" } }), {
      status: 401,
    })) as typeof fetch;
    await expect(testProviderConnection("openai", "sk-test-key-123456", fetcher))
      .rejects.toThrow("Invalid key [REDACTED]");
  });
});
