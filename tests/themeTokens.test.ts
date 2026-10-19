import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveColorMode } from "../src/utils/theme";

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

  it("uses Claude's warm paper, charcoal, and terracotta palette", () => {
    expect(darkTheme).toContain("--color-shell: #262624");
    expect(darkTheme).toContain("--color-panel: #232321");
    expect(darkTheme).toContain("--color-composer: #30302e");
    expect(lightTheme).toContain("--color-shell: #faf9f5");
    expect(lightTheme).toContain("--color-accent: #c96442");
    expect(lightTheme).toContain("--color-preview-canvas:");
  });

  it("resolves the system color mode from the device preference", () => {
    expect(resolveColorMode("system", true)).toBe("light");
    expect(resolveColorMode("system", false)).toBe("dark");
    expect(resolveColorMode("dark", true)).toBe("dark");
  });
});
