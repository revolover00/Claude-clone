/**
 * Authorization header parsing and the machine-readable reason codes returned
 * in 401 bodies. Nothing in this module logs; `token` is only exposed so the
 * caller can verify it and must never be written to logs or responses.
 */

export const AUTH_ERROR_CODES = [
  "AUTH_HEADER_MISSING",
  "AUTH_HEADER_MALFORMED",
  "AUTH_TOKEN_INVALID",
  "AUTH_TOKEN_EXPIRED",
  "AUTH_UNAVAILABLE",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** Short, human-readable messages sent next to the code in every 401 body. */
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  AUTH_HEADER_MISSING: "Sign-in required: no Authorization header was sent.",
  AUTH_HEADER_MALFORMED: 'Sign-in required: expected an "Authorization: Bearer <token>" header.',
  AUTH_TOKEN_INVALID: "Your session is not valid. Please sign in again.",
  AUTH_TOKEN_EXPIRED: "Your session has expired. Please sign in again.",
  AUTH_UNAVAILABLE: "Could not verify your session right now. Please try again shortly.",
};

// Only these scheme names are ever echoed back (logs, debug endpoint). Anything
// else is reported as "unrecognized" because an unknown first word could be a
// fragment of a credential.
const KNOWN_SCHEMES: Record<string, string> = {
  bearer: "Bearer",
  basic: "Basic",
  digest: "Digest",
  token: "Token",
  negotiate: "Negotiate",
  dpop: "DPoP",
};

// Stringified "empty" values produced by buggy clients (`Bearer ${undefined}`).
const EMPTY_LIKE_TOKENS = new Set(["", "undefined", "null"]);

export interface ParsedAuthHeader {
  /** An Authorization header was sent (even if empty). */
  present: boolean;
  /** Safe to log: a canonical known scheme, "none", "unrecognized", or null when absent. */
  scheme: string | null;
  /** Safe to log: length of the credential part, never its content. */
  tokenLength: number;
  /** Set only for a well-formed `Bearer <token>` header. NEVER log this. */
  token: string | null;
  /** Present but not a usable `Bearer <token>` header. */
  malformed: boolean;
}

export function parseAuthorizationHeader(raw: unknown): ParsedAuthHeader {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null) {
    return { present: false, scheme: null, tokenLength: 0, token: null, malformed: false };
  }

  const trimmed = String(value).trim();
  const firstSpace = trimmed.search(/\s/);
  const schemeRaw = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
  const knownScheme = KNOWN_SCHEMES[schemeRaw.toLowerCase()];

  if (firstSpace === -1 && !knownScheme) {
    // A single word with no scheme: most likely a raw token pasted without "Bearer ".
    return { present: true, scheme: "none", tokenLength: trimmed.length, token: null, malformed: true };
  }

  const credentials = firstSpace === -1 ? "" : trimmed.slice(firstSpace).trim();
  const scheme = knownScheme ?? "unrecognized";
  const wellFormed =
    scheme === "Bearer" && !EMPTY_LIKE_TOKENS.has(credentials) && !/\s/.test(credentials);

  return {
    present: true,
    scheme,
    tokenLength: credentials.length,
    token: wellFormed ? credentials : null,
    malformed: !wellFormed,
  };
}
