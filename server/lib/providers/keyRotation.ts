import { decrypt, buildAAD } from "../crypto/keyVault";
import { getSupabaseClient } from "../skills/db";
import { memoryCredentialRows, redact } from "./credentialsStore";

export interface KeyCandidate {
  id: string;
  label: string;
  key: string;
}

export type KeyFailureCode = "KEY_INVALID" | "CREDITS_EXHAUSTED" | "RATE_LIMITED";

/** Accepts a client-provided priority order: unique non-empty ids, bounded. */
export function sanitizeKeyOrder(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter((v): v is string => typeof v === "string" && v.length > 0);
  const unique = [...new Set(ids)].slice(0, 20);
  return unique.length ? unique : undefined;
}

/**
 * Every *active* key for one provider in priority order: ids listed in
 * `order` first (saved by the Settings UI), then newest-created first.
 * Rows that fail to decrypt are skipped so one bad row never blocks the
 * chain. Keys marked `invalid` or `exhausted` are not returned, which is
 * what makes fallback automatic on the next request.
 */
export async function listKeyCandidates(
  userId: string,
  providerId: string,
  order?: string[]
): Promise<KeyCandidate[]> {
  const rows: any[] = [];
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("provider_credentials")
      .select("id, label, key_ciphertext, key_iv, key_tag, key_version, status, created_at")
      .eq("user_id", userId)
      .eq("provider", providerId)
      .eq("status", "active");
    if (!error && data) rows.push(...data);
  } else {
    for (const c of memoryCredentialRows.values()) {
      if (c.user_id === userId && c.provider === providerId && (!c.status || c.status === "active")) {
        rows.push(c);
      }
    }
  }

  const rank = (id: string): number => {
    if (!order) return Number.MAX_SAFE_INTEGER;
    const idx = order.indexOf(id);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  rows.sort((a, b) => {
    const ra = rank(a.id);
    const rb = rank(b.id);
    if (ra !== rb) return ra - rb;
    return String(b.created_at || b.id).localeCompare(String(a.created_at || a.id));
  });

  const candidates: KeyCandidate[] = [];
  for (const row of rows) {
    try {
      const aad = buildAAD(userId, providerId, row.label);
      const { plaintext, needsReencrypt } = decrypt(
        row.key_ciphertext, row.key_iv, row.key_tag, aad, row.key_version
      );
      if (needsReencrypt && supabase) {
        const { encrypt } = await import("../crypto/keyVault");
        const re = encrypt(plaintext, aad);
        await supabase
          .from("provider_credentials")
          .update({ key_ciphertext: re.ciphertext, key_iv: re.iv, key_tag: re.tag, key_version: re.keyVersion })
          .eq("id", row.id);
      }
      candidates.push({ id: row.id, label: row.label, key: plaintext });
    } catch (err: any) {
      console.error(`[KeyRotation] Skipping undecryptable credential ${row.id}: ${redact(err.message)}`);
    }
  }
  return candidates;
}

/**
 * Persist the fate of ONE credential: `invalid` (auth rejected it) or
 * `exhausted` (quota/credits ran out). Both statuses drop the key out of
 * `listKeyCandidates`, so the next request — and the rest of the current
 * rotation chain — simply runs on the next key.
 */
export async function markCredentialStatus(
  userId: string,
  providerId: string,
  id: string,
  status: "invalid" | "exhausted",
  reason: string
): Promise<void> {
  if (!id) return;
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase
      .from("provider_credentials")
      .update({ status, last_error: reason.slice(0, 300) })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("provider", providerId);
  } else {
    for (const c of memoryCredentialRows.values()) {
      if (c.id === id && c.user_id === userId) {
        c.status = status;
        c.last_error = reason.slice(0, 300);
        return;
      }
    }
  }
}
