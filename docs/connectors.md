# Connectors

The connector directory is stored in the `public.connector_catalog` table in the Supabase project. The app does not bundle a fallback connector list: `/api/connectors` reads enabled rows from the database and returns only presentation metadata and whether the server has the required OAuth credentials configured.

## OAuth setup

1. Register an OAuth application with the service.
2. Set its callback/redirect URI to:
   `https://<your-app-origin>/api/connectors/oauth/callback`
3. Set `CONNECTORS_APP_URL` to the public HTTPS origin of the app.
4. Set the connector's client ID and client secret in the server hosting environment. Do not put client secrets in `connector_catalog`, Supabase client-side settings, or source control.

Environment variable names used by the initial catalog:

| Connector | Client ID | Client secret |
| --- | --- | --- |
| GitHub | `CONNECTOR_OAUTH_GITHUB_CLIENT_ID` | `CONNECTOR_OAUTH_GITHUB_CLIENT_SECRET` |
| Notion | `CONNECTOR_OAUTH_NOTION_CLIENT_ID` | `CONNECTOR_OAUTH_NOTION_CLIENT_SECRET` |
| Linear | `CONNECTOR_OAUTH_LINEAR_CLIENT_ID` | `CONNECTOR_OAUTH_LINEAR_CLIENT_SECRET` |
| Google Drive | `CONNECTOR_OAUTH_GOOGLE_DRIVE_CLIENT_ID` | `CONNECTOR_OAUTH_GOOGLE_DRIVE_CLIENT_SECRET` |
| Slack | `CONNECTOR_OAUTH_SLACK_CLIENT_ID` | `CONNECTOR_OAUTH_SLACK_CLIENT_SECRET` |

The server stores one-time, hashed OAuth state and PKCE data in `connector_oauth_states`. On successful authorization, access/refresh tokens are encrypted with `PROVIDER_KEY_ENCRYPTION_SECRET` before being written to `connector_connections`. The API never returns token fields. Disconnecting deletes the app's saved connection; provider-side revocation is not currently requested.

A catalog item can authenticate an account with OAuth and can optionally define `mcp_endpoint`. GitHub, Notion, and Linear use their configured remote MCP endpoints. Google Drive and Slack have native, read-only tools, so they work without an external MCP server; an administrator may set an MCP endpoint to use a compatible remote implementation instead. Drive can search files and read supported text, Google Docs, and Sheets content. Slack can search messages and list/read public channels visible to the connected user.

Slack requests user-level OAuth permissions through `user_scope` (`search:read`, `channels:read`, and `channels:history`) and stores the `authed_user` token when Slack returns one. This is needed for search and user-visible channel history; no write/post tools are exposed. Existing Slack connections are marked for reconnection when these scopes are applied, so they obtain the user token. Google Drive requests only the Drive read-only scope. Native provider requests use fixed HTTPS API hosts, reject redirects, apply a timeout and response-size limit, and return tool output as untrusted data to the model.

## Add or edit a catalog entry

Catalog rows are managed in Supabase. The `oauth_config` JSON contains public endpoint/scope configuration and the names of server environment variables; it must never contain a client secret. Example:

```sql
INSERT INTO public.connector_catalog
  (slug, name, description, category, icon, accent_color, website_url, auth_type, oauth_config, mcp_endpoint, enabled, featured, sort_order)
VALUES
  (
    'example-tool',
    'Example Tool',
    'Connect Example Tool to your workspace.',
    'productivity',
    'plug',
    '#6B7280',
    'https://example.com',
    'oauth',
    '{
      "authorization_url": "https://example.com/oauth/authorize",
      "token_url": "https://example.com/oauth/token",
      "client_id_env": "CONNECTOR_OAUTH_EXAMPLE_TOOL_CLIENT_ID",
      "client_secret_env": "CONNECTOR_OAUTH_EXAMPLE_TOOL_CLIENT_SECRET",
      "scopes": ["read"],
      "token_auth_method": "client_secret_post",
      "token_body_format": "form"
    }'::jsonb,
    'https://mcp.example.com/mcp',
    true,
    false,
    100
  );
```

`client_id_env` and `client_secret_env` names must use the `CONNECTOR_OAUTH_..._CLIENT_ID` / `..._CLIENT_SECRET` prefixes. Accepted token authentication modes are `client_secret_post` (default) and `client_secret_basic`; `token_body_format` is `form` (default) or `json`. Use `user_scopes` when a provider distinguishes user grants from application/bot scopes; it is sent as the OAuth `user_scope` parameter. Profile endpoints and account-name paths are optional. Catalog writes are limited to Supabase admins by RLS.

## Custom MCP servers

Users can add a remote MCP server from **Settings → Connectors → Add MCP server**. The app currently supports MCP Streamable HTTP endpoints, HTTPS only, an optional bearer token, tool discovery, and `tools/call`. Local/private IP addresses and redirects are blocked to reduce SSRF risk. The server response and arguments are size-capped, credentials are encrypted at rest, and tool output is treated as untrusted content in the model context.

Discovered MCP tools and the built-in Google Drive/Slack tools are passed to models whose catalog records advertise tool support. The chat tool loop is capped per response. If an MCP server is unavailable or does not speak Streamable HTTP, its tools are skipped for that request; an OAuth connection can remain connected even when its endpoint is not reachable.
