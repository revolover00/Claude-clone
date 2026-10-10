import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { MODEL_ALIAS_MAP, normalizeSlug, FALLBACK_MODELS } from "../src/hooks/useModels";

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

describe("Zero Fake Model Names Policy", () => {
  it("ensures Sonnet, Opus, and Haiku never appear in src/ or server/ outside MODEL_ALIAS_MAP", () => {
    const rootDir = path.resolve(__dirname, "..");
    const srcFiles = getAllFiles(path.join(rootDir, "src"));
    const serverFiles = getAllFiles(path.join(rootDir, "server"));
    const allFiles = [...srcFiles, ...serverFiles];

    const forbiddenRegex = /\b(sonnet|opus|haiku)\b/i;
    const violations: Array<{ file: string; line: number; text: string }> = [];

    for (const filePath of allFiles) {
      const relativePath = path.relative(rootDir, filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        // Exclude lines specifically within the alias map declaration in useModels.ts
        if (
          relativePath === "src/hooks/useModels.ts" &&
          (line.includes("sonnet-5") || line.includes("opus-5") || line.includes("haiku-4-5")) &&
          (line.includes("gemini-3-8-flash") || line.includes("gemini-3-1-pro") || line.includes("gemini-3-1-flash-lite"))
        ) {
          return;
        }

        if (forbiddenRegex.test(line)) {
          violations.push({
            file: relativePath,
            line: index + 1,
            text: line.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Found legacy model name violations in codebase:\n${violations
        .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
        .join("\n")}`
    ).toHaveLength(0);
  });

  it("normalizes legacy slugs to new Gemini slugs via alias map", () => {
    expect(MODEL_ALIAS_MAP["sonnet-5"]).toBe("gemini-3-8-flash");
    expect(MODEL_ALIAS_MAP["opus-5"]).toBe("gemini-3-1-pro");
    expect(MODEL_ALIAS_MAP["haiku-4-5"]).toBe("gemini-3-1-flash-lite");

    expect(normalizeSlug("sonnet-5")).toBe("gemini-3-8-flash");
    expect(normalizeSlug("opus-5")).toBe("gemini-3-1-pro");
    expect(normalizeSlug("haiku-4-5")).toBe("gemini-3-1-flash-lite");
    expect(normalizeSlug("gemini-3-8-flash")).toBe("gemini-3-8-flash");
    expect(normalizeSlug("custom-model")).toBe("custom-model");
  });

  it("has exactly one minimal offline fallback with real Gemini models and correct default", () => {
    expect(FALLBACK_MODELS).toHaveLength(3);

    const displayNames = FALLBACK_MODELS.map((m) => m.display_name);
    expect(displayNames).toEqual([
      "Gemini 3.8 Flash",
      "Gemini 3.1 Pro (Preview)",
      "Gemini 3.1 Flash-Lite",
    ]);

    const defaultModel = FALLBACK_MODELS.find((m) => m.is_default);
    expect(defaultModel).toBeDefined();
    expect(defaultModel?.slug).toBe("gemini-3-8-flash");
    expect(defaultModel?.display_name).toBe("Gemini 3.8 Flash");
  });
});
