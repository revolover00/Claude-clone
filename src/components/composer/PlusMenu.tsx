import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Image as ImageIcon,
  Camera,
  FileText,
  Globe,
  Brain,
  Palette,
  ChevronRight,
  Check,
} from "lucide-react";
import IconButton from "../shared/IconButton";
import { useToast } from "../../context/ToastContext";
import { useChat } from "../../context/ChatContext";
import type { ResponseStyle } from "../../types/chat";

interface Props {
  onOpenFilePicker: () => void;
  onScreenshot: () => void;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  extendedThinkingEnabled: boolean;
  onToggleExtendedThinking: () => void;
  onOpenStateChange?: (open: boolean) => void;
}

const STYLES: ResponseStyle[] = ["Normal", "Concise", "Explanatory", "Formal"];

export default function PlusMenu({
  onOpenFilePicker,
  onScreenshot,
  webSearchEnabled,
  onToggleWebSearch,
  extendedThinkingEnabled,
  onToggleExtendedThinking,
  onOpenStateChange,
}: Props) {
  const { preferences, updatePreferences } = useChat();
  const { showToast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [styleSubmenuOpen, setStyleSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => {
    setIsOpen((prev) => {
      const next = !prev;
      onOpenStateChange?.(next);
      return next;
    });
    setStyleSubmenuOpen(false);
  };

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setStyleSubmenuOpen(false);
    onOpenStateChange?.(false);
  }, [onOpenStateChange]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeMenu]);

  return (
    <div className="relative" ref={menuRef}>
      <IconButton
        label="Add content"
        onClick={toggleMenu}
        className="h-8 w-8 text-ink-muted hover:text-ink"
      >
        <Plus size={18} strokeWidth={2} />
      </IconButton>

      {isOpen && (
        <div className="anim-popover-in absolute bottom-full left-0 z-40 mb-2 w-56 origin-bottom-left rounded-xl border border-line bg-elev-1 p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.5)] font-sans">
          <button
            type="button"
            onClick={() => {
              closeMenu();
              onOpenFilePicker();
            }}
            className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
          >
            <ImageIcon size={15} className="text-ink-muted" />
            <span>Add files or photos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              closeMenu();
              onScreenshot();
            }}
            className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
          >
            <Camera size={15} className="text-ink-muted" />
            <span>Take a screenshot</span>
          </button>

          <button
            type="button"
            disabled
            className="flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[13px] text-ink-faint opacity-50 cursor-not-allowed"
          >
            <span className="flex items-center gap-2.5">
              <FileText size={15} />
              <span>Add from Google Drive</span>
            </span>
            <span className="text-[10px] uppercase">Soon</span>
          </button>

          <div className="my-1 border-t border-line" />

          {/* Web Search Toggle */}
          <button
            type="button"
            onClick={() => {
              onToggleWebSearch();
              showToast(
                !webSearchEnabled ? "Web search enabled" : "Web search disabled",
                "info"
              );
            }}
            className="flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[13px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
          >
            <div className="flex items-center gap-2.5">
              <Globe size={15} className="text-ink-muted" />
              <span>Web search</span>
            </div>
            {webSearchEnabled && <Check size={14} className="text-accent" />}
          </button>

          {/* Extended Thinking Toggle */}
          <button
            type="button"
            onClick={() => {
              onToggleExtendedThinking();
              showToast(
                !extendedThinkingEnabled
                  ? "Extended thinking enabled"
                  : "Extended thinking disabled",
                "info"
              );
            }}
            className="flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[13px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
          >
            <div className="flex items-center gap-2.5">
              <Brain size={15} className="text-ink-muted" />
              <span>Extended thinking</span>
            </div>
            {extendedThinkingEnabled && <Check size={14} className="text-accent" />}
          </button>

          {/* Response Style Submenu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setStyleSubmenuOpen((v) => !v)}
              className="flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[13px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
            >
              <div className="flex items-center gap-2.5">
                <Palette size={15} className="text-ink-muted" />
                <span>Use style</span>
              </div>
              <ChevronRight size={14} className="text-ink-muted" />
            </button>

            {styleSubmenuOpen && (
              <div className="anim-popover-in absolute bottom-0 left-full ml-1 w-44 rounded-xl border border-line bg-elev-1 p-1.5 shadow-xl">
                {STYLES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      updatePreferences({ responseStyle: st });
                      closeMenu();
                      showToast(`Style set to ${st}`, "info");
                    }}
                    className="flex h-7 w-full items-center justify-between rounded-lg px-2 text-[12.5px] text-ink-soft hover:bg-elev-2 hover:text-ink"
                  >
                    <span>{st}</span>
                    {preferences.responseStyle === st && (
                      <Check size={13} className="text-accent" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
