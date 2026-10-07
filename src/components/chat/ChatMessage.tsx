import { useState, useRef, useEffect, useMemo } from "react";
import {
  Copy,
  Check,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ClaudeSpark from "../icons/ClaudeSpark";
import MarkdownView from "./MarkdownView";
import ThoughtProcess from "./ThoughtProcess";
import ErrorBoundary from "../shared/ErrorBoundary";
import type { Message } from "../../types/chat";
import { isArabicText } from "../../utils/text";
import { detectArtifact } from "../../utils/artifactDetector";
import { useToast } from "../../context/ToastContext";
import { useChat, getMessageSiblings } from "../../context/ChatContext";

type Props = {
  message: Message;
  userPrompt?: string;
  conversationId?: string;
  onSaveEdit?: (messageId: string, newContent: string) => void;
  onRetry?: (assistantMessageId: string) => void;
};

export default function ChatMessage({
  message,
  userPrompt = "",
  conversationId = "",
  onSaveEdit,
  onRetry,
}: Props) {
  const { showToast } = useToast();
  const {
    activeConversation,
    openArtifact,
    saveOrUpdateArtifact,
    updateActiveArtifactLive,
    switchMessageVersion,
  } = useChat();

  const [copied, setCopied] = useState(false);
  const [thumbs, setThumbs] = useState<"up" | "down" | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isUser = message.role === "user";
  const isArabic = isArabicText(message.content);

  // Message sibling version calculation
  const convMessages = activeConversation?.messages;
  const { siblings, currentIndex } = useMemo(() => {
    return getMessageSiblings(convMessages || [], message.id);
  }, [convMessages, message.id]);

  const hasMultipleVersions = siblings.length > 1;

  const handlePrevVersion = () => {
    if (currentIndex > 0 && conversationId) {
      switchMessageVersion(conversationId, message.id, currentIndex - 1);
    }
  };

  const handleNextVersion = () => {
    if (currentIndex < siblings.length - 1 && conversationId) {
      switchMessageVersion(conversationId, message.id, currentIndex + 1);
    }
  };

  // Detect artifact in assistant message
  const detected = useMemo(() => {
    if (message.role !== "assistant" || !message.content) return null;
    return detectArtifact(message.content, userPrompt);
  }, [message.role, message.content, userPrompt]);

  // If streaming and artifact is active, update its code live
  useEffect(() => {
    if (message.isStreaming && detected?.code && detected.title) {
      updateActiveArtifactLive(detected.title, detected.code);
    }
  }, [message.isStreaming, detected, updateActiveArtifactLive]);

  // Auto-save detected artifact into store once streaming finishes
  useEffect(() => {
    if (detected && !message.isStreaming && detected.code) {
      saveOrUpdateArtifact(
        detected.title,
        detected.language,
        detected.type,
        detected.code,
        conversationId
      );
    }
  }, [detected, message.isStreaming, saveOrUpdateArtifact, conversationId]);

  useEffect(() => {
    if (isEditing) {
      setEditContent(message.content);
      setTimeout(() => {
        if (editTextareaRef.current) {
          editTextareaRef.current.focus();
          editTextareaRef.current.selectionStart = editTextareaRef.current.value.length;
        }
      }, 30);
    }
  }, [isEditing, message.content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      showToast("Copied to clipboard", "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Failed to copy", "error");
    }
  };

  const handleSaveSubmit = () => {
    if (!editContent.trim()) return;
    setIsEditing(false);
    onSaveEdit?.(message.id, editContent.trim());
  };

  if (isUser) {
    return (
      <ErrorBoundary fallbackType="message">
        <div
          dir={isArabic ? "rtl" : "ltr"}
          className={`group relative my-4 flex flex-col ${
            isArabic ? "items-start" : "items-end"
          }`}
        >
          {isEditing ? (
            /* Inline textarea edit mode */
            <div className="w-full max-w-[85%] rounded-[14px] border border-composer-line bg-composer p-3 shadow-md font-sans">
              <textarea
                ref={editTextareaRef}
                rows={3}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveSubmit();
                  } else if (e.key === "Escape") {
                    setIsEditing(false);
                  }
                }}
                className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink focus:outline-none text-start"
              />
              <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-line/60 pt-2 text-[13px]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg px-3 py-1 text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSubmit}
                  className="rounded-lg bg-accent px-3.5 py-1 font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  Save &amp; Submit
                </button>
              </div>
            </div>
          ) : (
            /* Normal User Message Bubble */
            <div
              dir={isArabic ? "rtl" : "ltr"}
              className="relative max-w-[85%] rounded-[14px] bg-elev-2 px-4 py-3 text-[15.5px] leading-6 text-ink shadow-sm text-start"
            >
              {/* Attached files preview */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {message.attachments.map((att) =>
                    att.isImage ? (
                      <div
                        key={att.id}
                        className="overflow-hidden rounded-lg border border-line bg-black/30"
                      >
                        <img
                          src={att.url}
                          alt={att.name}
                          className="max-h-48 max-w-xs object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 rounded-lg border border-line bg-elev-1 px-2.5 py-1.5 text-[12.5px] text-ink-soft"
                      >
                        <FileText size={15} className="text-accent shrink-0" />
                        <span className="font-medium truncate max-w-[160px]">
                          {att.name}
                        </span>
                        <span className="text-ink-muted text-[11px] ms-auto">
                          {(att.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="whitespace-pre-wrap text-start">{message.content}</div>

              {/* Version Switcher and Hover actions under User Message */}
              <div
                className={`mt-2 flex items-center gap-1.5 ${
                  isArabic ? "justify-start" : "justify-end"
                }`}
              >
                {/* ‹ 2/3 › version switcher */}
                {hasMultipleVersions && (
                  <div className="flex items-center gap-0.5 rounded-md bg-elev-1 px-1.5 py-0.5 text-[12px] text-ink-muted select-none border border-line/60">
                    <button
                      type="button"
                      disabled={currentIndex === 0}
                      onClick={handlePrevVersion}
                      className="p-0.5 rounded hover:bg-elev-3 disabled:opacity-30 disabled:cursor-not-allowed text-ink-muted hover:text-ink transition-colors"
                      title="Previous version"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <span className="font-mono text-[11px] px-1 text-ink-soft">
                      {currentIndex + 1}/{siblings.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentIndex === siblings.length - 1}
                      onClick={handleNextVersion}
                      className="p-0.5 rounded hover:bg-elev-3 disabled:opacity-30 disabled:cursor-not-allowed text-ink-muted hover:text-ink transition-colors"
                      title="Next version"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}

                {/* Edit & Copy buttons visible on hover */}
                <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  {onSaveEdit && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      title="Edit message"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-elev-1 text-ink-muted transition-colors hover:bg-elev-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    >
                      <Pencil size={12} strokeWidth={1.9} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopy}
                    title="Copy message"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-elev-1 text-ink-muted transition-colors hover:bg-elev-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    {copied ? (
                      <Check size={12} strokeWidth={2} className="text-accent" />
                    ) : (
                      <Copy size={12} strokeWidth={1.9} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>
    );
  }

  // Claude Assistant message
  const isErrorState =
    !message.content && !message.isStreaming && !message.isThinking;

  return (
    <ErrorBoundary fallbackType="message">
      <div
        dir={isArabic ? "rtl" : "ltr"}
        className="group relative my-6 w-full max-w-[720px] mx-auto font-sans"
      >
        {/* Thought process block */}
        {(message.isThinking || message.thinking) && (
          <div className="mb-2">
            <ThoughtProcess
              isThinking={Boolean(message.isThinking)}
              thoughts={message.thinking}
            />
          </div>
        )}

        {/* Claude response body */}
        <div
          dir={isArabic ? "rtl" : "ltr"}
          className={`flex items-start gap-3 ${
            isArabic ? "flex-row-reverse text-start" : "text-start"
          }`}
        >
          <div className="mt-1 shrink-0">
            <ClaudeSpark size={20} className="text-accent" />
          </div>

          {/* aria-live="polite" on the streaming message for accessibility */}
          <div aria-live={message.isStreaming ? "polite" : undefined} className="min-w-0 flex-1 text-start">
            {/* Error handling state */}
            {isErrorState ? (
              <div className="rounded-xl border border-danger/30 bg-danger-bg p-3.5 text-[14px] text-ink font-sans">
                <div className="flex items-center gap-2 text-danger font-medium">
                  <AlertTriangle size={16} />
                  <span>Unable to generate complete response</span>
                </div>
                <p className="mt-1 text-[13px] text-ink-muted">
                  There was a temporary disruption while generating. You can try again.
                </p>
                {onRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry(message.id)}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-elev-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <RotateCcw size={13} />
                    <span>Retry response</span>
                  </button>
                )}
              </div>
            ) : message.content ? (
              <MarkdownView
                content={message.content}
                userPrompt={userPrompt}
                conversationId={conversationId}
                isStreaming={message.isStreaming}
                onOpenArtifact={openArtifact}
              />
            ) : message.isThinking ? null : (
              <span className="inline-block h-4 w-2 animate-pulse bg-ink-muted" />
            )}

            {/* Actions toolbar under Claude message */}
            {!message.isStreaming && message.content && (
              <div
                className={`mt-3 flex items-center gap-1.5 ${
                  isArabic ? "justify-end" : "justify-start"
                }`}
              >
                {/* ‹ 2/3 › version switcher for assistant responses */}
                {hasMultipleVersions && (
                  <div className="flex items-center gap-0.5 rounded-md bg-elev-1 px-1.5 py-0.5 text-[12px] text-ink-muted select-none border border-line/60 me-1">
                    <button
                      type="button"
                      disabled={currentIndex === 0}
                      onClick={handlePrevVersion}
                      className="p-0.5 rounded hover:bg-elev-3 disabled:opacity-30 disabled:cursor-not-allowed text-ink-muted hover:text-ink transition-colors"
                      title="Previous version"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <span className="font-mono text-[11px] px-1 text-ink-soft">
                      {currentIndex + 1}/{siblings.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentIndex === siblings.length - 1}
                      onClick={handleNextVersion}
                      className="p-0.5 rounded hover:bg-elev-3 disabled:opacity-30 disabled:cursor-not-allowed text-ink-muted hover:text-ink transition-colors"
                      title="Next version"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}

                {/* Hover actions */}
                <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={handleCopy}
                    title={copied ? "Copied" : "Copy response"}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    {copied ? (
                      <Check size={14} strokeWidth={2} className="text-accent" />
                    ) : (
                      <Copy size={14} strokeWidth={1.9} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setThumbs((curr) => {
                        const next = curr === "up" ? null : "up";
                        if (next) showToast("Response marked helpful", "success");
                        return next;
                      });
                    }}
                    title="Good response"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                      thumbs === "up" ? "text-accent bg-elev-2" : "text-ink-muted"
                    }`}
                  >
                    <ThumbsUp size={14} strokeWidth={1.9} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setThumbs((curr) => {
                        const next = curr === "down" ? null : "down";
                        if (next) showToast("Feedback recorded", "info");
                        return next;
                      });
                    }}
                    title="Bad response"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                      thumbs === "down" ? "text-accent bg-elev-2" : "text-ink-muted"
                    }`}
                  >
                    <ThumbsDown size={14} strokeWidth={1.9} />
                  </button>

                  {onRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(message.id)}
                      title="Retry response"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    >
                      <RotateCcw size={14} strokeWidth={1.9} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
