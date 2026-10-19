import { useState, useRef, useEffect } from "react";
import { Copy, Check, Pencil, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import ErrorBoundary from "../shared/ErrorBoundary";
import type { Message } from "../../types/chat";
import { isArabicText } from "../../utils/text";
import { useToast } from "../../context/ToastContext";
import { useChat } from "../../context/ChatContext";

interface UserMessageViewProps {
  message: Message;
  conversationId: string;
  onSaveEdit?: (messageId: string, newContent: string) => void;
  siblings: Message[];
  currentIndex: number;
}

export default function UserMessageView({
  message,
  conversationId,
  onSaveEdit,
  siblings,
  currentIndex,
}: UserMessageViewProps) {
  const { showToast } = useToast();
  const { switchMessageVersion } = useChat();

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isArabic = isArabicText(message.content);
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

  const userLines = message.content.split("\n");
  const isUserCollapsible = userLines.length > 12;
  const [isUserCollapsed, setIsUserCollapsed] = useState(isUserCollapsible);

  const messageDate = new Date(message.createdAt || Date.now());
  const timeStr = messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fullDateStr = messageDate.toLocaleString([], { dateStyle: "full", timeStyle: "medium" });

  return (
    <ErrorBoundary fallbackType="message">
      <div
        id={`msg-${message.id}`}
        dir={isArabic ? "rtl" : "ltr"}
        className={`group relative my-4 flex flex-col ${
          isArabic ? "items-start" : "items-end"
        }`}
      >
        {isEditing ? (
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
              aria-label="Edit your message"
            />
            <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-line/60 pt-2 text-[13px]">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg px-3 py-1 text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSubmit}
                className="rounded-lg bg-accent px-3.5 py-1 font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
              >
                Save &amp; Submit
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              dir={isArabic ? "rtl" : "ltr"}
              className="relative max-w-[85%] rounded-[14px] bg-elev-2 px-3.5 py-2.5 text-[15px] leading-relaxed text-ink shadow-xs text-start"
            >
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
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
                        <span className="text-ink-muted text-[11px] ms-auto select-none">
                          {(att.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="whitespace-pre-wrap break-words text-start">
                {isUserCollapsed 
                  ? userLines.slice(0, 10).join("\n") + "\n..." 
                  : message.content.trim()}
              </div>

              {isUserCollapsible && (
                <button
                  type="button"
                  onClick={() => setIsUserCollapsed(!isUserCollapsed)}
                  className="mt-2 text-[12.5px] font-semibold text-accent hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 cursor-pointer"
                  aria-label={isUserCollapsed ? "Show all text of message" : "Collapse message text"}
                >
                  {isUserCollapsed ? "Show more" : "Show less"}
                </button>
              )}
            </div>

            <div
              className={`mt-1 flex items-center gap-2 ${
                isArabic ? "justify-start" : "justify-end"
              }`}
            >
              <span 
                className="text-[11px] text-ink-muted/80 select-none cursor-help font-sans hover:text-ink-soft transition-colors select-none"
                title={fullDateStr}
                aria-label={`Sent at ${fullDateStr}`}
              >
                {timeStr}
              </span>

              {hasMultipleVersions && (
                <div className="flex items-center gap-0.5 rounded-md bg-elev-1 px-1.5 py-0.5 text-[12px] text-ink-muted select-none border border-line/60">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={handlePrevVersion}
                    className="p-0.5 rounded hover:bg-elev-3 disabled:opacity-30 disabled:cursor-not-allowed text-ink-muted hover:text-ink transition-colors cursor-pointer"
                    title="Previous version"
                    aria-label="Previous message version"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="font-mono text-[11px] px-1 text-ink-soft select-none">
                    {currentIndex + 1}/{siblings.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentIndex === siblings.length - 1}
                    onClick={handleNextVersion}
                    className="p-0.5 rounded hover:bg-elev-3 disabled:opacity-30 disabled:cursor-not-allowed text-ink-muted hover:text-ink transition-colors cursor-pointer"
                    title="Next version"
                    aria-label="Next message version"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {onSaveEdit && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    title="Edit message"
                    aria-label="Edit your user message"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-elev-1 text-ink-muted transition-colors hover:bg-elev-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
                  >
                    <Pencil size={12} strokeWidth={1.9} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy message"
                  aria-label="Copy your message content"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-elev-1 text-ink-muted transition-colors hover:bg-elev-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
                >
                  {copied ? (
                    <Check size={12} strokeWidth={2} className="text-accent" />
                  ) : (
                    <Copy size={12} strokeWidth={1.9} />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
