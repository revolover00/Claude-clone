import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const isRealSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseServiceKey && 
  !supabaseUrl.includes("YOUR_") && 
  !supabaseServiceKey.includes("YOUR_")
);

// Initialize server-side Supabase client with the service key if configured
const supabaseServer = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const isProd = process.env.NODE_ENV === "production";
  const allowGuest = process.env.ALLOW_GUEST === "true";

  // Check if it's a mock guest token in development/test
  if (!isProd && allowGuest && authHeader && authHeader.startsWith("Bearer mock-jwt-token-")) {
    const token = authHeader.split(" ")[1];
    const guestId = token.substring("mock-jwt-token-".length) || "guest-random";
    req.user = {
      id: guestId,
      email: "guest@example.com",
    };
    next();
    return;
  }

  if (!isRealSupabaseConfigured || !supabaseServer) {
    if (isProd || !allowGuest) {
      res.status(401).json({ error: "Unauthorized: Supabase not configured and guest mode is disabled." });
      return;
    }
    // Default fallback if no token provided in guest mode
    let guestId = "guest-fallback";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token.startsWith("mock-jwt-token-")) {
        guestId = token.substring("mock-jwt-token-".length);
      }
    }
    req.user = {
      id: guestId,
      email: "guest@example.com",
    };
    next();
    return;
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
    };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized: Verification failed" });
  }
}
