-- Migration: bundled model catalog columns, metadata and auto-seeded models
--
-- The app ships a complete bundled catalog (see src/shared/catalog). These columns
-- let the data-driven `models` table hold the full catalog detail for each row, so
-- the Models settings tab can show context windows, pricing, modalities and dates
-- without any manual entry.

ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS family text,
  ADD COLUMN IF NOT EXISTS context_length integer,
  ADD COLUMN IF NOT EXISTS input_modalities text[],
  ADD COLUMN IF NOT EXISTS output_modalities text[],
  ADD COLUMN IF NOT EXISTS supports_tools boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_structured_output boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing jsonb,
  ADD COLUMN IF NOT EXISTS release_date date,
  ADD COLUMN IF NOT EXISTS knowledge_cutoff text,
  ADD COLUMN IF NOT EXISTS catalog_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS models_catalog_source_idx ON public.models (catalog_source);
CREATE INDEX IF NOT EXISTS models_provider_idx ON public.models (provider);

-- Metadata about the bundled snapshot the rows were imported from.
CREATE TABLE IF NOT EXISTS public.model_catalog_meta (
  id text PRIMARY KEY DEFAULT 'bundled',
  snapshot_date date,
  source text,
  total_models integer,
  provider_counts jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.model_catalog_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated to read catalog metadata" ON public.model_catalog_meta;
CREATE POLICY "Allow authenticated to read catalog metadata"
  ON public.model_catalog_meta
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow admins to manage catalog metadata" ON public.model_catalog_meta;
CREATE POLICY "Allow admins to manage catalog metadata"
  ON public.model_catalog_meta
  FOR ALL
  USING (public.is_admin());
