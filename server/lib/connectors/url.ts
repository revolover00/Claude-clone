export const CONNECTOR_OAUTH_CALLBACK_PATH = "/api/connectors/oauth/callback";

export function allowedAppOrigin(value: string, allowPreview: boolean): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(allowPreview && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    if (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}
