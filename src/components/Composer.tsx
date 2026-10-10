import { useEffect, useRef } from "react";
import { Mic, ArrowUp, Square } from "lucide-react";
import { cn } from "../utils/cn";
import IconButton from "./shared/IconButton";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import type { Attachment } from "../types/chat";
import { AttachmentChips } from "./composer/AttachmentChips";
import PlusMenu from "./composer/PlusMenu";
import ModelMenu from "./composer/ModelMenu";
import { SuggestionPanel } from "./composer/SuggestionPanel";
import { useAttachments } from "./composer/useAttachments";
import { useDictation } from "./composer/useDictation";
import SlashMenu from "./composer/SlashMenu";
import { getSlashCommands, useSlashCommands } from "./composer/useSlashCommands";
import { useModels } from "../hooks/useModels";
import DragOverlay from "./composer/DragOverlay";
import QuoteBanner from "./composer/QuoteBanner";
import { useComposerState } from "./composer/useComposerState";

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
  onChangeValue?: (val: string) => void;
};

export default function Composer({
  onSend,
  onStop,
  isStreaming = false,
  inChatView = false,
  initialValue = "",
  onEditLastMessage,
  onChangeValue,
}: Props) {
  const {
    preferences, activeQuote, setActiveQuote, activeConversationId,
    createNewChat, deleteConversation, updatePreferences, activeBranch,
  } = useChat();
  const { showToast } = useToast();
  const { models } = useModels();

  const {
    value, setValue, model, setModel, effort, setEffort,
    webSearchEnabled, setWebSearchEnabled, extendedThinkingEnabled, setExtendedThinkingEnabled,
    activeChipExamples, setActiveChipExamples, slashIndex, setSlashIndex,
    isOffline, handleValueChange,
  } = useComposerState({ activeConversationId, initialValue, onChangeValue });

  const allCommands = getSlashCommands(models);
  const isSlashMenuOpen = value.startsWith("/") && (!value.includes(" ") || value.startsWith("/model"));
  const filteredCommands = allCommands.filter((cmd) => {
    if (value === "/") return true;
    if (value.startsWith("/model")) {
      return (
        cmd.name.toLowerCase().startsWith(value.toLowerCase()) ||
        cmd.action.startsWith("model")
      );
    }
    return cmd.name.toLowerCase().startsWith(value.toLowerCase());
  });

  const { executeCommand } = useSlashCommands({
    activeConversationId, activeBranch, preferences, model, setModel,
    setValue, createNewChat, deleteConversation, updatePreferences, showToast,
  });

  const areaRef = useRef<HTMLTextAreaElement>(null);

  const {
    attachments, isDragging, fileInputRef, handleFiles, removeAttachment,
    clearAttachments, handlePaste, captureScreenshot, openFilePicker,
  } = useAttachments();

  const { micOn, toggleMic } = useDictation({
    language: preferences.language,
    currentValue: value,
    onTranscript: setValue,
  });

  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
      areaRef.current?.focus();
    }
  }, [initialValue, setValue]);

  const adjustHeight = () => {
    const textarea = areaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(Math.min(textarea.scrollHeight, 176), 48)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  const hasContent = value.trim().length > 0 || attachments.length > 0 || Boolean(activeQuote);

  const handleSend = () => {
    if (isOffline) {
      showToast("You are offline. Please reconnect to send messages.", "error");
      return;
    }
    if (isStreaming) {
      onStop?.();
      return;
    }
    if (!hasContent) return;

    const rawText = value.trim();
    const textToSend = activeQuote ? `> ${activeQuote}\n\n${rawText}` : rawText;
    const attsToSend = [...attachments];

    setValue("");
    clearAttachments();
    setActiveChipExamples(null);
    setActiveQuote?.(null);
    onChangeValue?.("");

    const draftKey = activeConversationId ? `draft_${activeConversationId}` : "draft_new_chat";
    localStorage.removeItem(draftKey);

    if (areaRef.current) areaRef.current.style.height = "auto";

    onSend?.(textToSend, attsToSend, {
      model,
      effort,
      webSearch: webSearchEnabled,
      extendedThinking: extendedThinkingEnabled,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashMenuOpen && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        executeCommand(filteredCommands[slashIndex].action);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setValue("");
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "ArrowUp" && value === "" && inChatView) {
      e.preventDefault();
      onEditLastMessage?.();
    }
  };

  return (
    <div className="relative w-full font-sans">
      {isSlashMenuOpen && filteredCommands.length > 0 && (
        <SlashMenu
          filteredCommands={filteredCommands}
          slashIndex={slashIndex}
          setSlashIndex={setSlashIndex}
          executeCommand={executeCommand}
        />
      )}

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

      <DragOverlay isDragging={isDragging} />

      <div className="mx-auto flex min-h-[128px] w-full max-w-[690px] flex-col rounded-[14px] border border-composer-line bg-composer px-4 pb-2.5 pt-3 transition-all duration-200 focus-within:border-accent/40 focus-within:shadow-[0_0_0_3px_rgba(217,119,87,0.07)]">
        <QuoteBanner activeQuote={activeQuote} onClear={() => setActiveQuote?.(null)} />

        <AttachmentChips attachments={attachments} onRemove={removeAttachment} />

        <textarea
          ref={areaRef}
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={isOffline ? "You are currently offline. Check your internet connection." : "How can I help you today?"}
          rows={2}
          disabled={isOffline}
          aria-label="Message Claude"
          className={cn(
            "max-h-44 w-full resize-none overflow-y-auto bg-transparent text-[15.5px] leading-6 text-ink placeholder:text-ink-muted focus:outline-none scroll-slim",
            isOffline && "cursor-not-allowed opacity-60"
          )}
        />

        <div className="mt-auto flex items-center justify-between pt-2">
          <PlusMenu
            onOpenFilePicker={openFilePicker}
            onScreenshot={captureScreenshot}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={() => setWebSearchEnabled((v) => !v)}
            extendedThinkingEnabled={extendedThinkingEnabled}
            onToggleExtendedThinking={() => setExtendedThinkingEnabled((v) => !v)}
          />

          <div className="relative flex items-center gap-1.5">
            <ModelMenu model={model} onSelectModel={setModel} effort={effort} onSelectEffort={setEffort} />

            <IconButton
              label={micOn ? "Stop dictation" : "Dictate"}
              onClick={toggleMic}
              className={cn("rounded-full", micOn && "anim-mic text-accent hover:text-accent")}
            >
              <Mic size={16} strokeWidth={1.9} />
            </IconButton>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-sm transition-all duration-150 hover:opacity-90 scale-100"
              >
                <Square size={13} fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!hasContent || isOffline}
                title={isOffline ? "You are offline." : (hasContent ? "Send message" : "Type a message")}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                  hasContent && !isOffline
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

      <SuggestionPanel
        inChatView={inChatView}
        activeChipExamples={activeChipExamples}
        onSelectExample={(example) => {
          setValue(example);
          setActiveChipExamples(null);
          onSend?.(example, attachments);
        }}
        onCloseExamples={() => setActiveChipExamples(null)}
        onPickChip={(starter, examples) => {
          setValue(starter);
          setActiveChipExamples(examples);
          areaRef.current?.focus();
        }}
        attachments={attachments}
      />
    </div>
  );
}
