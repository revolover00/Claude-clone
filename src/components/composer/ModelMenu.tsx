import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check, Brain, Globe, Eye } from "lucide-react";
import { cn } from "../../utils/cn";
import { useToast } from "../../context/ToastContext";

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
  const [chatModels, setChatModels] = useState<any[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch("/api/models");
      if (!res.ok) throw new Error("Could not load models");
      const data = await res.json();
      const chats = data.filter((m: any) => m.kind === "chat");
      setChatModels(chats);

      // Resolve last saved model or default
      const saved = localStorage.getItem("claude_clone_last_model");
      const defaultModel = chats.find((m: any) => m.is_default) || chats[0];

      if (saved) {
        const exists = chats.find((m: any) => m.slug === saved || m.id === saved);
        if (exists) {
          // Model is active and enabled
          if (model !== exists.slug) {
            onSelectModel(exists.slug);
          }
        } else {
          // Saved model is disabled/removed, trigger fallback
          if (defaultModel) {
            onSelectModel(defaultModel.slug);
            localStorage.setItem("claude_clone_last_model", defaultModel.slug);
            showToast(`Previously selected model was disabled. Switched to ${defaultModel.display_name}.`, "info");
          }
        }
      } else if (defaultModel && model !== defaultModel.slug) {
        onSelectModel(defaultModel.slug);
        localStorage.setItem("claude_clone_last_model", defaultModel.slug);
      }
    } catch {
      // Fallback
      setChatModels([
        { slug: "sonnet-5", display_name: "Sonnet 5", description: "Fast and highly balanced intelligence, ideal for general chat and multimodal tasks.", provider: "google", api_model_id: "gemini-3.8-flash", kind: "chat", supports_thinking: false, supports_search: true, supports_vision: true, enabled: true, is_default: true, sort_order: 1 }
      ]);
    }
  }, [model, onSelectModel, showToast]);

  useEffect(() => {
    loadModels();
  }, []);

  const currentModelObj = chatModels.find((m) => m.slug === model || m.id === model) || chatModels[0] || {
    display_name: "Sonnet 5",
    slug: "sonnet-5",
    description: "Fast and balanced general chat model."
  };

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
            {chatModels.map((m) => (
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
