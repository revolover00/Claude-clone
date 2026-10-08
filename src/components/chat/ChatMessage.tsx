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
  Globe,
  ExternalLink,
  Volume2,
  VolumeX,
  Quote,
  ChevronDown,
  Play,
  RefreshCw,
} from "lucide-react";
import ClaudeSpark from "../icons/ClaudeSpark";
import MarkdownView from "./MarkdownView";
import ThoughtProcess from "./ThoughtProcess";
import ErrorBoundary from "../shared/ErrorBoundary";
import type { Message, Artifact } from "../../types/chat";
import { isArabicText } from "../../utils/text";
import { detectArtifact } from "../../utils/artifactDetector";
import { useToast } from "../../context/ToastContext";
import { useChat, getMessageSiblings } from "../../context/ChatContext";

type Props = {
  message: Message;
  userPrompt?: string;
  conversationId?: string;
  onSaveEdit?: (messageId: string, newContent: string) => void;
  onRetry?: (assistantMessageId: string, options?: { model?: string; modifier?: string }) => void;
  onContinue?: (assistantMessageId: string) => void;
  isLastAssistantMessage?: boolean;
};

export default function ChatMessage({
  message,
  userPrompt = "",
  conversationId = "",
  onSaveEdit,
  onRetry,
  onContinue,
  isLastAssistantMessage = false,
}: Props) {
  const { showToast } = useToast();
  const {
    activeConversation,
    openArtifact,
    saveOrUpdateArtifact,
    updateActiveArtifactLive,
    switchMessageVersion,
    setActiveQuote,
    artifactPanelOpen,
    activeArtifact,
  } = useChat();

  const [copied, setCopied] = useState(false);
  const [thumbs, setThumbs] = useState<"up" | "down" | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Thumbs Down Popover State
  const [thumbsDownPopoverOpen, setThumbsDownPopoverOpen] = useState(false);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");

  // Retry Dropdown State
  const [retryDropdownOpen, setRetryDropdownOpen] = useState(false);

  // Speech Synthesis state
  const [speechState, setSpeechState] = useState<"idle" | "playing" | "paused">("idle");

  // Selection floating toolbar state
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);

  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isUser = message.role === "user";
  const isArabic = isArabicText(message.content);

  // Load local feedback if exists
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`feedback_${message.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setThumbs(parsed.thumbs);
        if (parsed.reason) setFeedbackReason(parsed.reason);
        if (parsed.comment) setFeedbackComment(parsed.comment);
      }
    } catch {
      // ignore
    }
  }, [message.id]);

  // Click outside to close custom popovers
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (thumbsDownPopoverOpen && popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setThumbsDownPopoverOpen(false);
      }
      if (retryDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRetryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [thumbsDownPopoverOpen, retryDropdownOpen]);

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

  // If streaming and artifact is active, update its code live & open panel automatically
  useEffect(() => {
    if (message.isStreaming && detected?.code && detected.title) {
      const art: Artifact = {
        id: `art-${detected.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        identifier: detected.title.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        title: detected.title,
        language: detected.language,
        type: detected.type,
        code: detected.code,
        chatId: conversationId,
        chatTitle: "",
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isStreaming: true,
      };

      // Auto-open panel on the Code tab when starting to stream a qualified artifact
      if (!artifactPanelOpen || !activeArtifact || activeArtifact.title.toLowerCase() !== detected.title.toLowerCase()) {
        openArtifact(art);
      } else {
        // Keep code and streaming state updated live
        updateActiveArtifactLive(detected.title, detected.code, true);
      }
    }
  }, [
    message.isStreaming,
    detected,
    artifactPanelOpen,
    activeArtifact,
    openArtifact,
    updateActiveArtifactLive,
    conversationId,
  ]);

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
      // Mark active artifact as finished streaming so panel transitions to preview
      updateActiveArtifactLive(detected.title, detected.code, false);
    }
  }, [detected, message.isStreaming, saveOrUpdateArtifact, updateActiveArtifactLive, conversationId]);

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

  const handleCopy = async (e?: React.MouseEvent) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      if (e?.shiftKey) {
        showToast("Copied raw markdown to clipboard", "success");
      } else {
        showToast("Copied to clipboard", "success");
      }
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

  // User Message Collapse Logic
  const userLines = message.content.split("\n");
  const isUserCollapsible = userLines.length > 12;
  const [isUserCollapsed, setIsUserCollapsed] = useState(isUserCollapsible);

  const messageDate = new Date(message.createdAt || Date.now());
  const timeStr = messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fullDateStr = messageDate.toLocaleString([], { dateStyle: "full", timeStyle: "medium" });

  // Read aloud TTS
  const handleReadAloud = () => {
    if (speechState === "playing") {
      window.speechSynthesis.pause();
      setSpeechState("paused");
    } else if (speechState === "paused") {
      window.speechSynthesis.resume();
      setSpeechState("playing");
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message.content);
      utterance.lang = isArabicText(message.content) ? "ar-SA" : "en-US";
      utterance.onend = () => {
        setSpeechState("idle");
      };
      utterance.onerror = () => {
        setSpeechState("idle");
      };
      window.speechSynthesis.speak(utterance);
      setSpeechState("playing");
    }
  };

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Selection captures
  const handleTextSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const bubbleElement = document.getElementById(`msg-bubble-${message.id}`);
    if (bubbleElement && bubbleElement.contains(range.commonAncestorContainer)) {
      const rects = range.getBoundingClientRect();
      if (rects) {
        setSelection({
          text: sel.toString().trim(),
          x: rects.left + rects.width / 2,
          y: rects.top - 46,
        });
      }
    } else {
      setSelection(null);
    }
  };

  useEffect(() => {
    const handleGlobalSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection(null);
      }
    };
    document.addEventListener("selectionchange", handleGlobalSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleGlobalSelectionChange);
    };
  }, []);

  const handleSelectionCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selection) return;
    try {
      await navigator.clipboard.writeText(selection.text);
      showToast("Selected text copied", "success");
    } catch {
      showToast("Failed to copy", "error");
    }
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  };

  const handleSelectionQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selection) return;
    setActiveQuote(selection.text);
    showToast("Quote added to composer", "info");
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  };

  // Feedback Submit Form
  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackReason) {
      showToast("Please choose a reason", "error");
      return;
    }
    try {
      localStorage.setItem(
        `feedback_${message.id}`,
        JSON.stringify({ thumbs: "down", reason: feedbackReason, comment: feedbackComment })
      );
      setThumbs("down");
      setThumbsDownPopoverOpen(false);
      showToast("Thank you for your valuable feedback!", "success");
    } catch {
      showToast("Failed to record feedback", "error");
    }
  };

  if (isUser) {
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
              {/* Normal User Message Bubble */}
              <div
                dir={isArabic ? "rtl" : "ltr"}
                className="relative max-w-[85%] rounded-[14px] bg-elev-2 px-3.5 py-2.5 text-[15px] leading-relaxed text-ink shadow-xs text-start"
              >
                {/* Attached files preview */}
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

              {/* Version Switcher and Hover actions UNDER User Message */}
              <div
                className={`mt-1 flex items-center gap-2 ${
                  isArabic ? "justify-start" : "justify-end"
                }`}
              >
                {/* Full date tooltip on hover over timestamp */}
                <span 
                  className="text-[11px] text-ink-muted/80 select-none cursor-help font-sans hover:text-ink-soft transition-colors select-none"
                  title={fullDateStr}
                  aria-label={`Sent at ${fullDateStr}`}
                >
                  {timeStr}
                </span>

                {/* ‹ 2/3 › version switcher */}
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

                {/* Edit & Copy buttons visible on hover */}
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
                    onClick={() => handleCopy()}
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

  // Claude Assistant message
  const isErrorState =
    Boolean(message.isError || (!message.content && !message.isStreaming && !message.isThinking));
  const displayErrorMessage = message.errorText || "Unable to generate complete response";

  return (
    <ErrorBoundary fallbackType="message">
      <div
        id={`msg-${message.id}`}
        dir={isArabic ? "rtl" : "ltr"}
        className="group relative my-6 w-full max-w-[720px] mx-auto font-sans text-start"
      >
        {/* Selection Floating Toolbar (portal styled with viewport fixed positioning) */}
        {selection && (
          <div
            style={{
              position: "fixed",
              top: `${selection.y}px`,
              left: `${selection.x}px`,
              transform: "translate(-50%, -100%)",
              zIndex: 1000,
            }}
            className="flex items-center gap-1 rounded-lg border border-line bg-[#1e1c1a] p-1 shadow-lg anim-fade-in anim-sheet-up font-sans"
          >
            <button
              type="button"
              onClick={handleSelectionCopy}
              className="inline-flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-white hover:bg-[#2e2b28] transition-colors font-medium cursor-pointer"
              aria-label="Copy selected text"
            >
              <Copy size={13} />
              <span>Copy</span>
            </button>
            <div className="h-4 w-px bg-line/60 mx-0.5" />
            <button
              type="button"
              onClick={handleSelectionQuote}
              className="inline-flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-white hover:bg-[#2e2b28] transition-colors font-medium cursor-pointer"
              aria-label="Quote selected text"
            >
              <Quote size={13} />
              <span>Quote</span>
            </button>
          </div>
        )}

        {/* Thought process block */}
        {(message.isThinking || message.thinking) && (
          <div className="mb-2">
            <ThoughtProcess
              isThinking={Boolean(message.isThinking)}
              thoughts={message.thinking}
              thinkingStartedAt={message.thinkingStartedAt}
              firstTokenAt={message.firstTokenAt}
              thinkingMs={message.thinkingMs}
              hasAnswerToken={Boolean(message.content)}
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
          <div className="mt-1 shrink-0 select-none">
            <ClaudeSpark size={20} className="text-accent" />
          </div>

          {/* aria-live="polite" on the streaming message for accessibility */}
          <div aria-live={message.isStreaming ? "polite" : undefined} className="min-w-0 flex-1 text-start">
            {/* Reconnecting badge */}
            {message.isReconnecting && (
              <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[12px] text-accent select-none animate-pulse">
                <RefreshCw size={13} className="animate-spin text-accent shrink-0" />
                <span className="font-medium">Reconnecting...</span>
              </div>
            )}

            {/* Web search status indicator */}
            {(message.isSearchingWeb || (message.sources && message.sources.length > 0)) && (
              <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-elev-1 px-2.5 py-0.5 text-[12px] text-ink-muted select-none">
                <Globe size={13} className={`text-accent ${message.isStreaming && !message.content ? "animate-pulse" : ""}`} />
                <span>{message.isStreaming && !message.content ? "Searching the web..." : "Searched the web"}</span>
              </div>
            )}

            {/* Error handling state */}
            {isErrorState ? (
              <div className="rounded-xl border border-danger/30 bg-danger-bg p-3.5 text-[14px] text-ink font-sans">
                <div className="flex items-center gap-2 text-danger font-medium">
                  <AlertTriangle size={16} />
                  <span>{displayErrorMessage}</span>
                </div>
                <p className="mt-1 text-[13px] text-ink-muted">
                  There was a temporary disruption while generating. You can try again.
                </p>

                {message.errorDetails && (
                  <div className="mt-2 text-[12px]">
                    <button
                      type="button"
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-muted underline underline-offset-2 hover:text-ink transition-colors cursor-pointer"
                    >
                      {showErrorDetails ? "Hide Details" : "Show Details"}
                    </button>
                    {showErrorDetails && (
                      <pre className="mt-1.5 max-h-36 overflow-x-auto rounded bg-black/40 p-2 font-mono text-[11px] text-ink-soft whitespace-pre-wrap break-all border border-line/40 select-text">
                        {message.errorDetails}
                      </pre>
                    )}
                  </div>
                )}

                {onRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry(message.id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-elev-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
                    aria-label="Retry generating response"
                  >
                    <RotateCcw size={13} />
                    <span>Retry response</span>
                  </button>
                )}
              </div>
            ) : message.content ? (
              <>
                <div 
                  id={`msg-bubble-${message.id}`}
                  className="relative select-text"
                  onMouseUp={handleTextSelection}
                  onKeyUp={handleTextSelection}
                >
                  <MarkdownView
                    content={message.content}
                    userPrompt={userPrompt}
                    conversationId={conversationId}
                    isStreaming={message.isStreaming}
                    onOpenArtifact={openArtifact}
                  />
                </div>

                {/* Sources row with favicon + domain chips opening in a new tab */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3.5 pt-2.5 border-t border-line/40 select-none">
                    <div className="text-[11.5px] font-medium uppercase tracking-wider text-ink-faint mb-2 select-none">
                      Sources
                    </div>
                    <div className="flex flex-wrap gap-1.5 select-none">
                      {message.sources.map((src, idx) => {
                        let domain: string;
                        try {
                          domain = new URL(src.url).hostname.replace(/^www\./, "");
                        } catch {
                          domain = src.title || "source";
                        }
                        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

                        return (
                          <a
                            key={`${src.url}-${idx}`}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elev-1 px-2.5 py-1 text-[12px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors max-w-[240px]"
                            title={src.title}
                          >
                            <img
                              src={faviconUrl}
                              alt=""
                              className="h-3.5 w-3.5 shrink-0 rounded-xs"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <span className="truncate font-medium">{domain}</span>
                            <ExternalLink size={10} className="shrink-0 text-ink-faint" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : message.isThinking ? null : message.isStreaming ? (
              <span className="inline-flex items-center align-middle ms-1 select-none">
                <ClaudeSpark size={14} className="anim-thinking-spark text-accent" />
              </span>
            ) : null}

            {/* Actions toolbar under Claude message */}
            {!message.isStreaming && message.content && (
              <div
                className={`mt-3.5 flex items-center gap-2 relative ${
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
                      className="p-0.5 rounded hover:bg-elev-3 disabled:opacity-30 disabled:cursor-not-allowed text-ink-muted hover:text-ink transition-colors cursor-pointer"
                      title="Previous version"
                      aria-label="Previous response version"
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
                      aria-label="Next response version"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}

                {/* Date/Time stamp */}
                <span 
                  className="text-[11px] text-ink-muted/70 select-none cursor-help font-sans hover:text-ink-soft transition-colors select-none me-1"
                  title={fullDateStr}
                  aria-label={`Generated at ${fullDateStr}`}
                >
                  {timeStr}
                </span>

                {/* Actions group: always visible for the last assistant response, or visible on hover for older ones */}
                <div className={`flex items-center gap-1 transition-opacity duration-150 relative ${
                  isLastAssistantMessage ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}>
                  {/* Copy Button (Shift+click captures raw markdown) */}
                  <button
                    type="button"
                    onClick={(e) => handleCopy(e)}
                    title={copied ? "Copied" : "Copy response (Shift + Click to copy raw)"}
                    aria-label="Copy response to clipboard"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
                  >
                    {copied ? (
                      <Check size={14} strokeWidth={2} className="text-accent animate-pulse" />
                    ) : (
                      <Copy size={14} strokeWidth={1.9} />
                    )}
                  </button>

                  {/* Speech Synthesis Read Aloud Button */}
                  <button
                    type="button"
                    onClick={handleReadAloud}
                    title={speechState === "playing" ? "Pause speech synthesis" : "Read aloud (Text-to-Speech)"}
                    aria-label={speechState === "playing" ? "Pause read aloud" : "Read aloud response"}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer ${
                      speechState === "playing" ? "text-accent bg-elev-2" : "text-ink-muted"
                    }`}
                  >
                    {speechState === "playing" ? (
                      <VolumeX size={14} strokeWidth={2} className="animate-pulse" />
                    ) : (
                      <Volume2 size={14} strokeWidth={1.9} />
                    )}
                  </button>

                  {/* Thumbs Up Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setThumbs((curr) => {
                        const next = curr === "up" ? null : "up";
                        if (next) {
                          localStorage.setItem(`feedback_${message.id}`, JSON.stringify({ thumbs: "up" }));
                          showToast("Response marked helpful", "success");
                        } else {
                          localStorage.removeItem(`feedback_${message.id}`);
                        }
                        return next;
                      });
                    }}
                    title="Helpful response"
                    aria-label="Mark response as helpful"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer ${
                      thumbs === "up" ? "text-accent bg-elev-2" : "text-ink-muted"
                    }`}
                  >
                    <ThumbsUp size={14} strokeWidth={1.9} />
                  </button>

                  {/* Thumbs Down Button with custom feedback popover */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setThumbsDownPopoverOpen(!thumbsDownPopoverOpen)}
                      title="Unhelpful response"
                      aria-label="Provide details about unhelpful response"
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer ${
                        thumbs === "down" ? "text-accent bg-elev-2" : "text-ink-muted"
                      }`}
                    >
                      <ThumbsDown size={14} strokeWidth={1.9} />
                    </button>

                    {/* Feedback Popover Form */}
                    {thumbsDownPopoverOpen && (
                      <div
                        ref={popoverRef}
                        className="absolute bottom-9 left-0 z-30 w-64 rounded-xl border border-line bg-[#1e1c1a] p-3 shadow-xl anim-fade-in font-sans text-start"
                      >
                        <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-2.5">
                          <h4 className="text-[12.5px] font-bold text-ink uppercase tracking-wider">
                            Feedback Reason
                          </h4>
                          <div className="flex flex-col gap-1.5 text-[12px] text-ink-soft">
                            {[
                              "Incorrect / misleading info",
                              "Incomplete / cut short",
                              "Poor formatting / code bugs",
                              "Too long / verbose",
                              "Other",
                            ].map((reason) => (
                              <label key={reason} className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-ink transition-colors">
                                <input
                                  type="radio"
                                  name="reason"
                                  value={reason}
                                  checked={feedbackReason === reason}
                                  onChange={(e) => setFeedbackReason(e.target.value)}
                                  className="accent-accent shrink-0 cursor-pointer"
                                />
                                <span className="truncate">{reason}</span>
                              </label>
                            ))}
                          </div>
                          
                          <textarea
                            rows={2}
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                            placeholder="Optional comments..."
                            className="w-full rounded border border-line/60 bg-elev-1 p-1.5 text-[11.5px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent/50 resize-none"
                          />

                          <div className="flex justify-end gap-1.5 text-[11px] font-semibold">
                            <button
                              type="button"
                              onClick={() => setThumbsDownPopoverOpen(false)}
                              className="rounded px-2.5 py-1 text-ink-soft hover:bg-elev-2 hover:text-ink cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="rounded bg-accent text-white px-3 py-1 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                            >
                              Submit
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>

                  {/* Retry Custom Dropdown */}
                  {onRetry && (
                    <div className="relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setRetryDropdownOpen(!retryDropdownOpen)}
                        title="Retry options"
                        aria-label="Open retry response directives"
                        className="inline-flex h-7 px-1.5 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer text-[11px] font-medium gap-0.5"
                      >
                        <RotateCcw size={13} strokeWidth={1.9} />
                        <ChevronDown size={11} strokeWidth={2} />
                      </button>

                      {retryDropdownOpen && (
                        <div className="absolute bottom-9 left-0 z-30 w-52 rounded-xl border border-line bg-[#1e1c1a] py-1.5 shadow-xl anim-fade-in font-sans text-start">
                          <button
                            type="button"
                            onClick={() => {
                              setRetryDropdownOpen(false);
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
                          
                          <button
                            type="button"
                            onClick={() => {
                              setRetryDropdownOpen(false);
                              onRetry(message.id, { model: "sonnet-5" });
                            }}
                            className="w-full text-start px-4 py-1 text-[12px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer"
                          >
                            Sonnet 3.5 (Fast Reasoning)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRetryDropdownOpen(false);
                              onRetry(message.id, { model: "opus-5" });
                            }}
                            className="w-full text-start px-4 py-1 text-[12px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer"
                          >
                            Opus 3.1 Pro
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRetryDropdownOpen(false);
                              onRetry(message.id, { model: "haiku-4-5" });
                            }}
                            className="w-full text-start px-4 py-1 text-[12px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer"
                          >
                            Haiku 4.5 (Speed Lite)
                          </button>

                          <div className="h-px bg-line/60 my-1 mx-2" />
                          <div className="px-3 py-0.5 text-[10px] font-semibold text-ink-faint uppercase select-none">
                            Directives
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setRetryDropdownOpen(false);
                              onRetry(message.id, { modifier: "Make the response much shorter, compact, and concise." });
                            }}
                            className="w-full text-start px-4 py-1 text-[12px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer"
                          >
                            Make it shorter
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRetryDropdownOpen(false);
                              onRetry(message.id, { modifier: "Provide a highly comprehensive, expanded explanation with step-by-step details." });
                            }}
                            className="w-full text-start px-4 py-1 text-[12px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer"
                          >
                            Make it more detailed
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Continue Button for incomplete / max token responses, visible only on last assistant message */}
                  {isLastAssistantMessage && onContinue && (
                    <button
                      type="button"
                      onClick={() => onContinue(message.id)}
                      title="Continue generating where the AI left off"
                      aria-label="Continue writing response"
                      className="inline-flex h-7 px-2.5 items-center justify-center rounded-md border border-line bg-elev-1 hover:bg-elev-3 hover:text-ink text-ink-soft font-semibold transition-all duration-150 text-[11.5px] cursor-pointer shadow-xs gap-1.5 select-none"
                    >
                      <Play size={11} fill="currentColor" strokeWidth={0} />
                      <span>Continue</span>
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
