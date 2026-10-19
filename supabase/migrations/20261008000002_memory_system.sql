-- Migration: Memory system implementation with pgvector

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create memories table
CREATE TABLE public.memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  content text NOT NULL,
  category text NOT NULL CHECK (category IN ('profile','preferences','work','projects','people','other')),
  source_conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  pinned boolean DEFAULT false,
  status text NOT NULL CHECK (status IN ('active','archived')) DEFAULT 'active',
  embedding vector(768),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- RLS policies for memories
CREATE POLICY "Allow users full access to own memories" 
  ON public.memories 
  USING (auth.uid() = user_id);

-- Add memory_enabled and sensitive_memory to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS memory_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sensitive_memory boolean DEFAULT false;
