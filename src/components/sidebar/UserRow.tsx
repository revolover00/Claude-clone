import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import UserMenu from "../modals/UserMenu";
import { useChat } from "../../context/ChatContext";

export default function UserRow() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { preferences } = useChat();
  const displayName = preferences.userName?.trim() || "You";
  const initial = displayName.charAt(0).toUpperCase() || "Y";

  return (
    <div className="relative -mx-3 flex h-16 shrink-0 items-center justify-between border-t border-line-soft px-3 font-sans">
      <button
        type="button"
        onClick={() => setUserMenuOpen((v) => !v)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pe-1 text-start transition-colors duration-150 hover:bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-elev-3 text-[11px] font-semibold text-ink-soft">
          {initial}
        </span>
        <span className="truncate text-[13px] font-medium text-ink">
          {displayName}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className="shrink-0 text-ink-muted ms-auto"
        />
      </button>

      <a
        href="https://claude.ai/download"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download apps"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <Download size={16} strokeWidth={1.9} />
      </a>

      {/* User Menu Popup */}
      <UserMenu
        isOpen={userMenuOpen}
        onClose={() => setUserMenuOpen(false)}
      />
    </div>
  );
}
