import { createClient } from "@supabase/supabase-js";
import { mockSupabase } from "./supabaseMock";
import { authStorage } from "./authStorage";
import { isDevGuestEnabled } from "./devGuestMode";

const env = (import.meta as any)?.env || (typeof process !== "undefined" ? process.env : {}) || {};
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";

export const isRealSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes("YOUR_") && 
  !supabaseAnonKey.includes("YOUR_")
);

const useExplicitDevGuestMode = isDevGuestEnabled(env);
export const supabase = isRealSupabaseConfigured && !useExplicitDevGuestMode
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: authStorage,
      },
    })
  : (mockSupabase as any);
