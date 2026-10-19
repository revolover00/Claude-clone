import { Router, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  authenticateRequest,
  getServerAuthMode,
  parseAuthorizationHeader,
  type AuthErrorCode,
  type ServerAuthMode,
} from "../middleware/auth";

/**
 * Shape of GET /api/auth/debug. Only booleans and metadata: never a token, a
 * key, an email or a full user id.
 */
export interface AuthDebugResponse {
  serverMode: ServerAuthMode;
  hasAuthHeader: boolean;
  scheme: string | null;
  tokenLength: number;
  verified: boolean;
  userIdPrefix: string | null;
  errorCode: AuthErrorCode | null;
}

export const AUTH_DEBUG_RATE_LIMIT = { windowMs: 60 * 1000, limit: 20 };

export function createAuthDebugRouter(limits = AUTH_DEBUG_RATE_LIMIT) {
  const router = Router();

  const limiter = rateLimit({
    windowMs: limits.windowMs,
    limit: limits.limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => ipKeyGenerator(req.ip || "unknown"),
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: "Too many diagnostic requests, try again in a minute", code: 429 });
    },
  });

  // Deliberately NOT behind requireAuth: it must answer even when auth is broken.
  router.get("/debug", limiter, async (req: Request, res: Response) => {
    const header = parseAuthorizationHeader(req.headers.authorization);
    let verified = false;
    let userIdPrefix: string | null = null;
    let errorCode: AuthErrorCode | null = null;

    try {
      const result = await authenticateRequest(req, header);
      if (result.ok) {
        verified = true;
        userIdPrefix = result.user.id.slice(0, 6);
      } else {
        errorCode = result.code;
      }
    } catch {
      errorCode = "AUTH_UNAVAILABLE";
    }

    const body: AuthDebugResponse = {
      serverMode: getServerAuthMode(),
      hasAuthHeader: header.present,
      scheme: header.scheme,
      tokenLength: header.tokenLength,
      verified,
      userIdPrefix,
      errorCode,
    };
    res.set("Cache-Control", "no-store");
    res.json(body);
  });

  return router;
}

export default createAuthDebugRouter();
