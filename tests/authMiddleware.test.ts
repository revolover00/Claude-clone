// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: (token: string) => getUser(token) } })),
}));

import { requireAuth } from "../server/middleware/auth";
import { parseAuthorizationHeader } from "../server/lib/auth/authHeader";
import { classifyVerificationError, isJwtExpired } from "../server/lib/auth/verifyToken";
import { userAgentFamily } from "../server/lib/auth/authLog";

const ENV_KEYS = [
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ALLOW_GUEST",
  "VITE_ALLOW_GUEST",
  "NODE_ENV",
] as const;

// Distinctive token so any leaked fragment is detectable in log lines.
const TOKEN = "Zq8xW3vR7pLk2Nf9Ht5Yc1BdMm4Jg6Ts";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
function jwtWithExp(expSeconds: number): string {
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ sub: "u1", exp: expSeconds })}.c2lnbmF0dXJl`;
}

function expectNoFragments(text: string, secret: string, size = 5) {
  for (let i = 0; i + size <= secret.length; i++) {
    expect(text).not.toContain(secret.slice(i, i + size));
  }
}

function mockReq(headers: Record<string, string | undefined> = {}) {
  return {
    method: "GET",
    originalUrl: "/api/skills?access_token=query-secret",
    url: "/api/skills?access_token=query-secret",
    headers: {
      host: "app.example.com",
      origin: "https://app.example.com",
      "user-agent": CHROME_UA,
      ...headers,
    },
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

async function run(headers: Record<string, string | undefined> = {}) {
  const req = mockReq(headers);
  const res = mockRes();
  const next = vi.fn();
  await requireAuth(req, res, next);
  return { req, res, next, body: res.json.mock.calls[0]?.[0] };
}

let savedEnv: Record<string, string | undefined>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.SUPABASE_URL = "https://project-ref.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret-value";
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.ALLOW_GUEST;
  delete process.env.VITE_ALLOW_GUEST;
  process.env.NODE_ENV = "test";
  getUser.mockReset();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  warnSpy.mockRestore();
});

describe("requireAuth reason codes", () => {
  it("AUTH_HEADER_MISSING when no Authorization header is sent", async () => {
    const { res, next, body } = await run();

    expect(res.status).toHaveBeenCalledWith(401);
    expect(body.code).toBe("AUTH_HEADER_MISSING");
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeLessThan(100);
    expect(next).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it.each([
    ["a raw token without a scheme", TOKEN],
    ["a different scheme", "Basic dXNlcjpwYXNzd29yZA=="],
    ["an unknown scheme", `Token ${TOKEN}`],
    ["a token containing whitespace", `Bearer ${TOKEN} extra`],
  ])("AUTH_HEADER_MALFORMED for %s", async (_label, header) => {
    const { res, body } = await run({ authorization: header });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(body.code).toBe("AUTH_HEADER_MALFORMED");
    expect(getUser).not.toHaveBeenCalled();
  });

  it.each([["Bearer "], ["Bearer"], ["Bearer undefined"], ["Bearer null"], [""]])(
    "AUTH_HEADER_MALFORMED for an empty token (%j)",
    async (header) => {
      const { res, body } = await run({ authorization: header });

      expect(res.status).toHaveBeenCalledWith(401);
      expect(body.code).toBe("AUTH_HEADER_MALFORMED");
      expect(getUser).not.toHaveBeenCalled();
    }
  );

  it("AUTH_TOKEN_INVALID when Supabase rejects the token", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", status: 403, code: "bad_jwt", message: "invalid JWT: unable to verify signature" },
    });

    const { res, body } = await run({ authorization: `Bearer ${TOKEN}` });

    expect(getUser).toHaveBeenCalledWith(TOKEN);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(body).toEqual({ error: expect.any(String), code: "AUTH_TOKEN_INVALID" });
  });

  it("AUTH_TOKEN_EXPIRED when Supabase rejects an expired token", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", status: 403, code: "bad_jwt", message: "invalid JWT: token is expired" },
    });

    const { body } = await run({ authorization: `Bearer ${TOKEN}` });

    expect(body.code).toBe("AUTH_TOKEN_EXPIRED");
  });

  it("AUTH_UNAVAILABLE when Supabase cannot be reached", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" },
    });
    getUser.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    expect((await run({ authorization: `Bearer ${TOKEN}` })).body.code).toBe("AUTH_UNAVAILABLE");
    expect((await run({ authorization: `Bearer ${TOKEN}` })).body.code).toBe("AUTH_UNAVAILABLE");
  });

  it("AUTH_UNAVAILABLE with an explanation when no auth is configured and guest mode is off", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.ALLOW_GUEST = "false";

    const { res, body } = await run({ authorization: `Bearer ${TOKEN}` });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(body.code).toBe("AUTH_UNAVAILABLE");
    expect(body.error).toMatch(/not configured/i);
  });

  it("accepts a verified token and attaches the user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-123", email: "a@b.co" } }, error: null });

    const { req, res, next } = await run({ authorization: `Bearer ${TOKEN}` });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toEqual({ id: "user-123", email: "a@b.co" });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("keeps accepting development mock tokens in guest mode", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.ALLOW_GUEST = "true";

    const { req, next } = await run({ authorization: "Bearer mock-jwt-token-guest42" });

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe("guest42");
  });

  it("guest mode defaults to on outside production and stays off in production", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    // No flags set: local testing must work without a login.
    const dev = await run({ authorization: "Bearer mock-jwt-token-local7" });
    expect(dev.next).toHaveBeenCalled();
    expect(dev.req.user.id).toBe("local7");

    // Production never honours the flag, even when set to true.
    process.env.NODE_ENV = "production";
    process.env.ALLOW_GUEST = "true";
    const prod = await run({ authorization: "Bearer mock-jwt-token-local7" });
    expect(prod.res.status).toHaveBeenCalledWith(401);
    expect(prod.body.code).toBe("AUTH_UNAVAILABLE");
  });
});

describe("requireAuth failure logging", () => {
  it("writes exactly one safe line per failure, without the token", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", status: 401, code: "bad_jwt", message: "invalid JWT" },
    });

    await run({ authorization: `Bearer ${TOKEN}` });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const line = String(warnSpy.mock.calls[0][0]);
    expect(line).not.toContain("\n");
    expect(line).toContain("AUTH_TOKEN_INVALID");
    expect(line).toContain("method=GET");
    expect(line).toContain("path=/api/skills");
    expect(line).toContain("authHeader=present");
    expect(line).toContain("scheme=Bearer");
    expect(line).toContain(`tokenLength=${TOKEN.length}`);
    expect(line).toContain("host=app.example.com");
    expect(line).toContain("origin=https://app.example.com");
    expect(line).toContain("ua=Chrome");
    expect(line).not.toContain("query-secret");
    expectNoFragments(line, TOKEN);
  });

  it.each([
    ["missing", undefined],
    ["raw token without scheme", TOKEN],
    ["unknown scheme", `${TOKEN.slice(0, 12)} ${TOKEN.slice(12)}`],
    ["whitespace inside token", `Bearer ${TOKEN.slice(0, 16)} ${TOKEN.slice(16)}`],
  ])("never logs any part of the credential (%s)", async (_label, header) => {
    await run({ authorization: header });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expectNoFragments(String(warnSpy.mock.calls[0][0]), TOKEN);
  });

  it("logs header absence and strips control characters from header values", async () => {
    await run({ host: "evil.example\r\nFAKE-LOG-LINE", origin: undefined });

    const line = String(warnSpy.mock.calls[0][0]);
    expect(line).toContain("AUTH_HEADER_MISSING");
    expect(line).toContain("authHeader=absent");
    expect(line).toContain("origin=-");
    expect(line).not.toMatch(/[\r\n]/);
  });
});

describe("auth helpers", () => {
  it("parses the header into loggable metadata only", () => {
    expect(parseAuthorizationHeader(undefined)).toMatchObject({ present: false, scheme: null, tokenLength: 0 });
    expect(parseAuthorizationHeader(`bearer ${TOKEN}`)).toMatchObject({
      present: true,
      scheme: "Bearer",
      tokenLength: TOKEN.length,
      malformed: false,
    });
    expect(parseAuthorizationHeader(`${TOKEN.slice(0, 10)} rest`).scheme).toBe("unrecognized");
  });

  it("classifies Supabase errors", () => {
    const valid = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    const expired = jwtWithExp(Math.floor(Date.now() / 1000) - 60);
    expect(isJwtExpired(expired)).toBe(true);
    expect(isJwtExpired(valid)).toBe(false);
    expect(classifyVerificationError({ status: 403, message: "invalid JWT" }, expired)).toBe("AUTH_TOKEN_EXPIRED");
    expect(classifyVerificationError({ status: 403, message: "invalid JWT" }, valid)).toBe("AUTH_TOKEN_INVALID");
    expect(classifyVerificationError({ status: 503, message: "upstream" }, valid)).toBe("AUTH_UNAVAILABLE");
    expect(classifyVerificationError({ status: 429, message: "slow down" }, valid)).toBe("AUTH_UNAVAILABLE");
  });

  it("reduces user agents to a family", () => {
    expect(userAgentFamily(CHROME_UA)).toBe("Chrome");
    expect(userAgentFamily("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15")).toBe("Safari");
    expect(userAgentFamily("Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0")).toBe("Firefox");
    expect(userAgentFamily(`${CHROME_UA} Edg/126.0`)).toBe("Edge");
    expect(userAgentFamily("curl/8.5.0")).toBe("curl");
    expect(userAgentFamily(undefined)).toBe("none");
  });
});
