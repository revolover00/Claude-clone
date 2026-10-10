import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check, Brain, Globe, Eye } from "lucide-react";
import { cn } from "../../utils/cn";
import { useToast } from "../../context/ToastContext";
import { useModels } from "../../hooks/useModels";
import type { Model } from "../../types/chat";

export const EFFORTS = ["Low", "Medium", "High"] as const;
export type Effort = (typeof EFFORTS)[number];
export type ModelId = string;

interface Props {
  model: string;
  onSelectModel: (m: string) => void;
  effort: Effort;
  onSelectEffort: (e: Effort) => void;
  onOpenStateChange?: (open: boolean) => void;
}

export default function ModelMenu({
  model,
  onSelectModel,
  effort,
  onSelectEffort,
  onOpenStateChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { models, defaultModel, normalizeSlug } = useModels();
  const menuRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    // Resolve last saved model or default
    const saved = localStorage.getItem("claude_clone_last_model");
    const normalizedSaved = saved ? normalizeSlug(saved) : null;
    
    const exists = models.find((m: Model) => m.slug === normalizedSaved || m.id === normalizedSaved);
    const targetModel = exists || defaultModel;

    if (targetModel && model !== targetModel.slug) {
      onSelectModel(targetModel.slug);
      localStorage.setItem("claude_clone_last_model", targetModel.slug);
      if (saved && !exists) {
        showToast(`Previously selected model was disabled. Switched to ${targetModel.display_name}.`, "info");
      }
    }
  }, [models, model, onSelectModel, showToast, normalizeSlug, defaultModel]);

  const currentModelObj = models.find((m: Model) => m.slug === model || m.id === model) || defaultModel;


  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      onOpenStateChange?.(next);
      return next;
    });
  };

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onOpenStateChange?.(false);
  }, [onOpenStateChange]);

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

  const handleSelectModelLocal = (selectedSlug: string) => {
    localStorage.setItem("claude_clone_last_model", selectedSlug);
    onSelectModel(selectedSlug);
    closeMenu();
  };

  return (
    <div className="relative flex items-center gap-1 font-sans" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex h-8 items-center gap-2 rounded-md px-2 transition-colors duration-150 hover:bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
      >
        <span className="text-[13.5px] font-medium text-ink-soft">
          {currentModelObj.display_name}
        </span>
        <span className="text-[13.5px] text-ink-muted">{effort}</span>
      </button>

      <button
        type="button"
        aria-label="Model options"
        onClick={toggleOpen}
        className="flex h-8 w-7 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
      >
        <ChevronDown size={15} strokeWidth={2} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          className="anim-popover-in absolute bottom-full right-0 z-45 mb-2 w-72 rounded-xl border border-line bg-elev-1 p-2 shadow-[0_16px_36px_rgba(0,0,0,0.5)]"
        >
          {/* Models list */}
          <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
            Model
          </p>
          <div className="space-y-1 max-h-[220px] overflow-y-auto scroll-slim">
            {models.filter((m: Model) => m.kind === 'chat' && m.enabled).map((m: Model) => (
              <button
                key={m.id || m.slug}
                type="button"
                role="menuitemradio"
                aria-checked={model === m.slug}
                onClick={() => handleSelectModelLocal(m.slug)}
                className={cn(
                  "flex w-full items-start justify-between rounded-lg p-2 text-start transition-colors cursor-pointer",
                  model === m.slug
                    ? "bg-elev-2 text-ink"
                    : "text-ink-soft hover:bg-elev-2 hover:text-ink"
                )}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[13px] font-semibold">{m.display_name}</p>
                    <div className="flex gap-1">
                      {m.supports_thinking && <span title="Supports Thinking"><Brain size={10} className="text-amber-400" /></span>}
                      {m.supports_search && <span title="Supports Search"><Globe size={10} className="text-sky-400" /></span>}
                      {m.supports_vision && <span title="Supports Vision"><Eye size={10} className="text-emerald-400" /></span>}
                    </div>
                  </div>
                  <p className="text-[11.5px] text-ink-muted leading-tight mt-0.5 break-words">
                    {m.description || "Conversational chat model."}
                  </p>
                </div>
                {model === m.slug && (
                  <Check size={14} className="text-accent shrink-0 mt-1" />
                )}
              </button>
            ))}
          </div>

          <div className="my-2 border-t border-line" />

          {/* Effort section */}
          <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
            Effort
          </p>
          <div className="space-y-0.5">
            {EFFORTS.map((e) => (
              <button
                key={e}
                type="button"
                role="menuitemradio"
                aria-checked={effort === e}
                onClick={() => {
                  onSelectEffort(e);
                  closeMenu();
                }}
                className={cn(
                  "flex h-8 w-full items-center justify-between rounded-md px-2 text-[12.5px] transition-colors cursor-pointer",
                  effort === e
                    ? "text-ink font-medium bg-elev-2"
                    : "text-ink-soft hover:bg-elev-2"
                )}
              >
                <span>{e}</span>
                {effort === e && <Check size={13} className="text-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
