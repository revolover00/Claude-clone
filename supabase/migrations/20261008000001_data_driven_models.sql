-- Migration: Data-driven models and app admins tables

-- Create models table
CREATE TABLE public.models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  provider text DEFAULT 'google',
  api_model_id text NOT NULL,
  kind text CHECK (kind IN ('chat','light','embedding')) NOT NULL,
  supports_thinking boolean DEFAULT false,
  supports_search boolean DEFAULT false,
  supports_vision boolean DEFAULT false,
  max_output_tokens integer,
  enabled boolean DEFAULT true,
  is_default boolean DEFAULT false,
  sort_order integer DEFAULT 0
);

-- Create app_admins table
CREATE TABLE public.app_admins (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY
);

-- Enable RLS
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for models
CREATE POLICY "Allow authenticated to read enabled models"
  ON public.models
  FOR SELECT
  USING (auth.role() = 'authenticated' AND (enabled = true OR public.is_admin()));

CREATE POLICY "Allow admins full access to models"
  ON public.models
  FOR ALL
  USING (public.is_admin());

-- RLS Policies for app_admins
CREATE POLICY "Allow authenticated to read admins"
  ON public.app_admins
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admins to manage admins"
  ON public.app_admins
  FOR ALL
  USING (public.is_admin());

-- Seed default models
INSERT INTO public.models (slug, display_name, description, api_model_id, kind, supports_thinking, supports_search, supports_vision, is_default, sort_order)
VALUES
  ('sonnet-5', 'Sonnet 5', 'Fast and highly balanced intelligence, ideal for general chat and multimodal tasks.', 'gemini-3.8-flash', 'chat', false, true, true, true, 1),
  ('opus-5', 'Opus 5', 'State-of-the-art capability for complex tasks and deep reasoning.', 'gemini-3.1-pro-preview', 'chat', true, true, true, false, 2),
  ('haiku-4-5', 'Haiku 4.5', 'Incredible speed and low latency for quick conversations and summaries.', 'gemini-3.1-flash-lite', 'chat', false, false, true, false, 3),
  ('gemini-light', 'Gemini Light', 'Internal model optimized for automated metadata, tags, and suggestions.', 'gemini-3.1-flash-lite', 'light', false, false, false, false, 4),
  ('gemini-embedding', 'Gemini Embedding', 'High-performance text embeddings for semantic search and knowledge.', 'text-embedding-004', 'embedding', false, false, false, false, 5)
ON CONFLICT (slug) DO NOTHING;
