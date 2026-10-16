import { encrypt, decrypt, buildAAD } from "../crypto/keyVault";
import { getSupabaseClient } from "../skills/db";
import { getProvider } from "./index";

export interface SafeCredential {
  id: string;
  provider: string;
  label: string;
  key_last4: string;
  status: string;
  last_verified_at?: string;
  last_error?: string | null;
}

const memoryCredentials = new Map<string, any>();
const creationTimestamps = new Map<string, number[]>();

export function redact(text: string): string {
  if (!text) return "";
  return text.replace(/(sk-[a-zA-Z0-9_-]{8,}|gsk_[a-zA-Z0-9_-]{8,}|AIza[a-zA-Z0-9_-]{8,})/g, "[REDACTED]");
}

export function checkCreationRateLimit(userId: string): boolean {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const userTimestamps = creationTimestamps.get(userId) || [];
  const valid = userTimestamps.filter((t) => t > oneHourAgo);

  if (valid.length >= 5) return false;

  valid.push(now);
  creationTimestamps.set(userId, valid);
  return true;
}

export async function saveCredential(
  userId: string,
  providerId: string,
  label: string,
  rawKey: string
): Promise<{ id: string; provider: string; label: string; last4: string; status: string }> {
  const aad = buildAAD(userId, providerId, label);
  const { ciphertext, iv, tag, keyVersion } = encrypt(rawKey, aad);
  const last4 = rawKey.slice(-4);
  const now = new Date().toISOString();
  const id = `cred-${userId}-${providerId}-${Date.now()}`;
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("provider_credentials")
        .upsert(
          {
            user_id: userId,
            provider: providerId,
            label,
            key_ciphertext: ciphertext,
            key_iv: iv,
            key_tag: tag,
            key_version: keyVersion,
            key_last4: last4,
            status: "active",
            last_verified_at: now,
            last_error: null,
          },
          { onConflict: "user_id,provider,label" }
        )
        .select("id, provider, label, key_last4, status")
        .single();

      if (error) throw error;
      console.log(`[Providers] Saved credential for user ${userId}, provider ${providerId}`);
      return { id: data.id, provider: data.provider, label: data.label, last4: data.key_last4, status: data.status };
    } catch (err: any) {
      if (process.env.NODE_ENV === "production") {
        console.error(`[Providers] Error saving credential: ${redact(err.message)}`);
        throw new Error(`Failed to save credential: ${redact(err.message)}`, { cause: err });
      }
      console.warn(`[Providers] Supabase save failed (${err.message}), falling back to memory`);
    }
  }

  const key = `${userId}:${providerId}:${label}`;
  memoryCredentials.set(key, {
    id, user_id: userId, provider: providerId, label,
    key_ciphertext: ciphertext, key_iv: iv, key_tag: tag,
    key_version: keyVersion, key_last4: last4, status: "active",
    last_verified_at: now, last_error: null,
  });
  console.log(`[Providers] (Memory) Saved credential for user ${userId}, provider ${providerId}`);
  return { id, provider: providerId, label, last4, status: "active" };
}

export async function listUserCredentials(userId: string): Promise<SafeCredential[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("provider_credentials")
        .select("id, provider, label, key_last4, status, last_verified_at, last_error")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id, provider: c.provider, label: c.label,
        key_last4: c.key_last4, status: c.status,
        last_verified_at: c.last_verified_at, last_error: c.last_error,
      }));
    } catch (err: any) {
      console.error(`[Providers] Error listing credentials: ${redact(err.message)}`);
    }
  }

  const result: SafeCredential[] = [];
  for (const c of memoryCredentials.values()) {
    if (c.user_id === userId) {
      result.push({
        id: c.id, provider: c.provider, label: c.label,
        key_last4: c.key_last4, status: c.status,
        last_verified_at: c.last_verified_at, last_error: c.last_error,
      });
    }
  }
  return result;
}

export async function deleteCredential(userId: string, providerId: string, id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from("provider_credentials")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .eq("provider", providerId);
    } catch {
      // Fallback
    }
  }

  for (const [k, c] of memoryCredentials.entries()) {
    if (c.id === id && c.user_id === userId && c.provider === providerId) {
      memoryCredentials.delete(k);
      break;
    }
  }
  return true;
}

