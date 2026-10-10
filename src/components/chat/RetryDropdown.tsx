import { RotateCcw, ChevronDown, Brain, Globe, Eye } from "lucide-react";
import type { Message, Model } from "../../types/chat";
import { useModels } from "../../hooks/useModels";

interface RetryDropdownProps {
  message: Message;
  isOpen: boolean;
  onToggle: () => void;
  onRetry: (assistantMessageId: string, options?: { model?: string; modifier?: string }) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
}

export default function RetryDropdown({
  message,
  isOpen,
  onToggle,
  onRetry,
  dropdownRef,
}: RetryDropdownProps) {
  const { models } = useModels();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={onToggle}
        title="Retry options"
        aria-label="Open retry response directives"
        className="inline-flex h-7 px-1.5 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer text-[11px] font-medium gap-0.5"
      >
        <RotateCcw size={13} strokeWidth={1.9} />
        <ChevronDown size={11} strokeWidth={2} />
      </button>

      {isOpen && (
        <div className="absolute bottom-9 left-0 z-30 w-64 rounded-xl border border-line bg-[#1e1c1a] py-1.5 shadow-xl anim-fade-in font-sans text-start animate-scale-up">
          <button
            type="button"
            onClick={() => {
              onToggle();
              onRetry(message.id);
            }}
            className="w-full text-start px-3 py-1.5 text-[12px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer"
          >
            Standard Retry
          </button>

          <div className="h-px bg-line/60 my-1 mx-2" />
          <div className="px-3 py-0.5 text-[10px] font-semibold text-ink-faint uppercase select-none">
            Retry with model
          </div>

          {models
            .filter((m: Model) => m.kind === "chat" && m.enabled)
            .map((model: Model) => (
              <button
                key={model.slug}
                type="button"
                onClick={() => {
                  onToggle();
                  onRetry(message.id, { model: model.slug });
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-[12px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer text-start"
              >
                <span className="truncate">{model.display_name}</span>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {model.supports_thinking && (
                    <span
                      title="Thinking"
                      className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20"
                    >
                      <Brain size={8} />
                      Thinking
                    </span>
                  )}
                  {model.supports_search && (
                    <span
                      title="Search"
                      className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/20"
                    >
                      <Globe size={8} />
                      Search
                    </span>
                  )}
                  {model.supports_vision && (
                    <span
                      title="Vision"
                      className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                    >
                      <Eye size={8} />
                      Vision
                    </span>
                  )}
                </div>
              </button>
            ))}

          <div className="h-px bg-line/60 my-1 mx-2" />
          <div className="px-3 py-0.5 text-[10px] font-semibold text-ink-faint uppercase select-none">
            Directives
          </div>

          <button
            type="button"
            onClick={() => {
              onToggle();
              onRetry(message.id, { modifier: "Make the response much shorter, compact, and concise." });
            }}
            className="w-full text-start px-3 py-1 text-[12px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer"
          >
            Make it shorter
          </button>
          <button
            type="button"
            onClick={() => {
              onToggle();
              onRetry(message.id, {
                modifier: "Provide a highly comprehensive, expanded explanation with step-by-step details.",
              });
            }}
            className="w-full text-start px-3 py-1 text-[12px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer"
          >
            Make it more detailed
          </button>
        </div>
      )}
    </div>
  );
}
