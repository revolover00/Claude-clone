import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function collectSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(filePath);
    return /\.(ts|tsx)$/.test(entry.name) ? [filePath] : [];
  });
}

describe("API authorization coverage", () => {
  it("routes health and streamed chat requests through authFetch", () => {
    const app = fs.readFileSync(path.resolve("src/App.tsx"), "utf8");
    const stream = fs.readFileSync(path.resolve("src/utils/streamResponse.ts"), "utf8");

    expect(app).toMatch(/authFetch\(\s*["'`]\/api\/health/);
    expect(stream).toMatch(/authFetch\(\s*["'`]\/api\/chat/);
  });

  it("does not call an /api endpoint with native fetch", () => {
    const directApiFetch = /(?<![\w$.])fetch\s*\(\s*(["'`])\/api\//;
    const findings = collectSourceFiles(path.resolve("src")).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      return directApiFetch.test(source) ? [path.relative(process.cwd(), filePath)] : [];
    });

    expect(findings).toEqual([]);
  });

  it("protects connector APIs while leaving only the one-time OAuth callback public", () => {
    const server = fs.readFileSync(path.resolve("server.ts"), "utf8");
    expect(server).toContain('app.use("/api/connectors", requireAuth, apiLimiter, connectorsRouter);');
    expect(server.indexOf('app.use("/api/connectors/oauth/callback"')).toBeLessThan(server.indexOf('app.use("/api/connectors", requireAuth'));
  });
});
