import { describe, expect, it } from "vitest";
import { sanitizeMarkdownHtml } from "../src/utils/sanitizeHtml";

describe("markdown HTML sanitization", () => {
  it("strips event handlers injected via inline HTML in model output", () => {
    const html = sanitizeMarkdownHtml('<img src="x" onerror="alert(1)">hello');
    expect(html).not.toMatch(/onerror/i);
    expect(html).toContain("hello");
  });

  it("strips javascript: links but keeps normal links", () => {
    const html = sanitizeMarkdownHtml('<a href="javascript:alert(1)">bad</a><a href="https://example.com">ok</a>');
    expect(html).not.toMatch(/javascript:/i);
    expect(html).toContain("https://example.com");
  });
});
