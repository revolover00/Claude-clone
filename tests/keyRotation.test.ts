import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { sanitizeKeyOrder, listKeyCandidates, markCredentialStatus } from "../server/lib/providers/keyRotation";
import { saveCredential } from "../server/lib/providers/credentialsStore";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Multi-key support: every provider accepts several API keys, the client can
 * dictate which one runs first, and spent/invalid keys drop out so the next
 * one takes over automatically.
 */
describe("key rotation store", () => {
  const originalSecret = process.env.PROVIDER_KEY_ENCRYPTION_SECRET;
  const secret = crypto.randomBytes(32).toString("base64");

  beforeEach(() => {
    process.env.PROVIDER_KEY_ENCRYPTION_SECRET = secret;
  });

  afterEach(() => {
    if (originalSecret) process.env.PROVIDER_KEY_ENCRYPTION_SECRET = originalSecret;
    else delete process.env.PROVIDER_KEY_ENCRYPTION_SECRET;
  });

  it("sanitizeKeyOrder keeps unique non-empty strings, bounded at 20", () => {
    expect(sanitizeKeyOrder(undefined)).toBeUndefined();
    expect(sanitizeKeyOrder("nope")).toBeUndefined();
    expect(sanitizeKeyOrder([])).toBeUndefined();
    expect(sanitizeKeyOrder(["a", "b", "a", 3, null, "c"])).toEqual(["a", "b", "c"]);
    const big = Array.from({ length: 50 }, (_, i) => `id-${i}`);
    expect(sanitizeKeyOrder(big)).toHaveLength(20);
  });

  it("returns keys newest-first by default and honors a client priority order", async () => {
    const u = "usr-order";
    const first = await saveCredential(u, "groq", "default", "gsk_default_000001");
    await sleep(3);
    await saveCredential(u, "groq", "key2", "gsk_second_000002");
    await sleep(3);
    const newest = await saveCredential(u, "groq", "key3", "gsk_third_000003");

    const def = await listKeyCandidates(u, "groq");
    expect(def.map((c) => c.label)).toEqual(["key3", "key2", "default"]);
    expect(def[0].id).toBe(newest.id);

    const custom = await listKeyCandidates(u, "groq", [first.id]);
    expect(custom.map((c) => c.id)).toEqual([first.id, newest.id, def[1].id]);
    expect(custom[0].key).toBe("gsk_default_000001");
  });

  it("drops exhausted and invalid keys from the chain so the next one runs", async () => {
    const u = "usr-status";
    const spent = await saveCredential(u, "groq", "default", "gsk_spent_000001");
    await sleep(3);
    const backup = await saveCredential(u, "groq", "key2", "gsk_backup_000002");

    await markCredentialStatus(u, "groq", spent.id, "exhausted", "Credits exhausted or quota exceeded");
    const afterExhaust = await listKeyCandidates(u, "groq");
    expect(afterExhaust.map((c) => c.id)).toEqual([backup.id]);

    await markCredentialStatus(u, "groq", backup.id, "invalid", "Authentication failed during chat request");
    expect(await listKeyCandidates(u, "groq")).toHaveLength(0);
  });

  it("ignores unknown credential ids and blank reasons safely", async () => {
    const u = "usr-unknown";
    await expect(markCredentialStatus(u, "groq", "cred-does-not-exist", "exhausted", "x")).resolves.toBeUndefined();
    await expect(markCredentialStatus(u, "groq", "", "invalid", "x")).resolves.toBeUndefined();
    expect(await listKeyCandidates(u, "groq")).toHaveLength(0);
  });
});
