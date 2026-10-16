import { isRealSupabaseConfigured, supabase } from "./supabaseClient";
import { authFetch } from "./authHeaders";
import { isInIframe, isStorageAvailable } from "./environment";

/** Fields returned by GET /api/auth/debug (metadata only, never secrets). */
export interface ServerAuthDebug {
  serverMode: string;
  hasAuthHeader: boolean;
  scheme: string | null;
  tokenLength: number;
  verified: boolean;
  userIdPrefix: string | null;
  errorCode: string | null;
}

export type ServerDebugResult =
  | { ok: true; data: ServerAuthDebug }
  | { ok: false; status: number | null; error: string };

export interface ConnectionDiagnostics {
  generatedAt: string;
  clientMode: "supabase" | "local-mock";
  hasSession: boolean;
  /** Whole minutes until the access token expires (negative once expired). */
  minutesUntilExpiry: number | null;
  storageAvailable: boolean;
  inIframe: boolean;
  origin: string;
  server: ServerDebugResult;
}

// Copy only known fields so nothing unexpected can leak into the report.
function pickServerFields(raw: any): ServerAuthDebug {
  return {
    serverMode: typeof raw?.serverMode === "string" ? raw.serverMode : "unknown",
    hasAuthHeader: raw?.hasAuthHeader === true,
    scheme: typeof raw?.scheme === "string" ? raw.scheme : null,
    tokenLength: typeof raw?.tokenLength === "number" ? raw.tokenLength : 0,
    verified: raw?.verified === true,
    userIdPrefix: typeof raw?.userIdPrefix === "string" ? raw.userIdPrefix.slice(0, 6) : null,
    errorCode: typeof raw?.errorCode === "string" ? raw.errorCode : null,
  };
}

async function readClientSession(): Promise<Pick<ConnectionDiagnostics, "hasSession" | "minutesUntilExpiry">> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session?.access_token) return { hasSession: false, minutesUntilExpiry: null };
    const expiresAt = typeof session.expires_at === "number" ? session.expires_at : null;
    return {
      hasSession: true,
      minutesUntilExpiry: expiresAt === null ? null : Math.floor((expiresAt * 1000 - Date.now()) / 60000),
    };
  } catch {
    return { hasSession: false, minutesUntilExpiry: null };
  }
}

export async function fetchServerAuthDebug(): Promise<ServerDebugResult> {
  try {
    // Same request path as every API call, so the server sees what the app sends.
    const res = await authFetch("/api/auth/debug", { cache: "no-store" });
    if (!res.ok) {
      const error = res.status === 429 ? "Rate limited, try again in a minute" : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error };
    }
    return { ok: true, data: pickServerFields(await res.json()) };
  } catch {
    return { ok: false, status: null, error: "Backend not reachable" };
  }
}

export async function collectConnectionDiagnostics(): Promise<ConnectionDiagnostics> {
  const client = await readClientSession();
  const server = await fetchServerAuthDebug();
  return {
    generatedAt: new Date().toISOString(),
    clientMode: isRealSupabaseConfigured ? "supabase" : "local-mock",
    ...client,
    storageAvailable: isStorageAvailable(),
    inIframe: isInIframe(),
    origin: typeof window !== "undefined" ? window.location.origin : "",
    server,
  };
}

export function describeExpiry(minutes: number | null, hasSession: boolean): string {
  if (!hasSession) return "n/a (no session)";
  if (minutes === null) return "unknown";
  if (minutes < 0) return `expired ${Math.abs(minutes)} min ago`;
  return minutes === 0 ? "in less than a minute" : `in ${minutes} min`;
}

// Defence in depth: the report is built from an allowlist and never contains a
// token, but scrub anything token-shaped before it can reach the clipboard.
const JWT_LIKE = /eyJ[\w-]*\.[\w-]+\.[\w-]*/g;
const BEARER_LIKE = /\bBearer\s+\S+/gi;

export function formatDiagnosticsReport(d: ConnectionDiagnostics): string {
  const lines = [
    "Connection diagnostics",
    `Generated: ${d.generatedAt}`,
    `Page origin: ${d.origin}`,
    `Client mode: ${d.clientMode === "supabase" ? "Real Supabase" : "Local mock"}`,
    `Session: ${d.hasSession ? "present" : "none"}`,
    `Access token expires: ${describeExpiry(d.minutesUntilExpiry, d.hasSession)}`,
    `Storage available: ${d.storageAvailable ? "yes" : "no"}`,
    `Inside iframe: ${d.inIframe ? "yes (storage/cookies can be blocked in embedded previews)" : "no"}`,
  ];
  if (d.server.ok) {
    const s = d.server.data;
    lines.push(
      "Server (/api/auth/debug):",
      `  serverMode: ${s.serverMode}`,
      `  hasAuthHeader: ${s.hasAuthHeader}`,
      `  scheme: ${s.scheme ?? "none"}`,
      `  tokenLength: ${s.tokenLength}`,
      `  verified: ${s.verified}`,
      `  userIdPrefix: ${s.userIdPrefix ?? "none"}`,
      `  errorCode: ${s.errorCode ?? "none"}`
    );
  } else {
    lines.push(`Server (/api/auth/debug): failed (${d.server.error})`);
  }
  return lines.join("\n").replace(JWT_LIKE, "[redacted]").replace(BEARER_LIKE, "Bearer [redacted]");
}
