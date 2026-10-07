import { useEffect, useRef, useState } from "react";
import { Mic, ArrowUp, Square, UploadCloud } from "lucide-react";
import { cn } from "../utils/cn";
import IconButton from "./shared/IconButton";
import { useChat } from "../context/ChatContext";
import type { Attachment } from "../types/chat";
import { AttachmentChips } from "./composer/AttachmentChips";
import PlusMenu from "./composer/PlusMenu";
import ModelMenu, { type ModelId, type Effort } from "./composer/ModelMenu";
import { SuggestionPanel } from "./composer/SuggestionPanel";
import { useAttachments } from "./composer/useAttachments";
import { useDictation } from "./composer/useDictation";

type Props = {
  onSend?: (
    text: string,
    attachments?: Attachment[],
    options?: {
      model: string;
      effort: string;
      webSearch: boolean;
      extendedThinking: boolean;
    }
  ) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  inChatView?: boolean;
  initialValue?: string;
  onEditLastMessage?: () => void;
};

export default function Composer({
  onSend,
  onStop,
  isStreaming = false,
  inChatView = false,
  initialValue = "",
  onEditLastMessage,
}: Props) {
  const { preferences } = useChat();

  const [value, setValue] = useState(initialValue);
  const [model, setModel] = useState<ModelId>("sonnet-5");
  const [effort, setEffort] = useState<Effort>("Medium");

  // Feature toggles
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [extendedThinkingEnabled, setExtendedThinkingEnabled] = useState(false);

  // Suggestion examples panel
  const [activeChipExamples, setActiveChipExamples] = useState<string[] | null>(null);

  const areaRef = useRef<HTMLTextAreaElement>(null);

  const {
    attachments,
    isDragging,
    fileInputRef,
    handleFiles,
    removeAttachment,
    clearAttachments,
    handlePaste,
    captureScreenshot,
    openFilePicker,
  } = useAttachments();

  const { micOn, toggleMic } = useDictation({
    language: preferences.language,
    currentValue: value,
    onTranscript: setValue,
  });

  // Sync external initialValue updates
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
      areaRef.current?.focus();
    }
  }, [initialValue]);

  // Textarea auto-grow
  const adjustHeight = () => {
    const textarea = areaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 176); // max-h-44 = 176px
    textarea.style.height = `${Math.max(nextHeight, 48)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  const hasContent = value.trim().length > 0 || attachments.length > 0;

  const handleSend = () => {
    if (isStreaming) {
      onStop?.();
      return;
    }
    if (!hasContent) return;

    const textToSend = value.trim();
    const attsToSend = [...attachments];

    setValue("");
    clearAttachments();
    setActiveChipExamples(null);

    if (areaRef.current) {
      areaRef.current.style.height = "auto";
    }

    onSend?.(textToSend, attsToSend, {
      model,
      effort,
      webSearch: webSearchEnabled,
      extendedThinking: extendedThinkingEnabled,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "ArrowUp" && value === "" && !inChatView === false) {
      e.preventDefault();
      onEditLastMessage?.();
    }
  };

  const handlePickChip = (starter: string, examples: string[]) => {
    setValue(starter);
    setActiveChipExamples(examples);
    areaRef.current?.focus();
  };

  return (
    <div className="relative w-full font-sans">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Drag & drop overlay */}
      {isDragging && (
        <div className="fixed inset-4 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-black/75 backdrop-blur-sm pointer-events-none anim-modal-in">
          <div className="flex flex-col items-center gap-3 text-ink">
            <UploadCloud size={46} className="text-accent animate-bounce" />
            <p className="text-xl font-medium">Drop files here</p>
            <p className="text-sm text-ink-muted">
              Add photos, code files, and documents to your chat
            </p>
          </div>
        </div>
      )}

      {/* Composer Container */}
      <div className="mx-auto flex min-h-[128px] w-full max-w-[690px] flex-col rounded-[14px] border border-composer-line bg-composer px-4 pb-2.5 pt-3 transition-all duration-200 focus-within:border-accent/40 focus-within:shadow-[0_0_0_3px_rgba(217,119,87,0.07)]">
        {/* Attached files preview chips */}
        <AttachmentChips attachments={attachments} onRemove={removeAttachment} />

        {/* Textarea with auto-grow */}
        <textarea
          ref={areaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (activeChipExamples) setActiveChipExamples(null);
          }}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder="How can I help you today?"
          rows={2}
          aria-label="Message Claude"
          className="max-h-44 w-full resize-none overflow-y-auto bg-transparent text-[15.5px] leading-6 text-ink placeholder:text-ink-muted focus:outline-none scroll-slim"
        />

        {/* Bottom toolbar */}
        <div className="mt-auto flex items-center justify-between pt-2">
          {/* Left: Plus Menu */}
          <PlusMenu
            onOpenFilePicker={openFilePicker}
            onScreenshot={captureScreenshot}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={() => setWebSearchEnabled((v) => !v)}
            extendedThinkingEnabled={extendedThinkingEnabled}
            onToggleExtendedThinking={() => setExtendedThinkingEnabled((v) => !v)}
          />

          {/* Right: Model Selector & Send Button */}
          <div className="relative flex items-center gap-1.5">
            <ModelMenu
              model={model}
              onSelectModel={setModel}
              effort={effort}
              onSelectEffort={setEffort}
            />

            {/* Dictate Button */}
            <IconButton
              label={micOn ? "Stop dictation" : "Dictate"}
              onClick={toggleMic}
              className={cn(
                "rounded-full",
                micOn && "anim-mic text-accent hover:text-accent"
              )}
            >
              <Mic size={16} strokeWidth={1.9} />
            </IconButton>

            {/* Send / Stop Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-sm transition-all duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 scale-100"
              >
                <Square size={13} fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!hasContent}
                title={hasContent ? "Send message" : "Type a message or attach a file"}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                  hasContent
                    ? "bg-accent text-white shadow-sm hover:opacity-90 scale-100 opacity-100 cursor-pointer"
                    : "bg-elev-3 text-ink-muted opacity-40 scale-90 cursor-not-allowed pointer-events-none"
                )}
              >
                <ArrowUp size={16} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Suggestion Example Prompts Panel & Chips */}
      <SuggestionPanel
        inChatView={inChatView}
        activeChipExamples={activeChipExamples}
        onSelectExample={(example) => {
          setValue(example);
          setActiveChipExamples(null);
          onSend?.(example, attachments);
        }}
        onCloseExamples={() => setActiveChipExamples(null)}
        onPickChip={handlePickChip}
        attachments={attachments}
      />
    </div>
  );
}
