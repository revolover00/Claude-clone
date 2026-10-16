// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const getUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: (token: string) => getUser(token) } })),
}));

import { createAuthDebugRouter } from "../server/routes/authDebug";

const ENV_KEYS = [
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "ALLOW_GUEST",
  "VITE_ALLOW_GUEST",
  "NODE_ENV",
] as const;

const SUPABASE_URL = "https://secretproject.supabase.co";
const SERVICE_KEY = "service-role-key-DO-NOT-LEAK-9f8e7d";
const ANON_KEY = "anon-key-DO-NOT-LEAK-1a2b3c";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.Qm9vWmFwUXV4V2liYmxlMTIz";
const USER = { id: "a1b2c3d4-e5f6-4711-9999-abcdefabcdef", email: "person@example.com" };
const ALLOWED_KEYS = ["errorCode", "hasAuthHeader", "scheme", "serverMode", "tokenLength", "userIdPrefix", "verified"];

let server: Server | null = null;
let baseUrl = "";
let savedEnv: Record<string, string | undefined>;

async function start(limit = 50) {
  const app = express();
  app.use("/api/auth", createAuthDebugRouter({ windowMs: 60_000, limit }));
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

function debug(authorization?: string) {
  return fetch(`${baseUrl}/api/auth/debug`, {
    headers: authorization === undefined ? {} : { Authorization: authorization },
  });
}

beforeEach(async () => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  process.env.VITE_SUPABASE_ANON_KEY = ANON_KEY;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.ALLOW_GUEST;
  delete process.env.VITE_ALLOW_GUEST;
  process.env.NODE_ENV = "test";
  getUser.mockReset();
  await start();
});

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("GET /api/auth/debug", () => {
  it("returns only metadata for a verified session and no secrets", async () => {
    getUser.mockResolvedValue({ data: { user: USER }, error: null });

    const res = await debug(`Bearer ${TOKEN}`);
    const text = await res.text();
    const body = JSON.parse(text);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(Object.keys(body).sort()).toEqual(ALLOWED_KEYS);
    expect(body).toEqual({
      serverMode: "supabase",
      hasAuthHeader: true,
      scheme: "Bearer",
      tokenLength: TOKEN.length,
      verified: true,
      userIdPrefix: "a1b2c3",
      errorCode: null,
    });

    for (const secret of [SERVICE_KEY, ANON_KEY, SUPABASE_URL, "secretproject", USER.email, USER.id]) {
      expect(text).not.toContain(secret);
    }
    for (const part of TOKEN.split(".")) {
      expect(text).not.toContain(part);
    }
    for (let i = 0; i + 6 <= TOKEN.length; i++) {
      expect(text).not.toContain(TOKEN.slice(i, i + 6));
    }
  });

  it("explains a rejected token with its reason code", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", status: 403, code: "bad_jwt", message: "invalid JWT" },
    });

    const body = await (await debug(`Bearer ${TOKEN}`)).json();

    expect(body).toMatchObject({ verified: false, userIdPrefix: null, errorCode: "AUTH_TOKEN_INVALID" });
  });

  it("needs no authentication and reports a missing header", async () => {
    const res = await debug();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      serverMode: "supabase",
      hasAuthHeader: false,
      scheme: null,
      tokenLength: 0,
      verified: false,
      userIdPrefix: null,
      errorCode: "AUTH_HEADER_MISSING",
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("reports malformed headers without echoing them", async () => {
    const res = await debug(TOKEN);
    const text = await res.text();

    expect(JSON.parse(text)).toMatchObject({ hasAuthHeader: true, scheme: "none", errorCode: "AUTH_HEADER_MALFORMED" });
    expect(text).not.toContain(TOKEN.split(".")[2]);
  });

  it("reports unconfigured and guest server modes", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(await (await debug(`Bearer ${TOKEN}`)).json()).toMatchObject({
      serverMode: "unconfigured",
      verified: false,
      errorCode: "AUTH_UNAVAILABLE",
    });

    process.env.ALLOW_GUEST = "true";
    expect(await (await debug("Bearer mock-jwt-token-guest-1234")).json()).toMatchObject({
      serverMode: "guest",
      verified: true,
      userIdPrefix: "guest-",
      errorCode: null,
    });
  });

  it("is rate-limited", async () => {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    await start(2);

    expect((await debug()).status).toBe(200);
    expect((await debug()).status).toBe(200);
    expect((await debug()).status).toBe(429);
  });
});
