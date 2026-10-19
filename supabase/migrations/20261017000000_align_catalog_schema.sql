-- provider_catalog: column names and enums used by the app code

ALTER TABLE public.provider_catalog RENAME COLUMN display_name TO name;

ALTER TABLE public.provider_catalog ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

ALTER TABLE public.provider_catalog DROP CONSTRAINT IF EXISTS provider_catalog_kind_check;

ALTER TABLE public.provider_catalog DROP CONSTRAINT IF EXISTS provider_catalog_source_check;

ALTER TABLE public.provider_catalog
  ADD CONSTRAINT provider_catalog_kind_check CHECK (kind IN ('chat','embedding','image','audio','video','rerank','moderation','other')),
  ADD CONSTRAINT provider_catalog_source_check CHECK (source IN ('public','user-key','bundled','fallback','catalog','app-key'));

-- catalog_sync_runs

ALTER TABLE public.catalog_sync_runs RENAME COLUMN source TO "trigger";

ALTER TABLE public.catalog_sync_runs ALTER COLUMN "trigger" SET DEFAULT 'manual';

ALTER TABLE public.catalog_sync_runs DROP CONSTRAINT IF EXISTS catalog_sync_runs_status_check;

ALTER TABLE public.catalog_sync_runs
  ADD CONSTRAINT catalog_sync_runs_status_check CHECK (status IN ('running','ok','error','success','partial','failed'));

-- app_settings

CREATE TABLE public.app_settings (
  key text PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 100),
  value jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_app_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_app_settings_updated_at();

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_settings_select_authenticated
  ON public.app_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY app_settings_insert_admin
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY app_settings_update_admin
  ON public.app_settings FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY app_settings_delete_admin
  ON public.app_settings FOR DELETE TO authenticated
  USING (private.is_admin());
