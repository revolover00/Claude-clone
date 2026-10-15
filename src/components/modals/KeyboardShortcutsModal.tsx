import React, { useState, useEffect, useRef } from "react";
import { X, Command } from "lucide-react";
import { useFocusTrap } from "../../utils/useFocusTrap";

interface ShortcutItem {
  description: string;
  keys: string[];
}

const SHORTCUTS: ShortcutItem[] = [
  { description: "Open Settings", keys: ["⌘ / Ctrl", ","] },
  { description: "Search chats", keys: ["⌘ / Ctrl", "K"] },
  { description: "New chat", keys: ["⌘ / Ctrl", "Shift", "O"] },
  { description: "Close modal / panel", keys: ["Esc"] },
  { description: "Send message", keys: ["Enter"] },
  { description: "New line in composer", keys: ["Shift", "Enter"] },
  { description: "Keyboard shortcuts", keys: ["?"] },
];

export const KeyboardShortcutsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, isOpen, () => setIsOpen(false));

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-shortcuts-dialog", handleOpen);
    return () => window.removeEventListener("open-shortcuts-dialog", handleOpen);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm font-sans"
      onClick={() => setIsOpen(false)}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        className="anim-modal-in flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-line bg-elev-1 shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Command size={16} className="text-accent" />
            <h2 className="text-[14.5px] font-semibold text-ink">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close shortcuts"
            className="rounded p-1 text-ink-muted hover:text-ink cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="divide-y divide-line/60 p-4 max-h-[380px] overflow-y-auto">
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="flex items-center justify-between py-2 text-[13px]">
              <span className="text-ink-soft">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-line bg-elev-2 px-1.5 py-0.5 text-[11px] font-mono text-ink shadow-xs"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
