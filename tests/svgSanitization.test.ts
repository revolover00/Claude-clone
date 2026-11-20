import { describe, expect, it } from "vitest";
import { sanitizeSvgHtml } from "../src/utils/sanitizeHtml";

describe("SVG artifact sanitization", () => {
  it("keeps basic SVG markup while removing executable content", () => {
    const html = sanitizeSvgHtml(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><circle cx="4" cy="4" r="3" onerror="alert(3)"/><text>safe</text></svg>',
    );

    expect(html).toContain("<svg");
    expect(html).toContain("<circle");
    expect(html).toContain("safe");
    expect(html).not.toMatch(/<script|onload|onerror|javascript:/i);
  });

  it("rejects foreignObject and inline styles from model output", () => {
    const html = sanitizeSvgHtml(
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><img src="x" onerror="alert(1)"></foreignObject><circle style="fill:url(javascript:alert(1))" r="2"/></svg>',
    );

    expect(html).not.toMatch(/foreignObject|onerror|style=|javascript:/i);
    expect(html).toContain("<circle");
  });
});
