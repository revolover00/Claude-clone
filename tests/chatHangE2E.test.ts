import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import http from "http";
import type { AddressInfo } from "net";
import chatRouter from "../server/routes/chat";
import { saveCredential } from "../server/lib/providers/credentialsStore";

/**
 * FULL-STACK E2E over real HTTP: POST /api/chat → provider adapter → SSE.
 *
 * Proves the user-visible bug is gone: when the upstream provider wedges
 * (silent socket, or never answers at all) the request NEVER hangs — it ends
 * with a STREAM_INTERRUPTED/retryable error plus [DONE], which is exactly
 * what the client's auto-retry policy consumes.
 */

const USER = "user-e2e-hang";
const enc = new TextEncoder();
let server: http.Server;
let port = 0;

beforeAll(async () => {
  process.env.PROVIDER_TIMEOUT_MS = "150";
  await saveCredential(USER, "groq", "default", "test-groq-key-e2e");
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req: any, _res, next) => {
    req.user = { id: USER };
    next();
  });
  app.use("/api/chat", chatRouter);
  server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  delete process.env.PROVIDER_TIMEOUT_MS;
  await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => vi.restoreAllMocks());

const postChat = () =>
  new Promise<{ status: number; body: string; ms: number }>((resolve, reject) => {
    const started = Date.now();
    const payload = JSON.stringify({
      model: "groq:llama-3.3-70b-versatile",
      messages: [{ role: "user", content: "Say hello" }],
      style: "default",
    });
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/api/chat",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
        timeout: 8000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode || 0, body, ms: Date.now() - started }));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("HUNG: /api/chat never closed the SSE response"));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });

describe("POST /api/chat never hangs on a wedged provider", () => {
  it("silent stream after first chunk → terminates with STREAM_INTERRUPTED + [DONE]", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"first chunk"}}]}\n\n'));
      },
      pull: () => new Promise<never>(() => {}),
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      body,
    } as any);

    const r = await postChat();
    expect(r.ms).toBeLessThan(6000);
    expect(r.status).toBe(200);
    expect(r.body).toContain("first chunk");
    expect(r.body).toContain("STREAM_INTERRUPTED");
    expect(r.body).toContain("stopped responding");
    expect(r.body.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("provider never answers (connect hang) → terminates with a retryable error", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          );
        }) as any
    );

    const r = await postChat();
    expect(r.ms).toBeLessThan(6000);
    expect(r.body).toContain("did not start responding");
    expect(r.body.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("normal stream still completes with text and closes", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"Hello there"}}]}\n\n'));
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      body,
    } as any);

    const r = await postChat();
    expect(r.status).toBe(200);
    expect(r.body).toContain("Hello there");
    expect(r.body).not.toContain("STREAM_INTERRUPTED");
    expect(r.ms).toBeLessThan(6000);
  });
});
