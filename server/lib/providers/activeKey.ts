import { decrypt, buildAAD } from "../crypto/keyVault";
import { getSupabaseClient } from "../skills/db";
import { findMemoryActiveRow } from "./credentialsStore";

/**
 * Any active key for `providerId` across users — used ONLY by the background
 * catalog sync so the model list stays fresh without server-side secrets
 * (the server never reads GEMINI_API_KEY / GROQ_API_KEY from the deploy
 * environment). Plaintext stays on the server and is never logged or sent
 * to clients.
 */
export async function findActiveCredentialKey(providerId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  let row: any = null;

  if (supabase) {
    try {
      const { data } = await supabase
        .from("provider_credentials")
        .select("user_id, label, key_ciphertext, key_iv, key_tag, key_version")
        .eq("provider", providerId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      row = data;
    } catch {
      /* fall back to the in-memory rows */
    }
  }
  if (!row) row = findMemoryActiveRow(providerId);
  if (!row) return null;

  try {
    const aad = buildAAD(row.user_id, providerId, row.label);
    const { plaintext } = decrypt(row.key_ciphertext, row.key_iv, row.key_tag, aad, row.key_version);
    return plaintext;
  } catch {
    return null;
  }
}
