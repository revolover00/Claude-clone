import { useEffect, useRef } from "react";
import {
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useFocusTrap } from "../../utils/useFocusTrap";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function UserMenu({ isOpen, onClose }: Props) {
  const { user, profile, signOut } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  useFocusTrap(menuRef, isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      role="dialog"
      aria-modal="true"
      aria-label="Account menu"
      className="anim-popover-in absolute bottom-16 left-3 z-50 w-64 origin-bottom-left rounded-xl border border-line bg-elev-1 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)] font-sans"
    >
      {/* User info badge */}
      <div className="border-b border-line px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Signed in as
        </p>
        <p className="truncate text-[13px] font-medium text-ink">
          {profile?.display_name || user?.email || "Guest"}
        </p>
      </div>

      <div className="py-1 space-y-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            // TODO: Open settings
          }}
          className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink cursor-pointer"
        >
          <Settings size={16} className="text-ink-muted" />
          <span>Settings</span>
        </button>
      </div>

      <div className="border-t border-line pt-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            signOut();
          }}
          className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
        >
          <LogOut size={16} className="text-ink-muted" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
