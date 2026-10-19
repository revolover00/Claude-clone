import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const STATIC_IMPORT_SOURCE = "\\b(?:import|export)\\s+(type\\s+)?(?:[^;]*?\\s+from\\s+)?[\\\"']([^\\\"']+)[\\\"']";

function resolveSourceImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.resolve(ROOT, "src", specifier.slice(2))
    : specifier.startsWith(".") ? path.resolve(path.dirname(from), specifier) : null;
  if (!base) return null;
  const candidates = [base, ...[".ts", ".tsx", ".js", ".jsx"].map((ext) => `${base}${ext}`),
    ...["index.ts", "index.tsx", "index.js", "index.jsx"].map((name) => path.join(base, name))];
  return candidates.find((candidate) => {
    try { return readFileSync(candidate).length >= 0; } catch { return false; }
  }) || null;
}

function eagerSourceGraph(entry: string): Set<string> {
  const visited = new Set<string>();
  const visit = (file: string) => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(new RegExp(STATIC_IMPORT_SOURCE, "g"))) {
      if (match[1]) continue; // TS-only import has no emitted runtime edge.
      const target = resolveSourceImport(file, match[2]);
      if (target && /\.[jt]sx?$/.test(target)) visit(target);
    }
  };
  visit(path.join(ROOT, entry));
  return visited;
}

describe("catalog code splitting", () => {
  it("keeps shared/catalog out of the eager main-entry import graph", () => {
    const files = [...eagerSourceGraph("src/main.tsx")].map((file) => path.relative(ROOT, file));
    expect(files.filter((file) => file.startsWith("src/shared/catalog/") || file === "src/shared/catalog.ts")).toEqual([]);
  });
});
