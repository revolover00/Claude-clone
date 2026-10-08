import { useEffect, useRef, useState } from "react";
import { Mic, ArrowUp, Square, UploadCloud, Quote } from "lucide-react";
import { cn } from "../utils/cn";
import IconButton from "./shared/IconButton";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
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
  onChangeValue?: (val: string) => void;
};

const COMMANDS = [
  { name: "/clear", desc: "Delete current chat history", action: "clear" },
  { name: "/model", desc: "Cycle active AI model", action: "model" },
  { name: "/style", desc: "Cycle response style", action: "style" },
  { name: "/new", desc: "Start a new chat session", action: "new" },
  { name: "/export", desc: "Export chat to Markdown", action: "export" },
];

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
    preferences, 
    activeQuote, 
    setActiveQuote,
    activeConversationId,
    createNewChat,
    deleteConversation,
    updatePreferences,
    activeBranch,
  } = useChat();
  const { showToast } = useToast();

  const [value, setValue] = useState(initialValue);
  const [model, setModel] = useState<ModelId>("sonnet-5");
  const [effort, setEffort] = useState<Effort>("Medium");

  // Feature toggles
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [extendedThinkingEnabled, setExtendedThinkingEnabled] = useState(false);

  // Suggestion examples panel
  const [activeChipExamples, setActiveChipExamples] = useState<string[] | null>(null);

  // Slash commands index
  const [slashIndex, setSlashIndex] = useState(0);

  // Offline status tracking
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const isSlashMenuOpen = value.startsWith("/") && !value.includes(" ");
  const filteredCommands = COMMANDS.filter((cmd) => cmd.name.startsWith(value));

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Load draft per chat on active conversation switch
  useEffect(() => {
    const draftKey = activeConversationId ? `draft_${activeConversationId}` : "draft_new_chat";
    const saved = localStorage.getItem(draftKey) || "";
    setValue(saved);
    onChangeValue?.(saved);
  }, [activeConversationId]);

  const executeCommand = (action: string) => {
    if (action === "new") {
      createNewChat();
      setValue("");
      showToast("Started a new chat session", "success");
    } else if (action === "clear") {
      if (activeConversationId) {
        deleteConversation(activeConversationId);
      }
      createNewChat();
      setValue("");
      showToast("Chat history deleted", "info");
    } else if (action === "style") {
      const styles = ["Normal", "Concise", "Explanatory", "Formal"] as const;
      const currentIdx = styles.indexOf(preferences.responseStyle);
      const nextIdx = (currentIdx + 1) % styles.length;
      updatePreferences({ responseStyle: styles[nextIdx] });
      setValue("");
      showToast(`Response style set to ${styles[nextIdx]}`, "success");
    } else if (action === "model") {
      const modelIds: ModelId[] = ["sonnet-5", "opus-5", "haiku-4-5"];
      const currentIdx = modelIds.indexOf(model);
      const nextIdx = (currentIdx + 1) % modelIds.length;
      setModel(modelIds[nextIdx]);
      setValue("");
      const modelNames = { "sonnet-5": "Sonnet 5", "opus-5": "Opus 5", "haiku-4-5": "Haiku 4.5" };
      showToast(`Active model changed to ${modelNames[modelIds[nextIdx]]}`, "success");
    } else if (action === "export") {
      if (activeBranch && activeBranch.length > 0) {
         const md = activeBranch
           .map((m) => `### ${m.role === "user" ? "User" : "Assistant"}\n\n${m.content}`)
           .join("\n\n");
         const blob = new Blob([md], { type: "text/markdown" });
         const url = URL.createObjectURL(blob);
         const a = document.createElement("a");
         a.href = url;
         a.download = `chat-export-${Date.now()}.md`;
         a.click();
         URL.revokeObjectURL(url);
         showToast("Chat exported as Markdown", "success");
      } else {
        showToast("No chat history to export", "info");
      }
      setValue("");
    }
  };

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

  const hasContent = value.trim().length > 0 || attachments.length > 0 || Boolean(activeQuote);

  const handleValueChange = (newVal: string) => {
    setValue(newVal);
    onChangeValue?.(newVal);
    if (activeChipExamples) setActiveChipExamples(null);
    setSlashIndex(0);

    const draftKey = activeConversationId ? `draft_${activeConversationId}` : "draft_new_chat";
    if (newVal) {
      localStorage.setItem(draftKey, newVal);
    } else {
      localStorage.removeItem(draftKey);
    }
  };

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
    const textToSend = activeQuote 
      ? `> ${activeQuote}\n\n${rawText}` 
      : rawText;
      
    const attsToSend = [...attachments];

    setValue("");
    clearAttachments();
    setActiveChipExamples(null);
    setActiveQuote?.(null);
    onChangeValue?.("");

    const draftKey = activeConversationId ? `draft_${activeConversationId}` : "draft_new_chat";
    localStorage.removeItem(draftKey);

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
      {/* Slash commands list */}
      {isSlashMenuOpen && filteredCommands.length > 0 && (
        <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-full max-w-[690px] rounded-xl border border-composer-line bg-composer p-1.5 shadow-xl anim-popover-in z-50 font-sans">
          <div className="px-3 py-1.5 text-[11px] font-bold text-accent uppercase tracking-wider select-none">Commands</div>
          <div className="max-h-56 overflow-y-auto scroll-slim flex flex-col gap-0.5">
            {filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.name}
                type="button"
                onClick={() => executeCommand(cmd.action)}
                onMouseEnter={() => setSlashIndex(idx)}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-start transition-colors duration-150 cursor-pointer w-full text-[13.5px]",
                  idx === slashIndex 
                    ? "bg-accent text-white" 
                    : "text-ink hover:bg-elev-2 text-ink-soft"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn("font-semibold font-mono", idx === slashIndex ? "text-white" : "text-accent")}>{cmd.name}</span>
                  <span className={cn("text-[12.5px]", idx === slashIndex ? "text-white/80" : "text-ink-muted")}>{cmd.desc}</span>
                </div>
                <span className={cn("text-[10px] font-mono select-none px-1.5 py-0.5 rounded border uppercase", 
                  idx === slashIndex ? "border-white/40 bg-white/10 text-white" : "border-line bg-elev-1 text-ink-muted"
                )}>
                  {idx === slashIndex ? "↩ Enter" : "Tab"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

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
        {/* Quote Chip if active */}
        {activeQuote && (
          <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-[#d97757]/30 bg-[#d97757]/10 px-3 py-2 text-[13px] text-ink shadow-sm relative pr-8 max-w-full">
            <Quote size={12} className="text-[#d97757] shrink-0" />
            <span className="font-semibold text-[#d97757] shrink-0 text-[12.5px] select-none">Quote:</span>
            <span className="truncate flex-1 italic text-ink-soft select-none">"{activeQuote}"</span>
            <button
              type="button"
              onClick={() => setActiveQuote?.(null)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-ink-muted hover:bg-[#d97757]/20 hover:text-ink cursor-pointer flex items-center justify-center h-5 w-5"
              title="Remove quote"
              aria-label="Remove quote"
            >
              <span className="text-[10px] font-bold">✕</span>
            </button>
          </div>
        )}

        {/* Attached files preview chips */}
        <AttachmentChips attachments={attachments} onRemove={removeAttachment} />

        {/* Textarea with auto-grow */}
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
                disabled={!hasContent || isOffline}
                title={isOffline ? "You are offline. Please reconnect to send messages." : (hasContent ? "Send message" : "Type a message or attach a file")}
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
