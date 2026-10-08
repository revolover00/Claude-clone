import {
  Copy,
  Check,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Play,
} from "lucide-react";
import type { Message } from "../../types/chat";
import FeedbackPopover from "./FeedbackPopover";
import RetryDropdown from "./RetryDropdown";

interface AssistantMessageToolbarProps {
  message: Message;
  isArabic: boolean;
  hasMultipleVersions: boolean;
  currentIndex: number;
  siblingsLength: number;
  onPrevVersion: () => void;
  onNextVersion: () => void;
  timeStr: string;
  fullDateStr: string;
  copied: boolean;
  handleCopy: (e?: React.MouseEvent) => void;
  handleReadAloud: () => void;
  speechState: "idle" | "playing" | "paused";
  thumbs: "up" | "down" | null;
  setThumbs: React.Dispatch<React.SetStateAction<"up" | "down" | null>>;
  thumbsDownPopoverOpen: boolean;
  setThumbsDownPopoverOpen: (open: boolean) => void;
  retryDropdownOpen: boolean;
  setRetryDropdownOpen: (open: boolean) => void;
  onRetry?: (assistantMessageId: string, options?: { model?: string; modifier?: string }) => void;
  onContinue?: (assistantMessageId: string) => void;
  isLastAssistantMessage: boolean;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
}

export default function AssistantMessageToolbar({
  message,
  isArabic,
  hasMultipleVersions,
  currentIndex,
  siblingsLength,
  onPrevVersion,
  onNextVersion,
  timeStr,
  fullDateStr,
  copied,
  handleCopy,
  handleReadAloud,
  speechState,
  thumbs,
  setThumbs,
  thumbsDownPopoverOpen,
  setThumbsDownPopoverOpen,
  retryDropdownOpen,
  setRetryDropdownOpen,
  onRetry,
  onContinue,
  isLastAssistantMessage,
  dropdownRef,
}: AssistantMessageToolbarProps) {
  return (
    <div className={`mt-3.5 flex items-center gap-2 relative ${isArabic ? "justify-end" : "justify-start"}`}>
      {hasMultipleVersions && (
        <div className="flex items-center gap-0.5 rounded-md bg-elev-1 px-1.5 py-0.5 text-[12px] text-ink-muted select-none border border-line/60 me-1">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={onPrevVersion}
            className="p-0.5 rounded hover:bg-elev-3 disabled:opacity-30 disabled:cursor-not-allowed text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="font-mono text-[11px] px-1 text-ink-soft">
            {currentIndex + 1}/{siblingsLength}
          </span>
          <button
            type="button"
            disabled={currentIndex === siblingsLength - 1}
            onClick={onNextVersion}
            className="p-0.5 rounded hover:bg-elev-3 disabled:opacity-30 disabled:cursor-not-allowed text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      <span
        className="text-[11px] text-ink-muted/70 select-none cursor-help font-sans hover:text-ink-soft transition-colors select-none me-1"
        title={fullDateStr}
      >
        {timeStr}
      </span>

      <div className={`flex items-center gap-1 transition-opacity duration-150 relative ${isLastAssistantMessage ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button
          type="button"
          onClick={(e) => handleCopy(e)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
        >
          {copied ? <Check size={14} className="text-accent animate-pulse" /> : <Copy size={14} />}
        </button>

        <button
          type="button"
          onClick={handleReadAloud}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer ${speechState === "playing" ? "text-accent bg-elev-2" : "text-ink-muted"}`}
        >
          {speechState === "playing" ? <VolumeX size={14} className="animate-pulse" /> : <Volume2 size={14} />}
        </button>

        <button
          type="button"
          onClick={() => {
            const next = thumbs === "up" ? null : "up";
            setThumbs(next);
            if (next) {
              localStorage.setItem(`feedback_${message.id}`, JSON.stringify({ thumbs: "up" }));
            } else {
              localStorage.removeItem(`feedback_${message.id}`);
            }
          }}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer ${thumbs === "up" ? "text-accent bg-elev-2" : "text-ink-muted"}`}
        >
          <ThumbsUp size={14} />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setThumbsDownPopoverOpen(!thumbsDownPopoverOpen)}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer ${thumbs === "down" ? "text-accent bg-elev-2" : "text-ink-muted"}`}
          >
            <span className="text-[11px] font-sans">👎</span>
          </button>

          {thumbsDownPopoverOpen && (
            <FeedbackPopover
              message={message}
              onClose={() => setThumbsDownPopoverOpen(false)}
              onSuccess={() => setThumbs("down")}
            />
          )}
        </div>

        {onRetry && (
          <RetryDropdown
            message={message}
            isOpen={retryDropdownOpen}
            onToggle={() => setRetryDropdownOpen(!retryDropdownOpen)}
            onRetry={onRetry}
            dropdownRef={dropdownRef}
          />
        )}

        {isLastAssistantMessage && onContinue && message.finishReason === "MAX_TOKENS" && (
          <button
            type="button"
            onClick={() => onContinue(message.id)}
            className="inline-flex h-7 px-2.5 items-center justify-center rounded-md border border-line bg-elev-1 hover:bg-elev-3 hover:text-ink text-ink-soft font-semibold transition-all duration-150 text-[11.5px] cursor-pointer shadow-xs gap-1.5 select-none"
          >
            <Play size={11} fill="currentColor" strokeWidth={0} />
            <span>Continue</span>
          </button>
        )}
      </div>
    </div>
  );
}
