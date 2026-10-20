-- Slack's search/history APIs use a user token; keep its requested permissions user-scoped.
UPDATE public.connector_catalog
SET oauth_config = oauth_config || jsonb_build_object(
  'scopes', '[]'::jsonb,
  'user_scopes', jsonb_build_array('search:read', 'channels:read', 'channels:history')
),
description = 'Search Slack messages and browse public channel history.',
updated_at = now()
WHERE slug = 'slack';

UPDATE public.connector_catalog
SET description = 'Search Drive files and read supported documents.',
    updated_at = now()
WHERE slug = 'google-drive';

-- Existing Slack connections may only have the old app/bot token scopes.
UPDATE public.connector_connections
SET status = 'needs_reauth', updated_at = now()
WHERE catalog_slug = 'slack' AND status = 'connected';
