-- Create profiles table
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name text,
  avatar_url text,
  locale text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  description text,
  instructions text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create project_knowledge table
CREATE TABLE public.project_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create conversations table
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  starred boolean DEFAULT false,
  model_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  archived boolean DEFAULT false
);

-- Create messages table (supports branching via parent_id)
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  parent_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  role text NOT NULL,
  content text NOT NULL,
  thinking text,
  thinking_ms integer,
  finish_reason text,
  model_id text,
  attachments jsonb DEFAULT '[]'::jsonb,
  feedback jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Create artifacts table
CREATE TABLE public.artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title text NOT NULL,
  type text NOT NULL,
  content text NOT NULL,
  version integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now()
);

-- Create user_preferences table
CREATE TABLE public.user_preferences (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  response_style text DEFAULT 'Normal',
  profile_instructions text DEFAULT '',
  settings jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Allow users to read all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow users to update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow users to insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects Policies
CREATE POLICY "Allow owners full projects access" ON public.projects USING (auth.uid() = user_id);

-- Project Knowledge Policies
CREATE POLICY "Allow owners full knowledge access" ON public.project_knowledge USING (auth.uid() = user_id);

-- Conversations Policies
CREATE POLICY "Allow owners full conversations access" ON public.conversations USING (auth.uid() = user_id);

-- Messages Policies
CREATE POLICY "Allow owners full messages access" ON public.messages USING (auth.uid() = user_id);

-- Artifacts Policies
CREATE POLICY "Allow owners full artifacts access" ON public.artifacts USING (auth.uid() = user_id);

-- User Preferences Policies
CREATE POLICY "Allow owners full preferences access" ON public.user_preferences USING (auth.uid() = user_id);

-- Create performance and search indexes
CREATE INDEX idx_conversations_user_updated ON public.conversations (user_id, updated_at DESC);
CREATE INDEX idx_messages_conv_created ON public.messages (conversation_id, created_at ASC);
CREATE INDEX idx_messages_content_fts ON public.messages USING gin(to_tsvector('english', content));

-- Automated profile and preference initialization trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_preferences (user_id, response_style, profile_instructions)
  VALUES (new.id, 'Normal', '');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
