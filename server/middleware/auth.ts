import type { Request, Response, NextFunction } from "express";
import {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  parseAuthorizationHeader,
  type AuthErrorCode,
  type ParsedAuthHeader,
} from "../lib/auth/authHeader";
import {
  getServerAuthMode,
  isGuestAllowed,
  verifySupabaseToken,
  type AuthResult,
  type ServerAuthMode,
} from "../lib/auth/verifyToken";
import { logAuthFailure } from "../lib/auth/authLog";

export { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES, getServerAuthMode, parseAuthorizationHeader };
export type { AuthErrorCode, AuthResult, ParsedAuthHeader, ServerAuthMode };

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

const MOCK_TOKEN_PREFIX = "mock-jwt-token-";
const GUEST_EMAIL = "guest@example.com";

/**
 * Decides whether a request is authenticated, without side effects (no logging,
 * no response). Shared by `requireAuth` and the `/api/auth/debug` endpoint so the
 * diagnostic answer always matches what protected routes would do.
 */
export async function authenticateRequest(
  req: Request,
  header: ParsedAuthHeader = parseAuthorizationHeader(req.headers?.authorization)
): Promise<AuthResult> {
  // Development-only mock tokens issued by the client's local mode.
  if (isGuestAllowed() && header.scheme === "Bearer" && header.token?.startsWith(MOCK_TOKEN_PREFIX)) {
    const guestId = header.token.slice(MOCK_TOKEN_PREFIX.length) || "guest-random";
    return { ok: true, user: { id: guestId, email: GUEST_EMAIL } };
  }

  const mode = getServerAuthMode();
  if (mode === "guest") {
    return { ok: true, user: { id: "guest-fallback", email: GUEST_EMAIL } };
  }
  if (mode === "unconfigured") {
    return {
      ok: false,
      code: "AUTH_UNAVAILABLE",
      message: "Authentication is not configured on this server.",
    };
  }

  if (!header.present) return { ok: false, code: "AUTH_HEADER_MISSING" };
  if (header.malformed || !header.token) return { ok: false, code: "AUTH_HEADER_MALFORMED" };
  return verifySupabaseToken(header.token);
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Already verified earlier in this request (e.g. app-level + route-level guards).
  if (req.user?.id) {
    next();
    return;
  }

  const header = parseAuthorizationHeader(req.headers?.authorization);
  let result: AuthResult;
  try {
    result = await authenticateRequest(req, header);
  } catch {
    result = { ok: false, code: "AUTH_UNAVAILABLE" };
  }

  if (result.ok) {
    req.user = result.user;
    next();
    return;
  }

  logAuthFailure(req, result.code, header);
  res.status(401).json({
    error: result.message ?? AUTH_ERROR_MESSAGES[result.code],
    code: result.code,
  });
}
