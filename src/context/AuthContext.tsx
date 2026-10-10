import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { importLocalChatsToSupabase } from "../utils/supabaseImport";
import { normalizeSlug } from "../hooks/useModels";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: any;
  preferences: any;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>(null);

  const fetchUserData = async (uId: string) => {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uId)
        .single();
      setProfile(prof);

      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", uId)
        .single();
      if (prefs?.settings) {
        if (prefs.settings.model) {
          prefs.settings.model = normalizeSlug(prefs.settings.model);
        }
        if (prefs.settings.model_id) {
          prefs.settings.model_id = normalizeSlug(prefs.settings.model_id);
        }
      }
      setPreferences(prefs);
    } catch (err) {
      console.error("Error loading user details:", err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    // Initial fetch of active session
    supabase.auth.getSession().then(({ data: { session: s } }: any) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchUserData(s.user.id);
        // Run migration in background asynchronously
        importLocalChatsToSupabase(s.user.id);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, s: any) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === "SIGNED_IN" && s?.user) {
        await fetchUserData(s.user.id);
        // Trigger check/migration
        await importLocalChatsToSupabase(s.user.id);
      } else if (event === "PASSWORD_RECOVERY") {
        // Stay on reset screen
      } else if (s?.user) {
        await fetchUserData(s.user.id);
      } else {
        setProfile(null);
        setPreferences(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setPreferences(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, profile, preferences, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
