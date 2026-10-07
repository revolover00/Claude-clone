import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../utils/cn";

export const MODELS = [
  {
    id: "sonnet-5",
    name: "Sonnet 5",
    desc: "Smart, fast, exceptional reasoning",
  },
  {
    id: "opus-5",
    name: "Opus 5",
    desc: "Deep analysis and nuanced comprehension",
  },
  {
    id: "haiku-4-5",
    name: "Haiku 4.5",
    desc: "Near-instant responses for lightweight tasks",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const EFFORTS = ["Low", "Medium", "High"] as const;
export type Effort = (typeof EFFORTS)[number];

interface Props {
  model: ModelId;
  onSelectModel: (m: ModelId) => void;
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
  const menuRef = useRef<HTMLDivElement>(null);

  const currentModelObj = MODELS.find((m) => m.id === model) || MODELS[0];

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

  return (
    <div className="relative flex items-center gap-1 font-sans" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex h-8 items-center gap-2 rounded-md px-2 transition-colors duration-150 hover:bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <span className="text-[13.5px] font-medium text-ink-soft">
          {currentModelObj.name}
        </span>
        <span className="text-[13.5px] text-ink-muted">{effort}</span>
      </button>

      <button
        type="button"
        aria-label="Model options"
        onClick={toggleOpen}
        className="flex h-8 w-7 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <ChevronDown size={15} strokeWidth={2} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          className="anim-popover-in absolute bottom-full right-0 z-40 mb-2 w-64 rounded-xl border border-line bg-elev-1 p-2 shadow-[0_16px_36px_rgba(0,0,0,0.5)]"
        >
          {/* Models list */}
          <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
            Model
          </p>
          <div className="space-y-1">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="menuitemradio"
                aria-checked={model === m.id}
                onClick={() => {
                  onSelectModel(m.id);
                }}
                className={cn(
                  "flex w-full items-start justify-between rounded-lg p-2 text-start transition-colors",
                  model === m.id
                    ? "bg-elev-2 text-ink"
                    : "text-ink-soft hover:bg-elev-2 hover:text-ink"
                )}
              >
                <div>
                  <p className="text-[13.5px] font-medium">{m.name}</p>
                  <p className="text-[11.5px] text-ink-muted leading-tight">
                    {m.desc}
                  </p>
                </div>
                {model === m.id && (
                  <Check size={15} className="text-accent shrink-0 mt-0.5" />
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
                  "flex h-8 w-full items-center justify-between rounded-md px-2 text-[13px] transition-colors",
                  effort === e
                    ? "text-ink font-medium bg-elev-2"
                    : "text-ink-soft hover:bg-elev-2"
                )}
              >
                <span>{e}</span>
                {effort === e && <Check size={14} className="text-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
