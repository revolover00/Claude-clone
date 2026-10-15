import { createClient } from "@supabase/supabase-js";
import { mockSupabase } from "./supabaseMock";

const env = (import.meta as any)?.env || (typeof process !== "undefined" ? process.env : {}) || {};
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";

export const isRealSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes("YOUR_") && 
  !supabaseAnonKey.includes("YOUR_")
);

export const supabase = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (mockSupabase as any);
