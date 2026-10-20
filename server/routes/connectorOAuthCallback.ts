import { createHash, randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { encryptConnectorSecret } from "../lib/connectors/toolRegistry";
import { openMcpSession } from "../lib/connectors/mcp";
import { exchangeOAuthCode, fetchOAuthAccount } from "../lib/connectors/oauth";
import { getConnectorBySlug, getConnectorDb } from "../lib/connectors/store";
import { getNativeConnectorToolCount } from "../lib/connectors/nativeTools";
import { allowedAppOrigin } from "../lib/connectors/url";

const oauthCallbackRouter = Router();

function asQueryString(value: unknown): string | null {
  return typeof value === "string" && value.length <= 4096 ? value : null;
}

async function callbackErrorRedirect(state: string | null, res: Response, message = "Connector authorization did not complete.") {
  if (state) {
    try {
      const stateHash = createOAuthStateHash(state);
      const db = getConnectorDb();
      const { data } = await db.from("connector_oauth_states").delete().eq("state_hash", stateHash).select("app_origin").maybeSingle();
      const origin = typeof data?.app_origin === "string" ? allowedAppOrigin(data.app_origin, process.env.NODE_ENV !== "production") : null;
      if (origin) return res.redirect(303, `${origin}/?connector_oauth=error`);
    } catch {
      // Fall through to a minimal static error page.
    }
  }
  res.status(400).type("text/plain").send(message);
}

function createOAuthStateHash(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

async function handleOAuthCallback(req: Request, res: Response) {
  const state = asQueryString(req.query.state);
  const code = asQueryString(req.query.code);
  const providerError = asQueryString(req.query.error);
  if (!state || providerError || !code) {
    await callbackErrorRedirect(state, res, providerError ? "Connector authorization was declined." : "Invalid connector authorization response.");
    return;
  }

  let callbackOrigin: string | null = null;
  try {
    const stateHash = createOAuthStateHash(state);
    const db = getConnectorDb();
    const now = new Date().toISOString();
    const { data: pending, error: stateError } = await db
      .from("connector_oauth_states")
      .delete()
      .eq("state_hash", stateHash)
      .gt("expires_at", now)
      .select("user_id,catalog_slug,code_verifier,redirect_uri,app_origin")
      .maybeSingle();
    if (stateError) throw stateError;
    if (!pending) {
      res.status(400).type("text/plain").send("Connector authorization expired or was already used. Return to the app and try again.");
      return;
    }

    const appOrigin = allowedAppOrigin(String(pending.app_origin), process.env.NODE_ENV !== "production");
    if (!appOrigin) throw new Error("Connector app URL is invalid.");
    callbackOrigin = appOrigin;
    const connector = await getConnectorBySlug(String(pending.catalog_slug));
    if (!connector || connector.auth_type !== "oauth") throw new Error("Connector is no longer available.");
    const tokens = await exchangeOAuthCode(connector, code, String(pending.code_verifier), String(pending.redirect_uri));
    const account = await fetchOAuthAccount(connector, tokens);

    let toolsCount = getNativeConnectorToolCount(connector.slug);
    if (connector.mcp_endpoint) {
      toolsCount = 0;
      try {
        const session = await openMcpSession(connector.mcp_endpoint, tokens.access_token);
        toolsCount = (await session.listTools()).length;
      } catch (error: any) {
        console.warn(`[Connectors] OAuth succeeded but tool discovery failed for ${connector.slug}: ${String(error?.message || "unknown error").slice(0, 180)}`);
      }
    }

    const userId = String(pending.user_id);
    const { data: existing, error: existingError } = await db.from("connector_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("catalog_slug", connector.slug)
      .maybeSingle();
    if (existingError) throw existingError;
    const connectionId = existing?.id || randomUUID();
    const encrypted = encryptConnectorSecret(userId, connectionId, tokens);
    const row = {
      id: connectionId,
      user_id: userId,
      catalog_slug: connector.slug,
      connection_type: "oauth",
      display_name: connector.name,
      server_url: null,
      account_id: account.accountId || null,
      account_label: account.accountLabel || connector.name,
      status: "connected",
      metadata: {
        token_type: tokens.token_type || "Bearer",
        scopes: tokens.scope || null,
        expires_at: tokens.expires_at || null,
      },
      tools_count: toolsCount,
      secret_ciphertext: encrypted.ciphertext,
      secret_iv: encrypted.iv,
      secret_tag: encrypted.tag,
      key_version: encrypted.keyVersion,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    let write = existing
      ? await db.from("connector_connections").update(row).eq("id", connectionId).eq("user_id", userId)
      : await db.from("connector_connections").insert(row);
    if (write.error && !existing) {
      // If two OAuth callbacks race, recover by updating the winner's row and re-encrypting with its AAD.
      const { data: winner } = await db.from("connector_connections").select("id").eq("user_id", userId).eq("catalog_slug", connector.slug).maybeSingle();
      if (winner?.id) {
        const winnerEncrypted = encryptConnectorSecret(userId, winner.id, tokens);
        write = await db.from("connector_connections").update({
          ...row,
          id: winner.id,
          secret_ciphertext: winnerEncrypted.ciphertext,
          secret_iv: winnerEncrypted.iv,
          secret_tag: winnerEncrypted.tag,
          key_version: winnerEncrypted.keyVersion,
        }).eq("id", winner.id).eq("user_id", userId);
      }
    }
    if (write.error) throw write.error;
    res.redirect(303, `${appOrigin}/?connector_oauth=success`);
  } catch (error: any) {
    console.warn(`[Connectors] OAuth callback failed: ${String(error?.message || "unknown error").slice(0, 240)}`);
    if (callbackOrigin) {
      res.redirect(303, `${callbackOrigin}/?connector_oauth=error`);
      return;
    }
    await callbackErrorRedirect(state, res, "Connector authorization failed. Return to the app and try again.");
  }
}

oauthCallbackRouter.get("/", handleOAuthCallback);

export { oauthCallbackRouter };

export default oauthCallbackRouter;
