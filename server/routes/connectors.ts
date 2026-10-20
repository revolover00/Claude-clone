import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { encryptConnectorSecret } from "../lib/connectors/toolRegistry";
import { assertSafeRemoteUrl, openMcpSession } from "../lib/connectors/mcp";
import { buildAuthorizationUrl, createOAuthState, getOAuthCredentials } from "../lib/connectors/oauth";
import {
  CONNECTOR_SAFE_CONNECTION_COLUMNS,
  getConnectorBySlug,
  getConnectorDb,
  listConnectorCatalog,
  listUserConnections,
} from "../lib/connectors/store";
import type { ConnectorConnectionRecord } from "../lib/connectors/types";
import { allowedAppOrigin, CONNECTOR_OAUTH_CALLBACK_PATH } from "../lib/connectors/url";

const router = Router();
const mcpCreateTimes = new Map<string, number[]>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function userIdOf(req: Request): string | null {
  return (req as any).user?.id || null;
}

function publicConnection(connection: ConnectorConnectionRecord) {
  return {
    id: connection.id,
    catalogSlug: connection.catalog_slug,
    connectionType: connection.connection_type,
    displayName: connection.display_name,
    serverUrl: connection.server_url,
    accountLabel: connection.account_label,
    status: connection.status,
    toolsCount: connection.tools_count,
    connectedAt: connection.connected_at,
  };
}

function allowedAppOrigin(value: string, allowPreview: boolean): string | null {
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

function getOAuthUrls(req: Request): { redirectUri: string; appOrigin: string } {
  const appBase = process.env.CONNECTORS_APP_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL;
  const redirectOverride = process.env.CONNECTORS_REDIRECT_URI;
  const isDevelopment = process.env.NODE_ENV !== "production";

  if (appBase) {
    const appOrigin = allowedAppOrigin(appBase, isDevelopment);
    if (!appOrigin) throw new Error("CONNECTORS_APP_URL must be a valid HTTPS origin (localhost HTTP is allowed only in development).");
    const redirectUri = redirectOverride ? new URL(redirectOverride).toString() : new URL(CONNECTOR_OAUTH_CALLBACK_PATH, appOrigin).toString();
    const parsedRedirect = new URL(redirectUri);
    if (
      parsedRedirect.pathname !== CONNECTOR_OAUTH_CALLBACK_PATH || parsedRedirect.search || parsedRedirect.hash ||
      !allowedAppOrigin(parsedRedirect.origin, isDevelopment) || parsedRedirect.origin !== appOrigin
    ) {
      throw new Error("CONNECTORS_REDIRECT_URI must use the app origin and point to /api/connectors/oauth/callback.");
    }
    return { redirectUri, appOrigin };
  }

  if (redirectOverride) {
    const parsedRedirect = new URL(redirectOverride);
    const appOrigin = allowedAppOrigin(parsedRedirect.origin, isDevelopment);
    if (!appOrigin || parsedRedirect.pathname !== CONNECTOR_OAUTH_CALLBACK_PATH || parsedRedirect.search || parsedRedirect.hash) {
      throw new Error("CONNECTORS_REDIRECT_URI must be a valid app callback URL.");
    }
    return { redirectUri: parsedRedirect.toString(), appOrigin };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Set CONNECTORS_APP_URL before enabling OAuth connectors.");
  }

  const host = req.get("host") || "";
  const protocol = req.protocol || "http";
  const origin = allowedAppOrigin(`${protocol}://${host}`, true);
  const hostname = origin ? new URL(origin).hostname : "";
  if (!origin || !(hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".e2b.app"))) {
    throw new Error("Set CONNECTORS_APP_URL before enabling OAuth connectors.");
  }
  return { redirectUri: new URL(CONNECTOR_OAUTH_CALLBACK_PATH, origin).toString(), appOrigin: origin };
}

function rateLimitMcpCreation(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000;
  const times = (mcpCreateTimes.get(userId) || []).filter((time) => time > cutoff);
  if (times.length >= 5) return false;
  times.push(now);
  mcpCreateTimes.set(userId, times);
  return true;
}

function safeErrorMessage(error: any, fallback: string): string {
  const message = String(error?.message || fallback).replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
  return message.slice(0, 300);
}

router.get("/", async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [catalog, connections] = await Promise.all([listConnectorCatalog(), listUserConnections(userId)]);
    const connectionsBySlug = new Map(connections.filter((connection) => connection.catalog_slug).map((connection) => [connection.catalog_slug!, connection]));
    const connectors = catalog.map((connector) => {
      const connection = connectionsBySlug.get(connector.slug);
      const oauthConfigured = connector.auth_type === "oauth" && !!getOAuthCredentials(connector) && (
        process.env.NODE_ENV !== "production" || Boolean(process.env.CONNECTORS_APP_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL)
      );
      return {
        slug: connector.slug,
        name: connector.name,
        description: connector.description,
        category: connector.category,
        icon: connector.icon,
        accentColor: /^#[0-9A-Fa-f]{6}$/.test(connector.accent_color) ? connector.accent_color : "#6B7280",
        websiteUrl: connector.website_url,
        authType: connector.auth_type,
        oauthConfigured,
        connected: !!connection && connection.status === "connected",
        ...(connection ? {
          connectionId: connection.id,
          accountLabel: connection.account_label,
          status: connection.status,
          toolsCount: connection.tools_count,
          connectedAt: connection.connected_at,
        } : { toolsCount: 0 }),
        mcpAvailable: !!connector.mcp_endpoint,
        featured: connector.featured,
        sortOrder: connector.sort_order,
      };
    });
    const customConnections = connections
      .filter((connection) => connection.connection_type === "mcp" && !connection.catalog_slug)
      .map(publicConnection);
    res.json({ connectors, customConnections });
  } catch (error: any) {
    const message = safeErrorMessage(error, "Unable to load connectors.");
    res.status(/Supabase server credentials/.test(message) ? 503 : 500).json({ error: message });
  }
});