export async function verifyCredential(
  userId: string,
  providerId: string,
  id: string
): Promise<{ id: string; status: string; last_verified_at: string; last_error: string | null }> {
  const provider = getProvider(providerId);
  if (!provider) throw new Error("Unknown provider");

  let credRow: any = null;
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("provider_credentials")
        .select("id, provider, label, key_ciphertext, key_iv, key_tag, key_version")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (!error && data) credRow = data;
    } catch {
      // Fallback
    }
  }
  if (!credRow) {
    for (const c of memoryCredentials.values()) {
      if (c.id === id && c.user_id === userId) {
        credRow = c;
        break;
      }
    }
  }
  if (!credRow) throw new Error("Credential not found");

  const aad = buildAAD(userId, providerId, credRow.label);
  const { plaintext, needsReencrypt } = decrypt(
    credRow.key_ciphertext, credRow.key_iv, credRow.key_tag, aad, credRow.key_version
  );

  const valResult = await provider.validateKey(plaintext);
  const status = valResult.valid ? "active" : "invalid";
  const last_error = valResult.valid ? null : valResult.message || "Key validation failed";
  const now = new Date().toISOString();

  let updatePayload: Record<string, any> = { status, last_verified_at: now, last_error };

  if (needsReencrypt) {
    const reEncrypted = encrypt(plaintext, aad);
    updatePayload = {
      ...updatePayload,
      key_ciphertext: reEncrypted.ciphertext,
      key_iv: reEncrypted.iv,
      key_tag: reEncrypted.tag,
      key_version: reEncrypted.keyVersion,
    };
  }

  if (supabase) {
    await supabase.from("provider_credentials").update(updatePayload).eq("id", id);
  } else {
    Object.assign(credRow, updatePayload);
  }

  console.log(`[Providers] Verified credential ${id} for user ${userId}, status: ${status}`);
  return { id, status, last_verified_at: now, last_error };
}

export async function getUserDecryptedKey(userId: string, providerId: string): Promise<string | null> {
  let credRow: any = null;
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from("provider_credentials")
      .select("id, label, key_ciphertext, key_iv, key_tag, key_version, status")
      .eq("user_id", userId)
      .eq("provider", providerId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    credRow = data;
  } else {
    for (const c of memoryCredentials.values()) {
      if (c.user_id === userId && c.provider === providerId && c.status === "active") {
        credRow = c;
        break;
      }
    }
  }

  if (!credRow) return null;

  try {
    const aad = buildAAD(userId, providerId, credRow.label);
    const { plaintext, needsReencrypt } = decrypt(
      credRow.key_ciphertext, credRow.key_iv, credRow.key_tag, aad, credRow.key_version
    );

    if (needsReencrypt && supabase) {
      const re = encrypt(plaintext, aad);
      await supabase.from("provider_credentials").update({
        key_ciphertext: re.ciphertext, key_iv: re.iv,
        key_tag: re.tag, key_version: re.keyVersion,
      }).eq("id", credRow.id);
    }
    return plaintext;
  } catch (err: any) {
    console.error(`[Providers] Decryption failed for user ${userId}: ${redact(err.message)}`);
    return null;
  }
}

/**
 * Read-only peek at the in-memory credential rows for one provider.
 * Used by the catalog sync's cross-user key lookup (see activeKey.ts).
 */
export function findMemoryActiveRow(providerId: string): any | null {
  for (const c of memoryCredentials.values()) {
    if (c.provider === providerId && c.status === "active") return c;
  }
  return null;
}

export async function markCredentialInvalid(userId: string, providerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase
      .from("provider_credentials")
      .update({ status: "invalid", last_error: "Authentication failed during chat request" })
      .eq("user_id", userId)
      .eq("provider", providerId);
  } else {
    for (const c of memoryCredentials.values()) {
      if (c.user_id === userId && c.provider === providerId) {
        c.status = "invalid";
        c.last_error = "Authentication failed during chat request";
      }
    }
  }
}
