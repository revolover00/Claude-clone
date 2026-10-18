import { describe, expect, it } from "vitest";
import {
  buildShareSnapshot,
  decodeShareToken,
  encodeShareToken,
  readShareTokenFromHash,
  renderSafeSharedMarkdown,
} from "../src/shared/conversationShare";

describe("portable conversation sharing", () => {
  it("shares only visible text from the selected branch and round-trips Unicode", async () => {
    const snapshot = buildShareSnapshot("  تبادل الأفكار  ", [
      { role: "system", content: "never include the system prompt" },
      { role: "user", content: "Explain this 👋" , attachments: [{ url: "private-file" }] },
      { role: "assistant", content: "مرحبا — **hello**" , thinking: "private reasoning" },
      { role: "assistant", content: "   " },
    ]);

    const token = await encodeShareToken(snapshot);
    const result = await decodeShareToken(token);

    expect(result).toEqual({
      version: 1,
      title: "تبادل الأفكار",
      messages: [
        { role: "user", content: "Explain this 👋" },
        { role: "assistant", content: "مرحبا — **hello**" },
      ],
    });
    expect(token).toMatch(/^v1\.[gj]\./);
  });

  it("renders Markdown while stripping unsafe HTML and link protocols", () => {
    const html = renderSafeSharedMarkdown('<script>alert("xss")</script><img src=x onerror=alert(1)> **safe**');
    const linkHtml = renderSafeSharedMarkdown("[bad](javascript:alert(1))");
    expect(html).not.toMatch(/<script|onerror/i);
    expect(linkHtml).not.toMatch(/href=[\"']?javascript:/i);
    expect(html).toContain("safe");
  });

  it("rejects empty, oversized, and malformed share payloads", async () => {
    expect(() => buildShareSnapshot("Empty", [])).toThrow(/does not contain/i);
    expect(() => buildShareSnapshot("Large", [{ role: "user", content: "x".repeat(100_001) }])).toThrow(/too large/i);
    await expect(decodeShareToken("not-a-share-link")).rejects.toThrow(/unsupported/i);
  });

  it("extracts the versioned token from a URL fragment", () => {
    expect(readShareTokenFromHash("#share=v1.g.abc_DEF-123")).toBe("v1.g.abc_DEF-123");
    expect(readShareTokenFromHash("#section=messages")).toBeNull();
  });
});
