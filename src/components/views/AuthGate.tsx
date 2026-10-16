import { lazy, Suspense, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { SESSION_EXPIRED_MESSAGE } from "../../utils/authErrors";

const LoginView = lazy(() => import("./LoginView"));

/**
 * Renders the app only while there is a live session with a user. Anything
 * else (no session, a session without a user, an expired session) shows the
 * login screen, with a banner when the session expired, and returns the user
 * to the page they were on after signing in again.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session, user, sessionExpired, returnTo, dismissSessionExpired } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-shell" aria-busy="true">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
      </div>
    );
  }

  if (!session?.access_token || !user) {
    const from = returnTo || `${location.pathname}${location.search}${location.hash}`;
    return (
      <Suspense fallback={null}>
        <LoginView
          from={from}
          notice={sessionExpired ? SESSION_EXPIRED_MESSAGE : null}
          onDismissNotice={dismissSessionExpired}
        />
      </Suspense>
    );
  }

  return <>{children}</>;
}
