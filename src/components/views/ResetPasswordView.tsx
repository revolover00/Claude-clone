import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient";
import { useToast } from "../../context/ToastContext";
import { KeyRound, Lock, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setIsValid(!!session);
    });
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }
    if (password.length < 8) {
      showToast("Password must be at least 8 characters", "error");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut({ scope: "others" });
      showToast("Password updated successfully", "success");
      navigate("/");
    } catch (err: any) {
      showToast(err.message || "Failed to update password", "error");
    } finally {
      setLoading(false);
    }
  };

  if (isValid === false) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-shell p-4 text-center">
        <div className="w-full max-w-[420px] rounded-2xl border border-line bg-elev-1 p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-ink">Link invalid or expired</h2>
          <p className="text-ink-muted mt-2 mb-6">The password reset link is invalid or has expired.</p>
          <button
            onClick={() => navigate("/login")}
            className="w-full h-11 rounded-xl bg-accent text-white font-semibold cursor-pointer"
          >
            Request a new link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-shell p-4 font-sans">
      <div className="w-full max-w-[420px] rounded-2xl border border-line bg-elev-1 p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-sm mb-4">
            <KeyRound size={24} />
          </div>
          <h1 className="font-serif text-[28px] font-semibold text-ink">Set new password</h1>
          <p className="text-xs text-ink-muted mt-2">Enter your new secure password</p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
              <Lock size={16} />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-xl border border-line bg-shell py-3 pl-11 pr-10 text-[14px] text-ink"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
              <Lock size={16} />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-xl border border-line bg-shell py-3 pl-11 pr-4 text-[14px] text-ink"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-accent text-white font-semibold mt-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
