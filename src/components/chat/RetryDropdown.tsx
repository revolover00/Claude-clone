import { useEffect, useState } from "react";
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
  const [showCustomInstruction, setShowCustomInstruction] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setShowCustomInstruction(false);
      setCustomInstruction("");
    }
  }, [isOpen]);

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

      {isOpen && !showCustomInstruction && (
        <div className="absolute bottom-9 left-0 z-30 w-64 rounded-xl border border-line bg-elev-1 py-1.5 shadow-xl anim-fade-in font-sans text-start animate-scale-up">
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
          <div className="h-px bg-line/60 my-1 mx-2" />
          <button
            type="button"
            onClick={() => setShowCustomInstruction(true)}
            className="w-full text-start px-3 py-1.5 text-[12px] text-accent hover:bg-elev-2 transition-colors cursor-pointer"
          >
            Retry with custom instruction…
          </button>
        </div>
      )}
      {isOpen && showCustomInstruction && (
        <div className="absolute bottom-9 left-0 z-30 w-64 rounded-xl border border-line bg-elev-1 p-3 shadow-xl anim-fade-in font-sans text-start animate-scale-up">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const instruction = customInstruction.trim();
              if (!instruction) return;
              onToggle();
              onRetry(message.id, { modifier: instruction });
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor={`retry-instruction-${message.id}`} className="text-[12px] font-semibold text-ink">
                Custom retry instruction
              </label>
              <button type="button" onClick={() => setShowCustomInstruction(false)} className="text-[11px] text-ink-muted hover:text-ink">
                Back
              </button>
            </div>
            <textarea
              id={`retry-instruction-${message.id}`}
              aria-label="Custom retry instruction"
              autoFocus
              rows={4}
              maxLength={500}
              value={customInstruction}
              onChange={(event) => setCustomInstruction(event.target.value)}
              placeholder="e.g. Explain in Arabic and include an example."
              className="w-full resize-none rounded-lg border border-line bg-elev-2 px-2.5 py-2 text-[12px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-ink-muted">{customInstruction.length}/500</span>
              <button
                type="submit"
                disabled={!customInstruction.trim()}
                className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Retry response
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
