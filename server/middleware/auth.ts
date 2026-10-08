import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Initialize server-side Supabase client with the service key for secure access controls
const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
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
