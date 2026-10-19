import { getUserDecryptedKey } from "./providers/credentialsStore";

/**
 * The user's own AI keys. The server never reads `GEMINI_API_KEY` (or any
 * other provider secret) from the environment/deploy configuration — every AI
 * call is billed to and authorised by the key the user saved in
 * Settings > Providers.
 */
export async function geminiKeyFor(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    return await getUserDecryptedKey(userId, "gemini");
  } catch {
    return null;
  }
}
