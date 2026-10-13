import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { encrypt, decrypt, buildAAD } from "../server/lib/crypto/keyVault";

describe("Key Vault Hardening", () => {
  const originalSecret = process.env.PROVIDER_KEY_ENCRYPTION_SECRET;
  const originalPrevSecret = process.env.PROVIDER_KEY_ENCRYPTION_SECRET_PREV;

  const key1 = crypto.randomBytes(32).toString("base64");
  const key2 = crypto.randomBytes(32).toString("base64");

  beforeEach(() => {
    process.env.PROVIDER_KEY_ENCRYPTION_SECRET = key1;
    delete process.env.PROVIDER_KEY_ENCRYPTION_SECRET_PREV;
  });

  afterEach(() => {
    process.env.PROVIDER_KEY_ENCRYPTION_SECRET = originalSecret;
    if (originalPrevSecret) {
      process.env.PROVIDER_KEY_ENCRYPTION_SECRET_PREV = originalPrevSecret;
    } else {
      delete process.env.PROVIDER_KEY_ENCRYPTION_SECRET_PREV;
    }
  });

  it("performs round-trip encryption and decryption with correct AAD", () => {
    const userId = "usr-123";
    const provider = "groq";
    const label = "default";
    const secretKey = "gsk_test1234567890abcdef";
    const aad = buildAAD(userId, provider, label);

    const encrypted = encrypt(secretKey, aad);
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.tag).toBeTruthy();
    expect(encrypted.keyVersion).toBe(1);

    const decrypted = decrypt(encrypted.ciphertext, encrypted.iv, encrypted.tag, aad, encrypted.keyVersion);
    expect(decrypted.plaintext).toBe(secretKey);
    expect(decrypted.needsReencrypt).toBe(false);
  });

  it("detects tampering when ciphertext or tag is modified", () => {
    const aad = buildAAD("u1", "openrouter", "default");
    const encrypted = encrypt("sk-or-secret", aad);

    // Tamper ciphertext
    const tamperedCipher = Buffer.from(encrypted.ciphertext, "base64");
    tamperedCipher[0] ^= 0xff;

    expect(() => {
      decrypt(tamperedCipher.toString("base64"), encrypted.iv, encrypted.tag, aad);
    }).toThrow(/authentication failed/i);

    // Tamper tag
    const tamperedTag = Buffer.from(encrypted.tag, "base64");
    tamperedTag[0] ^= 0xff;

    expect(() => {
      decrypt(encrypted.ciphertext, encrypted.iv, tamperedTag.toString("base64"), aad);
    }).toThrow(/authentication failed/i);
  });

  it("fails decryption when AAD does not match (cannot copy row to another user)", () => {
    const userA = "user-alice";
    const userB = "user-bob";
    const aadA = buildAAD(userA, "gemini", "work");
    const aadB = buildAAD(userB, "gemini", "work");

    const encrypted = encrypt("alice-secret-key", aadA);

    // Attempt decrypting with user B's identity
    expect(() => {
      decrypt(encrypted.ciphertext, encrypted.iv, encrypted.tag, aadB);
    }).toThrow(/authentication failed/i);
  });

  it("handles key rotation using PROVIDER_KEY_ENCRYPTION_SECRET_PREV", () => {
    // Encrypt with key1
    process.env.PROVIDER_KEY_ENCRYPTION_SECRET = key1;
    const aad = buildAAD("u-rot", "groq", "rot-label");
    const encrypted = encrypt("rotated-groq-key", aad);

    // Now rotate: set new current key2 and old key1 as PREV
    process.env.PROVIDER_KEY_ENCRYPTION_SECRET = key2;
    process.env.PROVIDER_KEY_ENCRYPTION_SECRET_PREV = key1;

    const res = decrypt(encrypted.ciphertext, encrypted.iv, encrypted.tag, aad);
    expect(res.plaintext).toBe("rotated-groq-key");
    expect(res.needsReencrypt).toBe(true);
  });
});