router.post("/mcp", async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!rateLimitMcpCreation(userId)) return res.status(429).json({ error: "You can add at most five MCP servers per hour." });

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const serverUrl = typeof req.body?.serverUrl === "string" ? req.body.serverUrl.trim() : "";
  const bearerToken = typeof req.body?.bearerToken === "string" ? req.body.bearerToken.trim() : "";
  if (!name || name.length > 100) return res.status(400).json({ error: "Name must be between 1 and 100 characters." });
  if (!serverUrl || serverUrl.length > 2048) return res.status(400).json({ error: "Enter a valid MCP server URL (maximum 2,048 characters)." });
  if (bearerToken.length > 4096 || /\s/.test(bearerToken)) return res.status(400).json({ error: "The bearer token is invalid or too long." });

  try {
    const safeUrl = await assertSafeRemoteUrl(serverUrl);
    if (safeUrl.search) return res.status(400).json({ error: "MCP server URLs cannot contain query parameters; use the bearer-token field for authentication." });
    const session = await openMcpSession(safeUrl.toString(), bearerToken || null);
    const tools = await session.listTools();
    const id = randomUUID();
    const encrypted = bearerToken ? encryptConnectorSecret(userId, id, { access_token: bearerToken }) : null;
    const db = getConnectorDb();
    const { data, error } = await db.from("connector_connections").insert({
      id,
      user_id: userId,
      catalog_slug: null,
      connection_type: "mcp",
      display_name: name,
      server_url: safeUrl.toString(),
      account_label: typeof session.serverInfo?.name === "string" ? session.serverInfo.name.slice(0, 100) : null,
      status: "connected",
      metadata: { serverInfo: {
        name: typeof session.serverInfo?.name === "string" ? session.serverInfo.name.slice(0, 100) : null,
        version: typeof session.serverInfo?.version === "string" ? session.serverInfo.version.slice(0, 80) : null,
      } },
      tools_count: tools.length,
      ...(encrypted ? {
        secret_ciphertext: encrypted.ciphertext,
        secret_iv: encrypted.iv,
        secret_tag: encrypted.tag,
        key_version: encrypted.keyVersion,
      } : {}),
    }).select(CONNECTOR_SAFE_CONNECTION_COLUMNS).single();
    if (error) throw error;
    res.status(201).json({ customConnection: publicConnection(data as ConnectorConnectionRecord) });
  } catch (error: any) {
    res.status(400).json({ error: safeErrorMessage(error, "Unable to connect to this MCP server.") });
  }
});

router.post("/:slug/oauth/start", async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const slug = String(req.params.slug || "").toLowerCase();
  try {
    const connector = await getConnectorBySlug(slug);
    if (!connector || connector.auth_type !== "oauth") return res.status(404).json({ error: "Connector not found." });
    const credentials = getOAuthCredentials(connector);
    if (!credentials) return res.status(409).json({ error: "OAuth credentials are not configured for this connector yet.", code: "OAUTH_SETUP_REQUIRED" });

    const urls = getOAuthUrls(req);
    const state = createOAuthState();
    const authorizationUrl = await buildAuthorizationUrl(connector, credentials.clientId, state.state, state.codeChallenge, urls.redirectUri);
    const db = getConnectorDb();
    const { error } = await db.from("connector_oauth_states").insert({
      state_hash: state.stateHash,
      user_id: userId,
      catalog_slug: connector.slug,
      code_verifier: state.codeVerifier,
      redirect_uri: urls.redirectUri,
      app_origin: urls.appOrigin,
      expires_at: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
    });
    if (error) throw error;
    void db.from("connector_oauth_states").delete().lt("expires_at", new Date().toISOString());
    res.json({ authorizationUrl });
  } catch (error: any) {
    const message = safeErrorMessage(error, "Unable to start OAuth.");
    res.status(/not configured/.test(message) ? 409 : 500).json({ error: message });
  }
});

router.delete("/:connectionId", async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const connectionId = String(req.params.connectionId || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(connectionId)) {
    return res.status(400).json({ error: "Invalid connection ID." });
  }
  try {
    const { data, error } = await getConnectorDb()
      .from("connector_connections")
      .delete()
      .eq("id", connectionId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Connector connection not found." });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: safeErrorMessage(error, "Unable to disconnect connector.") });
  }
});

export default router;
