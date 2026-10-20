import { createHash, randomBytes } from "node:crypto";
import { assertSafeRemoteUrl } from "./mcp";

export interface OAuthConnector {
  slug: string;
  name: string;
  oauth_config: Record<string, any>;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string | string[];
  expires_at?: number;
  id_token?: string;
  [key: string]: any;
}

export interface OAuthAccount {
  accountId?: string;
  accountLabel?: string;
  profile?: Record<string, any>;
}

const OAUTH_TIMEOUT_MS = 15_000;
const OAUTH_MAX_RESPONSE_BYTES = 256 * 1024;

function readSafeEnvName(value: unknown, suffix: "CLIENT_ID" | "CLIENT_SECRET"): string | null {
  if (typeof value !== "string") return null;
  const envName = value.trim();
  if (!/^CONNECTOR_OAUTH_[A-Z0-9_]+_(CLIENT_ID|CLIENT_SECRET)$/.test(envName)) return null;
  return envName.endsWith(`_${suffix}`) ? envName : null;
}

export function getOAuthCredentials(connector: OAuthConnector): { clientId: string; clientSecret: string } | null {
  const clientIdEnv = readSafeEnvName(connector.oauth_config?.client_id_env, "CLIENT_ID");
  const clientSecretEnv = readSafeEnvName(connector.oauth_config?.client_secret_env, "CLIENT_SECRET");
  if (!clientIdEnv || !clientSecretEnv) return null;
  const clientId = process.env[clientIdEnv]?.trim() || "";
  const clientSecret = process.env[clientSecretEnv] || "";
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function isOAuthConfigured(connector: OAuthConnector): boolean {
  return getOAuthCredentials(connector) !== null;
}

export function createOAuthState(): { state: string; stateHash: string; codeVerifier: string; codeChallenge: string } {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(48).toString("base64url");
  return {
    state,
    stateHash: createHash("sha256").update(state).digest("hex"),
    codeVerifier,
    codeChallenge: createHash("sha256").update(codeVerifier).digest("base64url"),
  };
}

export async function buildAuthorizationUrl(
  connector: OAuthConnector,
  clientId: string,
  state: string,
  codeChallenge: string,
  redirectUri: string
): Promise<string> {
  const config = connector.oauth_config || {};
  const authorizationUrl = await assertSafeRemoteUrl(String(config.authorization_url || ""));
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("state", state);
  const scopes = Array.isArray(config.scopes) ? config.scopes.filter((scope: unknown) => typeof scope === "string") : [];
  if (scopes.length > 0) authorizationUrl.searchParams.set("scope", scopes.join(" "));

  const extra = config.authorize_params && typeof config.authorize_params === "object" ? config.authorize_params : {};
  for (const [key, value] of Object.entries(extra)) {
    if (["client_id", "response_type", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope"].includes(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value)) authorizationUrl.searchParams.set(key, String(value));
  }
  if (config.pkce !== false) {
    authorizationUrl.searchParams.set("code_challenge", codeChallenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
  }
  return authorizationUrl.toString();
}

function safeString(value: unknown, maxLength = 1000): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function pathValue(input: unknown, path: unknown): any {
  if (!input || typeof input !== "object" || typeof path !== "string" || !path.trim()) return undefined;
  return path.split(".").reduce((value: any, key) => value?.[key], input as any);
}

async function readJsonResponse(response: Response): Promise<Record<string, any>> {
  if (response.status >= 300 && response.status < 400) throw new Error("OAuth provider redirects are not allowed during token exchange.");
  const body = await response.text();
  if (body.length > OAUTH_MAX_RESPONSE_BYTES) throw new Error("OAuth provider response was too large.");
  let data: Record<string, any>;
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    throw new Error("OAuth provider returned invalid JSON.");
  }
  if (!response.ok || data.error || data.ok === false) {
    throw new Error(`OAuth provider rejected the request (HTTP ${response.status}).`);
  }
  return data;
}

function tokenRequestOptions(
  connector: OAuthConnector,
  credentials: { clientId: string; clientSecret: string },
  values: Record<string, string>
): RequestInit {
  const config = connector.oauth_config || {};
  const authMethod = config.token_auth_method === "client_secret_basic" ? "client_secret_basic" : "client_secret_post";
  const bodyValues: Record<string, string> = { ...values };
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authMethod === "client_secret_basic") {
    headers.Authorization = `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`;
  } else {
    bodyValues.client_id = credentials.clientId;
    bodyValues.client_secret = credentials.clientSecret;
  }
  const extras = config.token_params && typeof config.token_params === "object" ? config.token_params : {};
  for (const [key, value] of Object.entries(extras)) {
    if (["client_id", "client_secret", "code", "state", "redirect_uri", "refresh_token"].includes(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value)) bodyValues[key] = String(value);
  }

  let body: string;
  if (config.token_body_format === "json") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(bodyValues);
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(bodyValues).toString();
  }
  return {
    method: "POST",
    headers,
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
  };
}

async function requestTokens(connector: OAuthConnector, values: Record<string, string>): Promise<OAuthTokens> {
  const credentials = getOAuthCredentials(connector);
  if (!credentials) throw new Error("OAuth client credentials are not configured for this connector.");
  const tokenUrl = await assertSafeRemoteUrl(String(connector.oauth_config?.token_url || ""));
  const response = await fetch(tokenUrl, tokenRequestOptions(connector, credentials, values));
  const payload = await readJsonResponse(response);
  const nested = payload.authed_user && typeof payload.authed_user === "object" ? payload.authed_user : {};
  const accessToken = safeString(payload.access_token || nested.access_token, 10_000);
  if (!accessToken) throw new Error("OAuth provider did not return an access token.");
  const refreshToken = safeString(payload.refresh_token || nested.refresh_token, 10_000) || undefined;
  const expiresIn = Number(payload.expires_in || nested.expires_in);
  return {
    ...payload,
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    ...(Number.isFinite(expiresIn) && expiresIn > 0 ? { expires_at: Date.now() + expiresIn * 1000 } : {}),
  };
}

export async function exchangeOAuthCode(
  connector: OAuthConnector,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<OAuthTokens> {
  return requestTokens(connector, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
}

export async function refreshOAuthTokens(connector: OAuthConnector, oldTokens: OAuthTokens): Promise<OAuthTokens> {
  if (!oldTokens.refresh_token) throw new Error("This connector needs to be reconnected.");
  const refreshed = await requestTokens(connector, {
    grant_type: "refresh_token",
    refresh_token: oldTokens.refresh_token,
  });
  return {
    ...oldTokens,
    ...refreshed,
    refresh_token: refreshed.refresh_token || oldTokens.refresh_token,
  };
}

export async function fetchOAuthAccount(connector: OAuthConnector, tokens: OAuthTokens): Promise<OAuthAccount> {
  const config = connector.oauth_config || {};
  const profileUrl = safeString(config.profile_url);
  let profile: Record<string, any> = {};
  if (profileUrl) {
    try {
      const url = await assertSafeRemoteUrl(profileUrl);
      const headers: Record<string, string> = {
        Authorization: `${safeString(tokens.token_type) || "Bearer"} ${tokens.access_token}`,
        Accept: "application/json",
      };
      if (config.profile_headers && typeof config.profile_headers === "object") {
        for (const [key, value] of Object.entries(config.profile_headers)) {
          if (typeof value === "string" && !/^(authorization|cookie)$/i.test(key)) headers[key] = value.slice(0, 300);
        }
      }
      const response = await fetch(url, {
        method: "GET",
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
      });
      profile = await readJsonResponse(response);
    } catch {
      // Account-label enrichment is optional; successful authorization remains valid without it.
      profile = {};
    }
  }

  const name = safeString(pathValue(profile, config.profile_name_path), 100)
    || safeString(pathValue(tokens, config.account_name_path), 100)
    || safeString(tokens.workspace_name, 100)
    || connector.name;
  const id = safeString(pathValue(profile, config.profile_id_path), 200)
    || safeString(pathValue(tokens, config.account_id_path), 200)
    || safeString(tokens.workspace_id, 200)
    || undefined;
  return { accountId: id, accountLabel: name, profile };
}
