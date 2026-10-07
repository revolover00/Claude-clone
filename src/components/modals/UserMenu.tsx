import { useEffect, useRef } from "react";
import {
  Settings,
  Globe,
  HelpCircle,
  Sparkles,
  LogOut,
} from "lucide-react";
import { useChat } from "../../context/ChatContext";
import { useFocusTrap } from "../../utils/useFocusTrap";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function UserMenu({ isOpen, onClose }: Props) {
  const { setSettingsModalOpen, preferences, updatePreferences } = useChat();
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
      {/* User email badge */}
      <div className="border-b border-line px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Signed in as
        </p>
        <p className="truncate text-[13px] font-medium text-ink">
          francesco.store.ss@gmail.com
        </p>
      </div>

      <div className="py-1 space-y-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            setSettingsModalOpen(true);
          }}
          className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
        >
          <Settings size={16} className="text-ink-muted" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const nextLang = preferences.language === "en" ? "ar" : "en";
            updatePreferences({ language: nextLang });
            onClose();
          }}
          className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-[13.5px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
        >
          <div className="flex items-center gap-2.5">
            <Globe size={16} className="text-ink-muted" />
            <span>Language</span>
          </div>
          <span className="text-[12px] text-ink-muted">
            {preferences.language === "ar" ? "العربية" : "English"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            alert("Claude UI Clone • Version 2.0 • Press ⌘K to search, ⌘⇧O for new chat.");
          }}
          className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
        >
          <HelpCircle size={16} className="text-ink-muted" />
          <span>Get help</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            alert("Upgrade to Claude Pro: 5x more usage, Sonnet priority access, and projects integration.");
          }}
          className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-[13.5px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-accent" />
            <span>Upgrade plan</span>
          </div>
          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">
            Pro
          </span>
        </button>
      </div>

      <div className="border-t border-line pt-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            // harmless mock logout feedback
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
