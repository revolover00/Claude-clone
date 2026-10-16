import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
export const CURRENT_KEY_VERSION = 1;

function parseSecret(secretStr: string | undefined): Buffer | null {
  if (!secretStr) return null;
  try {
    const bufFromB64 = Buffer.from(secretStr, "base64");
    if (bufFromB64.length === KEY_LENGTH) return bufFromB64;
  } catch {
    // Ignore and try utf8
  }
  const bufFromUtf8 = Buffer.from(secretStr, "utf8");
  if (bufFromUtf8.length === KEY_LENGTH) return bufFromUtf8;
  return null;
}

export function validateSecretAtStartup(): void {
  if (process.env.NODE_ENV === "production") {
    const primary = parseSecret(process.env.PROVIDER_KEY_ENCRYPTION_SECRET);
    if (!primary) {
      console.error(
        [
          "CRITICAL ERROR: PROVIDER_KEY_ENCRYPTION_SECRET is missing or not 32 bytes in production.",
          "  Saved provider API keys are encrypted with this secret, so the server refuses to boot without it.",
          "  Fix: add PROVIDER_KEY_ENCRYPTION_SECRET to your hosting platform's environment variables",
          "  with a random 32-byte value — generate one with:  openssl rand -base64 32",
          "  (set it wherever you configure env vars: Vercel/Render/Railway/Cloud Run dashboard, .env, ...)",
        ].join("\n")
      );
      process.exit(1);
    }
  }
}

// Call on module load
validateSecretAtStartup();

export function getMasterSecret(): Buffer {
  const secret = parseSecret(process.env.PROVIDER_KEY_ENCRYPTION_SECRET);
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PROVIDER_KEY_ENCRYPTION_SECRET is missing or not 32 bytes. Generate one with `openssl rand -base64 32` and set it in your hosting platform's environment variables."
      );
    }
    // Fallback deterministic key for dev/test environments
    return Buffer.alloc(KEY_LENGTH, "claude-clone-dev-secret-key-32b");
  }
  return secret;
}

export function getPrevSecret(): Buffer | null {
  return parseSecret(process.env.PROVIDER_KEY_ENCRYPTION_SECRET_PREV);
}

export function buildAAD(userId: string, provider: string, label: string): string {
  return `${userId}:${provider}:${label}`;
}

export function encrypt(
  text: string,
  aad: string
): { ciphertext: string; iv: string; tag: string; keyVersion: number } {
  const secret = getMasterSecret();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, secret, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    keyVersion: CURRENT_KEY_VERSION,
  };
}

export function decrypt(
  ciphertext: string,
  iv: string,
  tag: string,
  aad: string,
  _keyVersion?: number
): { plaintext: string; needsReencrypt: boolean } {
  const primarySecret = getMasterSecret();
  const ivBuf = Buffer.from(iv, "base64");
  const tagBuf = Buffer.from(tag, "base64");
  const cipherBuf = Buffer.from(ciphertext, "base64");
  const aadBuf = Buffer.from(aad, "utf8");

  // Attempt decryption with current master secret
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, primarySecret, ivBuf, { authTagLength: TAG_LENGTH });
    decipher.setAAD(aadBuf);
    decipher.setAuthTag(tagBuf);
    const decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
    return {
      plaintext: decrypted.toString("utf8"),
      needsReencrypt: false,
    };
  } catch (primaryErr) {
    // If decryption failed, try previous secret for key rotation
    const prevSecret = getPrevSecret();
    if (prevSecret) {
      try {
        const decipherPrev = crypto.createDecipheriv(ALGORITHM, prevSecret, ivBuf, { authTagLength: TAG_LENGTH });
        decipherPrev.setAAD(aadBuf);
        decipherPrev.setAuthTag(tagBuf);
        const decryptedPrev = Buffer.concat([decipherPrev.update(cipherBuf), decipherPrev.final()]);
        return {
          plaintext: decryptedPrev.toString("utf8"),
          needsReencrypt: true,
        };
      } catch {
        // Both failed
      }
    }
    throw new Error(`Failed to decrypt key: authentication failed or tampered ciphertext (${(primaryErr as Error).message})`, { cause: primaryErr });
  }
}
