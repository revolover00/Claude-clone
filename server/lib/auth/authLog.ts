import type { Request } from "express";
import type { AuthErrorCode, ParsedAuthHeader } from "./authHeader";

/** Coarse browser/client family; the full user-agent string is never logged. */
export function userAgentFamily(userAgent: unknown): string {
  if (typeof userAgent !== "string" || !userAgent.trim()) return "none";
  const ua = userAgent.toLowerCase();
  if (/bot|crawler|spider|slurp|headless/.test(ua)) return "bot";
  if (ua.includes("edg/") || ua.includes("edga/") || ua.includes("edgios/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("firefox/") || ua.includes("fxios/")) return "Firefox";
  if (ua.includes("chrome/") || ua.includes("crios/") || ua.includes("chromium/")) return "Chrome";
  if (ua.includes("safari/")) return "Safari";
  if (ua.startsWith("curl/")) return "curl";
  if (ua.includes("postman")) return "Postman";
  if (ua.includes("node") || ua.includes("undici")) return "Node";
  return "other";
}

/** Single-line, log-injection-safe rendering of a header value. */
function safeValue(value: unknown, maxLength = 120): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw) return "-";
  const cleaned = raw.replace(/[^\x21-\x7e]/g, "?");
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned;
}

function requestPath(req: Request): string {
  // Strip the query string: it is the one part of a URL that may carry secrets.
  const url = req.originalUrl || req.url || "";
  return safeValue(url.split("?")[0] || "/", 200);
}

/**
 * Builds the single log line for an authentication failure. It contains only
 * metadata about the Authorization header (presence, scheme, length) and never
 * the token or any part of it.
 */
export function formatAuthFailureLog(
  req: Request,
  code: AuthErrorCode,
  header: ParsedAuthHeader
): string {
  const headers = req.headers || {};
  return [
    "[auth] 401",
    code,
    `method=${safeValue(req.method, 10)}`,
    `path=${requestPath(req)}`,
    `authHeader=${header.present ? "present" : "absent"}`,
    `scheme=${header.scheme ?? "-"}`,
    `tokenLength=${header.tokenLength}`,
    `host=${safeValue(headers.host)}`,
    `origin=${safeValue(headers.origin)}`,
    `ua=${userAgentFamily(headers["user-agent"])}`,
  ].join(" ");
}

export function logAuthFailure(req: Request, code: AuthErrorCode, header: ParsedAuthHeader): void {
  console.warn(formatAuthFailureLog(req, code, header));
}
