/**
 * Auto-retry policy for the chat stream.
 *
 * Retrying must NEVER duplicate an answer the user can already see: a second
 * run re-sends the whole prompt and would append a second full reply (the
 * "finished, then writes everything again" bug). Transport failures with no
 * rendered content may retry once or twice; explicit provider errors
 * (4xx / coded errors like KEY_MISSING, MODEL_NOT_FOUND) never retry.
 */
export function shouldAutoRetryStream(
  err: { message?: string; code?: unknown },
  hasRenderedContent: boolean,
  attemptsSoFar: number
): boolean {
  if (attemptsSoFar >= 2) return false;
  if (hasRenderedContent) return false;

  const code = err.code;
  // Explicit non-server codes (KEY_MISSING, MODEL_NOT_FOUND, ...) and 4xx never retry.
  if (typeof code === "string") {
    // The provider dropped a long generation before anything rendered —
    // one clean re-request is safe (nothing was shown, so no duplication).
    return code === "STREAM_INTERRUPTED";
  }
  if (typeof code === "number" && code < 500) return false;

  // True transport failure (server unreachable) with nothing rendered.
  if (err.message === "Backend unreachable") return true;

  // Numeric 5xx without content: one transient upstream hiccup is worth a retry.
  return typeof code === "number" && code >= 500;
}
