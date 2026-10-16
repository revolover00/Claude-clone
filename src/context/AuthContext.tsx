import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../utils/supabaseClient";
import { importLocalChatsToSupabase } from "../utils/supabaseImport";
import { normalizeSlug } from "../hooks/useModels";
import { SESSION_EXPIRED_EVENT, type SessionExpiredDetail } from "../utils/authErrors";
import {
  clearLegacyTokenCopy,
  clearReturnPath,
  readReturnPath,
  rememberReturnPath,
} from "./authReturnPath";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: any;
  preferences: any;
  /** The session ended unexpectedly; the login screen shows a banner. */
  sessionExpired: boolean;
  /** Page to return to once the user signs in again. */
  returnTo: string | null;
  signOut: () => Promise<void>;
  expireSession: (code?: string) => void;
  dismissSessionExpired: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function normalizePreferences(prefs: any) {
  if (prefs?.settings?.model) prefs.settings.model = normalizeSlug(prefs.settings.model);
  if (prefs?.settings?.model_id) prefs.settings.model_id = normalizeSlug(prefs.settings.model_id);
  return prefs;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(readReturnPath);

  // Refs let the long-lived auth listeners see the latest values.
  const sessionRef = useRef<Session | null>(null);
  const userSignOutRef = useRef(false);
  const expiringRef = useRef(false);
  const returnToRef = useRef<string | null>(returnTo);
  const pathRef = useRef(`${location.pathname}${location.search}${location.hash}`);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    pathRef.current = `${location.pathname}${location.search}${location.hash}`;
    navigateRef.current = navigate;
  });

  const applySession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSessionState(next);
    if (!next) {
      setProfile(null);
      setPreferences(null);
    }
  }, []);

  const fetchUserData = useCallback(async (uId: string) => {
    try {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", uId).single();
      setProfile(prof);
      const { data: prefs } = await supabase.from("user_preferences").select("*").eq("user_id", uId).single();
      setPreferences(normalizePreferences(prefs));
    } catch (err) {
      console.error("Error loading user details:", err);
    }
  }, []);

  /** After signing in again: drop the banner and go back to the remembered page. */
  const finishReauthentication = useCallback(() => {
    const target = returnToRef.current;
    returnToRef.current = null;
    clearReturnPath();
    setReturnTo(null);
    setSessionExpired(false);
    if (target && target !== pathRef.current) navigateRef.current(target, { replace: true });
  }, []);

  /**
   * The session can no longer be used (refresh failed, server keeps rejecting
   * it, or the user chose "Sign in again"). Sign out locally, remember the page
   * and show the login screen with a banner. Idempotent.
   */
  const expireSession = useCallback((code?: string) => {
    if (expiringRef.current || !sessionRef.current) return;
    expiringRef.current = true;
    const path = pathRef.current;
    returnToRef.current = path;
    rememberReturnPath(path);
    setReturnTo(path);
    setSessionExpired(true);
    applySession(null);
    console.warn(`[auth] Session ended (${code || "unknown"}); signing out locally.`);
    // Deferred out of any auth callback (supabase-js guidance). "local" scope: an
    // expired session must not sign the user out of their other devices.
    setTimeout(() => {
      Promise.resolve()
        .then(() => supabase.auth.signOut({ scope: "local" }))
        .catch(() => undefined)
        .finally(() => {
          expiringRef.current = false;
        });
    }, 0);
  }, [applySession]);

  useEffect(() => {
    let active = true;
    clearLegacyTokenCopy();

    Promise.resolve()
      .then(() => supabase.auth.getSession())
      .then(({ data }: any) => {
        if (!active) return;
        const initial: Session | null = data?.session?.access_token ? data.session : null;
        applySession(initial);
        if (initial?.user) {
          fetchUserData(initial.user.id);
          importLocalChatsToSupabase(initial.user.id);
        }
      })
      .catch(() => {
        if (active) applySession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Kept synchronous: Supabase calls are deferred out of the auth callback.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, next: Session | null) => {
      if (event === "TOKEN_REFRESHED" && !next?.access_token) {
        expireSession("TOKEN_REFRESH_FAILED");
      } else if (!next?.access_token) {
        // supabase-js reports a failed background refresh as an unexpected SIGNED_OUT
        // (the refresh token was rejected and the stored session removed).
        const unexpected = event === "SIGNED_OUT" && sessionRef.current && !userSignOutRef.current;
        if (unexpected) expireSession("SIGNED_OUT_UNEXPECTEDLY");
        else if (!expiringRef.current) applySession(null);
      } else {
        applySession(next);
        if (event === "SIGNED_IN") finishReauthentication();
        if ((event === "SIGNED_IN" || event === "USER_UPDATED") && next.user) {
          const uid = next.user.id;
          setTimeout(() => {
            fetchUserData(uid);
            if (event === "SIGNED_IN") importLocalChatsToSupabase(uid);
          }, 0);
        }
      }
      setLoading(false);
    });

    const onSessionExpired = (e: Event) => {
      expireSession((e as CustomEvent<SessionExpiredDetail>).detail?.code);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    };
  }, [applySession, expireSession, fetchUserData, finishReauthentication]);

  const refreshProfile = useCallback(async () => {
    const uid = sessionRef.current?.user?.id;
    if (uid) await fetchUserData(uid);
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
    userSignOutRef.current = true;
    returnToRef.current = null;
    clearReturnPath();
    setReturnTo(null);
    setSessionExpired(false);
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign-out request failed; clearing the local session anyway.", err);
    } finally {
      userSignOutRef.current = false;
      applySession(null);
      setLoading(false);
    }
  }, [applySession]);

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        profile,
        preferences,
        sessionExpired,
        returnTo,
        signOut,
        expireSession,
        dismissSessionExpired,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
