-- Data-driven connector directory, encrypted per-user connections, and one-time OAuth state.
-- Provider secrets and user access/refresh tokens are never stored as plaintext.

CREATE TABLE IF NOT EXISTS public.connector_catalog (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 600),
  category text NOT NULL DEFAULT 'productivity' CHECK (char_length(category) BETWEEN 1 AND 40),
  icon text NOT NULL DEFAULT 'plug',
  accent_color text NOT NULL DEFAULT '#6B7280' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  website_url text,
  auth_type text NOT NULL DEFAULT 'oauth' CHECK (auth_type IN ('oauth', 'mcp')),
  oauth_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  mcp_endpoint text,
  enabled boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connector_catalog_oauth_config_object CHECK (jsonb_typeof(oauth_config) = 'object')
);

CREATE INDEX IF NOT EXISTS connector_catalog_enabled_order_idx
  ON public.connector_catalog (enabled, sort_order, name);

CREATE TABLE IF NOT EXISTS public.connector_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_slug text REFERENCES public.connector_catalog(slug) ON DELETE CASCADE,
  connection_type text NOT NULL CHECK (connection_type IN ('oauth', 'mcp')),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 100),
  server_url text,
  account_id text,
  account_label text,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error', 'needs_reauth')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  tools_count integer NOT NULL DEFAULT 0 CHECK (tools_count >= 0 AND tools_count <= 500),
  secret_ciphertext text,
  secret_iv text,
  secret_tag text,
  key_version integer,
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connector_connection_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT connector_connection_secrets_complete CHECK (
    (secret_ciphertext IS NULL AND secret_iv IS NULL AND secret_tag IS NULL AND key_version IS NULL)
    OR
    (secret_ciphertext IS NOT NULL AND secret_iv IS NOT NULL AND secret_tag IS NOT NULL AND key_version IS NOT NULL)
  ),
  CONSTRAINT connector_connection_catalog_or_server CHECK (
    (catalog_slug IS NOT NULL AND connection_type = 'oauth')
    OR
    (catalog_slug IS NULL AND connection_type = 'mcp' AND server_url IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS connector_connections_user_catalog_idx
  ON public.connector_connections (user_id, catalog_slug)
  WHERE catalog_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS connector_connections_user_created_idx
  ON public.connector_connections (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.connector_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_slug text NOT NULL REFERENCES public.connector_catalog(slug) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  app_origin text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS connector_oauth_states_expiry_idx
  ON public.connector_oauth_states (expires_at);

ALTER TABLE public.connector_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connector_catalog_read_enabled ON public.connector_catalog;
CREATE POLICY connector_catalog_read_enabled ON public.connector_catalog
  FOR SELECT TO authenticated
  USING (enabled OR private.is_admin());
DROP POLICY IF EXISTS connector_catalog_admin_write ON public.connector_catalog;
CREATE POLICY connector_catalog_admin_write ON public.connector_catalog
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS connector_connections_own_rows ON public.connector_connections;
CREATE POLICY connector_connections_own_rows ON public.connector_connections
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Sensitive connection credentials and OAuth state are accessed only by the app server's
-- service-role client, which separately verifies the authenticated user on each request.
REVOKE ALL ON public.connector_catalog FROM anon;
REVOKE ALL ON public.connector_connections FROM anon, authenticated;
REVOKE ALL ON public.connector_oauth_states FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connector_catalog TO service_role;
GRANT ALL ON public.connector_connections TO service_role;
GRANT ALL ON public.connector_oauth_states TO service_role;
GRANT SELECT ON public.connector_catalog TO authenticated;

INSERT INTO public.connector_catalog
  (slug, name, description, category, icon, accent_color, website_url, auth_type, oauth_config, mcp_endpoint, enabled, featured, sort_order)
VALUES
  (
    'github',
    'GitHub',
    'Search repositories, inspect code, and work with issues and pull requests through a connected GitHub MCP server.',
    'development',
    'github',
    '#24292F',
    'https://github.com',
    'oauth',
    '{"authorization_url":"https://github.com/login/oauth/authorize","token_url":"https://github.com/login/oauth/access_token","client_id_env":"CONNECTOR_OAUTH_GITHUB_CLIENT_ID","client_secret_env":"CONNECTOR_OAUTH_GITHUB_CLIENT_SECRET","scopes":["read:user","user:email","repo"],"token_auth_method":"client_secret_post","token_body_format":"form","profile_url":"https://api.github.com/user","profile_name_path":"login","profile_id_path":"id","profile_headers":{"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}}'::jsonb,
    'https://api.githubcopilot.com/mcp/',
    true,
    true,
    10
  ),
  (
    'notion',
    'Notion',
    'Bring your Notion workspace into the conversation with an authorized connection and a compatible MCP endpoint.',
    'productivity',
    'notion',
    '#111111',
    'https://www.notion.so',
    'oauth',
    '{"authorization_url":"https://api.notion.com/v1/oauth/authorize","token_url":"https://api.notion.com/v1/oauth/token","client_id_env":"CONNECTOR_OAUTH_NOTION_CLIENT_ID","client_secret_env":"CONNECTOR_OAUTH_NOTION_CLIENT_SECRET","scopes":[],"token_auth_method":"client_secret_basic","token_body_format":"json","authorize_params":{"owner":"user"},"account_name_path":"workspace_name","account_id_path":"workspace_id"}'::jsonb,
    'https://mcp.notion.com/mcp',
    true,
    true,
    20
  ),
  (
    'linear',
    'Linear',
    'Connect your Linear workspace to search and manage issues using a compatible MCP server.',
    'project-management',
    'linear',
    '#5E6AD2',
    'https://linear.app',
    'oauth',
    '{"authorization_url":"https://linear.app/oauth/authorize","token_url":"https://api.linear.app/oauth/token","client_id_env":"CONNECTOR_OAUTH_LINEAR_CLIENT_ID","client_secret_env":"CONNECTOR_OAUTH_LINEAR_CLIENT_SECRET","scopes":["read","issues:create"],"token_auth_method":"client_secret_post","token_body_format":"form","account_name_path":"app_name"}'::jsonb,
    'https://mcp.linear.app/mcp',
    true,
    true,
    30
  ),
  (
    'google-drive',
    'Google Drive',
    'Find and reference files from Google Drive after authorizing access to your account.',
    'productivity',
    'google-drive',
    '#0F9D58',
    'https://drive.google.com',
    'oauth',
    '{"authorization_url":"https://accounts.google.com/o/oauth2/v2/auth","token_url":"https://oauth2.googleapis.com/token","client_id_env":"CONNECTOR_OAUTH_GOOGLE_DRIVE_CLIENT_ID","client_secret_env":"CONNECTOR_OAUTH_GOOGLE_DRIVE_CLIENT_SECRET","scopes":["openid","email","profile","https://www.googleapis.com/auth/drive.readonly"],"token_auth_method":"client_secret_post","token_body_format":"form","authorize_params":{"access_type":"offline","prompt":"consent"},"profile_url":"https://openidconnect.googleapis.com/v1/userinfo","profile_name_path":"name","profile_id_path":"sub"}'::jsonb,
    null,
    true,
    false,
    40
  ),
  (
    'slack',
    'Slack',
    'Connect a Slack workspace to make its information available to compatible connector tools.',
    'communication',
    'slack',
    '#611F69',
    'https://slack.com',
    'oauth',
    '{"authorization_url":"https://slack.com/oauth/v2/authorize","token_url":"https://slack.com/api/oauth.v2.access","client_id_env":"CONNECTOR_OAUTH_SLACK_CLIENT_ID","client_secret_env":"CONNECTOR_OAUTH_SLACK_CLIENT_SECRET","scopes":["search:read","channels:read","channels:history","users:read"],"token_auth_method":"client_secret_post","token_body_format":"form","account_name_path":"team.name","account_id_path":"team.id"}'::jsonb,
    null,
    true,
    false,
    50
  )
ON CONFLICT (slug) DO NOTHING;
