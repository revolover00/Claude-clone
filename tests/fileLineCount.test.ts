import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function getAllFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== "node_modules" && file !== "dist" && file !== ".git") {
        results = results.concat(getAllFiles(fullPath, extensions));
      }
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

describe("Codebase line count limits", () => {
  it("ensures all source files are 300 lines or less", () => {
    // Collect all .ts and .tsx files in src and server
    const srcFiles = getAllFiles(path.resolve(".", "src"), [".ts", ".tsx"]);
    const rootServerFiles = [path.resolve(".", "server.ts")];
    const serverFilesDir = fs.existsSync(path.resolve(".", "server"))
      ? getAllFiles(path.resolve(".", "server"), [".ts", ".tsx"])
      : [];

    const allFiles = [...srcFiles, ...rootServerFiles, ...serverFilesDir];

    const violations: { file: string; lineCount: number }[] = [];

    allFiles.forEach((file) => {
      // Relative path for nice readability
      const relPath = path.relative(path.resolve("."), file);
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split(/\r?\n/);
      const lineCount = lines.length;

      if (lineCount > 300) {
        violations.push({ file: relPath, lineCount });
      }
    });

    if (violations.length > 0) {
      console.error("Violations of the 300-line rule:", violations);
    }

    expect(violations.length, `Found ${violations.length} files with more than 300 lines`).toBe(0);
  });
});
