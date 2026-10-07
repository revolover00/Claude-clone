import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import IconButton from "../shared/IconButton";
import UserMenu from "../modals/UserMenu";

export default function UserRow() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="relative -mx-3 flex h-16 shrink-0 items-center justify-between border-t border-line-soft px-3 font-sans">
      <button
        type="button"
        onClick={() => setUserMenuOpen((v) => !v)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pe-1 text-start transition-colors duration-150 hover:bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-elev-3 text-[11px] font-semibold text-ink-soft">
          N
        </span>
        <span className="truncate text-[13px] font-medium text-ink">
          Nolen
        </span>
        <span className="shrink-0 text-[12px] text-ink-muted">· Free</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className="shrink-0 text-ink-muted ms-auto"
        />
      </button>

      <IconButton
        label="Download apps"
        onClick={() =>
          window.open("https://claude.ai/download", "_blank", "noopener,noreferrer")
        }
      >
        <Download size={16} strokeWidth={1.9} />
      </IconButton>

      {/* User Menu Popup */}
      <UserMenu
        isOpen={userMenuOpen}
        onClose={() => setUserMenuOpen(false)}
      />
    </div>
  );
}
