import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient";
import { useToast } from "../../context/ToastContext";
import { Sparkles, Mail, Lock, LogIn, UserPlus, KeyRound } from "lucide-react";

export default function LoginView({ from = "/" }: { from?: string }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [mode, setFormMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showToast("Email address is required", "error");
      return;
    }
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast("Signed in successfully", "success");
        navigate(from);
      } else if (mode === "signup") {
        if (!password || password.length < 6) {
          showToast("Password must be at least 6 characters", "error");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: fullName || undefined },
          },
        });
        if (error) throw error;
        showToast("Registration successful! Please check your email to verify.", "success");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (error) throw error;
        showToast("Password reset link sent to your email", "success");
      }
    } catch (err: any) {
      showToast(err.message || "Authentication failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      showToast(err.message || "Google Authentication failed", "error");
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-shell p-4 text-ink font-sans select-none">
      <div className="w-full max-w-[420px] rounded-2xl border border-line bg-elev-1 p-8 shadow-2xl anim-rise relative overflow-hidden">
        {/* Top visual accents */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-accent/40 via-accent to-accent/40" />

        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-sm mb-4">
            <Sparkles size={24} className="anim-thinking-spark text-accent" />
          </div>
          <h1 className="font-serif text-[28px] font-semibold text-ink leading-tight tracking-wide">
            {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
          </h1>
          <p className="text-xs text-ink-muted mt-2">
            {mode === "login" ? "Access your personal workspace and secure chats" : mode === "signup" ? "Get started in seconds" : "Enter your email for a recovery link"}
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === "signup" && (
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
                <UserPlus size={16} />
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name (optional)"
                className="w-full rounded-xl border border-line bg-shell py-3 pl-11 pr-4 text-[14px] text-ink placeholder:text-ink-faint focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>
          )}

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
              <Mail size={16} />
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-xl border border-line bg-shell py-3 pl-11 pr-4 text-[14px] text-ink placeholder:text-ink-faint focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>

          {mode !== "reset" && (
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-line bg-shell py-3 pl-11 pr-4 text-[14px] text-ink placeholder:text-ink-faint focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-white text-[14.5px] font-semibold transition-all hover:bg-accent/90 disabled:opacity-50 cursor-pointer shadow-md select-none mt-2 active:scale-98"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                {mode === "login" && <LogIn size={16} />}
                {mode === "signup" && <UserPlus size={16} />}
                {mode === "reset" && <KeyRound size={16} />}
                <span>
                  {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send recovery link"}
                </span>
              </>
            )}
          </button>
        </form>

        <div className="relative flex items-center justify-center my-6">
          <div className="w-full border-t border-line" />
          <span className="absolute bg-elev-1 px-3 text-[11px] text-ink-muted uppercase tracking-wider font-mono">
            or continue with
          </span>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex h-11 items-center justify-center gap-2.5 rounded-xl border border-line bg-shell hover:bg-elev-2 text-[14px] text-ink font-semibold transition-colors cursor-pointer select-none active:scale-98"
        >
          <svg className="h-[17px] w-[17px]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="flex flex-col gap-2.5 items-center mt-6 text-[12.5px] text-ink-muted">
          {mode === "login" && (
            <>
              <button
                type="button"
                onClick={() => setFormMode("signup")}
                className="hover:text-ink text-accent hover:underline font-semibold cursor-pointer"
              >
                Don't have an account? Sign up
              </button>
              <button
                type="button"
                onClick={() => setFormMode("reset")}
                className="hover:text-ink underline underline-offset-2 cursor-pointer font-medium"
              >
                Forgot your password?
              </button>
            </>
          )}

          {mode === "signup" && (
            <button
              type="button"
              onClick={() => setFormMode("login")}
              className="hover:text-ink text-accent hover:underline font-semibold cursor-pointer"
            >
              Already have an account? Sign in
            </button>
          )}

          {mode === "reset" && (
            <button
              type="button"
              onClick={() => setFormMode("login")}
              className="hover:text-ink text-accent hover:underline font-semibold cursor-pointer"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
