import { describe, it, expect, vi, beforeEach } from "vitest";
import providersRouter from "../server/routes/providers";
import { providers } from "../server/lib/providers";

describe("Provider Routes Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/providers lists registry info and credentials without secret keys", async () => {
    const mockReq: any = {
      user: { id: "test-user-1" },
      headers: {},
    };

    let responseData: any = null;
    const mockRes: any = {
      json: vi.fn((data) => { responseData = data; }),
      status: vi.fn().mockReturnThis(),
    };

    const getLayer = providersRouter.stack.find((l: any) => l.route?.path === "/" && l.route.methods.get);
    expect(getLayer).toBeDefined();

    await getLayer!.route.stack[0].handle(mockReq, mockRes);

    expect(responseData).toBeDefined();
    expect(responseData.providers).toBeDefined();
    expect(responseData.providers.length).toBeGreaterThanOrEqual(3);
    expect(responseData.credentials).toBeDefined();

    // Verify secret columns are NOT present
    for (const cred of responseData.credentials) {
      expect(cred.key_ciphertext).toBeUndefined();
      expect(cred.key_iv).toBeUndefined();
      expect(cred.key_tag).toBeUndefined();
    }
  });

  it("POST /api/providers/:provider/credentials validates input strictly", async () => {
    const postLayer = providersRouter.stack.find(
      (l: any) => l.route?.path === "/:provider/credentials" && l.route.methods.post
    );
    expect(postLayer).toBeDefined();

    // 1. Rejects key with whitespace
    const mockReqWhitespace: any = {
      user: { id: "user-val-1" },
      params: { provider: "groq" },
      body: { key: "gsk_123 45678" },
    };
    let statusSet: number | null = null;
    let jsonSet: any = null;
    const mockRes1: any = {
      status: vi.fn((code) => { statusSet = code; return mockRes1; }),
      json: vi.fn((data) => { jsonSet = data; }),
    };

    await postLayer!.route.stack[0].handle(mockReqWhitespace, mockRes1);
    expect(statusSet).toBe(400);
    expect(jsonSet.error).toContain("whitespace");

    // 2. Rejects key too short (< 8 chars)
    const mockReqShort: any = {
      user: { id: "user-val-2" },
      params: { provider: "groq" },
      body: { key: "short" },
    };
    await postLayer!.route.stack[0].handle(mockReqShort, mockRes1);
    expect(statusSet).toBe(400);
    expect(jsonSet.error).toContain("8 and 512");

    // 3. Rejects unknown provider
    const mockReqUnknown: any = {
      user: { id: "user-val-3" },
      params: { provider: "unsupported_llm" },
      body: { key: "validlengthkey12345" },
    };
    await postLayer!.route.stack[0].handle(mockReqUnknown, mockRes1);
    expect(statusSet).toBe(400);
    expect(jsonSet.error).toContain("not supported");
  });

  it("distinguishes invalid key (400) from provider network error (502)", async () => {
    const postLayer = providersRouter.stack.find(
      (l: any) => l.route?.path === "/:provider/credentials" && l.route.methods.post
    );

    // Mock validateKey returning invalid (401/403)
    vi.spyOn(providers.groq, "validateKey").mockResolvedValueOnce({
      valid: false,
      status: 400,
      code: "KEY_INVALID",
      message: "Invalid Groq API key",
    });

    const mockReq: any = {
      user: { id: "user-key-test" },
      params: { provider: "groq" },
      body: { key: "invalid-key-12345" },
    };
    let statusSet: number | null = null;
    let jsonSet: any = null;
    const mockRes: any = {
      status: vi.fn((code) => { statusSet = code; return mockRes; }),
      json: vi.fn((data) => { jsonSet = data; }),
    };

    await postLayer!.route.stack[0].handle(mockReq, mockRes);
    expect(statusSet).toBe(400);
    expect(jsonSet.code).toBe("KEY_INVALID");

    // Mock validateKey throwing network / upstream failure
    vi.spyOn(providers.groq, "validateKey").mockResolvedValueOnce({
      valid: false,
      status: 502,
      code: "PROVIDER_UNAVAILABLE",
      message: "Unable to reach Groq service",
    });

    await postLayer!.route.stack[0].handle(mockReq, mockRes);
    expect(statusSet).toBe(502);
    expect(jsonSet.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("successfully creates, verifies, and deletes a credential", async () => {
    vi.spyOn(providers.groq, "validateKey").mockResolvedValue({ valid: true });

    const postLayer = providersRouter.stack.find(
      (l: any) => l.route?.path === "/:provider/credentials" && l.route.methods.post
    );
    const verifyLayer = providersRouter.stack.find(
      (l: any) => l.route?.path === "/:provider/credentials/:id/verify" && l.route.methods.post
    );
    const deleteLayer = providersRouter.stack.find(
      (l: any) => l.route?.path === "/:provider/credentials/:id" && l.route.methods.delete
    );

    const userId = "00000000-0000-0000-0000-000000000001";
    const mockReq: any = {
      user: { id: userId },
      params: { provider: "groq" },
      body: { key: "gsk_testvalidkey998877", label: "my-groq" },
    };

    let created: any = null;
    const mockRes: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn((d) => { created = d; }),
    };

    // 1. Create
    await postLayer!.route.stack[0].handle(mockReq, mockRes);
    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.provider).toBe("groq");
    expect(created.label).toBe("my-groq");
    expect(created.last4).toBe("8877");
    expect(created.status).toBe("active");

    // 2. Verify
    const verifyReq: any = {
      user: { id: userId },
      params: { provider: "groq", id: created.id },
    };
    let verified: any = null;
    const verifyRes: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn((d) => { verified = d; }),
    };
    await verifyLayer!.route.stack[0].handle(verifyReq, verifyRes);
    expect(verified.status).toBe("active");

    // 3. Delete
    let deleted: any = null;
    const delRes: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn((d) => { deleted = d; }),
    };
    await deleteLayer!.route.stack[0].handle(verifyReq, delRes);
    expect(deleted.success).toBe(true);
  });
});
