import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = fs.readFileSync(path.resolve("src/index.css"), "utf8");
const darkTheme = stylesheet.match(/@theme\s*\{([\s\S]*?)\}/)?.[1] ?? "";
const lightTheme = stylesheet.match(/\[data-theme="light"\]\s*\{([\s\S]*?)\}/)?.[1] ?? "";

describe("Claude appearance tokens", () => {
  it("provides shared surfaces, ink, accent and answer-font tokens", () => {
    for (const token of ["--color-shell", "--color-panel", "--color-composer", "--color-ink", "--color-accent"]) {
      expect(darkTheme).toContain(token);
    }
    expect(darkTheme).toContain("--font-serif:");
  });

  it("overrides the same surfaces and typography colors in light mode", () => {
    for (const token of ["--color-shell", "--color-panel", "--color-composer", "--color-ink", "--color-accent", "--color-code-ink"]) {
      expect(lightTheme).toContain(token);
    }
    expect(stylesheet).toContain("color: var(--color-code-ink);");
    expect(stylesheet).toContain("color: var(--color-link-hover);");
  });
});
