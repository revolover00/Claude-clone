import { useState, useRef, useEffect, useMemo } from "react";
import ClaudeSpark from "../icons/ClaudeSpark";
import MarkdownView from "./MarkdownView";
import ThoughtProcess from "./ThoughtProcess";
import ErrorBoundary from "../shared/ErrorBoundary";
import type { Message } from "../../types/chat";
import { isArabicText } from "../../utils/text";
import { detectArtifact } from "../../utils/artifactDetector";
import { useToast } from "../../context/ToastContext";
import { useChat, getMessageSiblings } from "../../context/ChatContext";
import GroundingSourcesView from "./GroundingSourcesView";
import AssistantErrorStateView from "./AssistantErrorStateView";
import AssistantMessageToolbar from "./AssistantMessageToolbar";
import TextSelectionTooltip from "./TextSelectionTooltip";
import { useArtifactSync } from "./useArtifactSync";
import { Globe } from "lucide-react";

interface AssistantMessageViewProps {
  message: Message;
  userPrompt: string;
  conversationId: string;
  onRetry?: (assistantMessageId: string, options?: { model?: string; modifier?: string }) => void;
  onContinue?: (assistantMessageId: string) => void;
  isLastAssistantMessage: boolean;
}

export default function AssistantMessageView({
  message,
  userPrompt,
  conversationId,
  onRetry,
  onContinue,
  isLastAssistantMessage,
}: AssistantMessageViewProps) {
  const { showToast } = useToast();
  const {
    activeConversation, openArtifact, saveOrUpdateArtifact, updateActiveArtifactLive,
    switchMessageVersion, setActiveQuote, artifactPanelOpen, activeArtifact, setSettingsModalOpen,
  } = useChat();

  const [copied, setCopied] = useState(false);
  const [thumbs, setThumbs] = useState<"up" | "down" | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [thumbsDownPopoverOpen, setThumbsDownPopoverOpen] = useState(false);
  const [retryDropdownOpen, setRetryDropdownOpen] = useState(false);
  const [speechState, setSpeechState] = useState<"idle" | "playing" | "paused">("idle");
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [showMemoryUpdatedChip, setShowMemoryUpdatedChip] = useState(false);

  useEffect(() => {
    if (!isLastAssistantMessage) return;

    const handleMemoryUpdated = () => {
      setShowMemoryUpdatedChip(true);
      const timer = setTimeout(() => {
        setShowMemoryUpdatedChip(false);
      }, 6000);
      return () => clearTimeout(timer);
    };

    window.addEventListener("claude:memory-updated", handleMemoryUpdated);
    return () => window.removeEventListener("claude:memory-updated", handleMemoryUpdated);
  }, [isLastAssistantMessage]);

  const handleManageMemory = () => {
    localStorage.setItem("claude_clone_settings_tab", "memory");
    setSettingsModalOpen(true);
    setShowMemoryUpdatedChip(false);
  };

  const dropdownRef = useRef<HTMLDivElement>(null);
  const isArabic = isArabicText(message.content);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`feedback_${message.id}`);
      if (saved) setThumbs(JSON.parse(saved).thumbs);
    } catch { /* ignore */ }
  }, [message.id]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (retryDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRetryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [retryDropdownOpen]);

  const convMessages = activeConversation?.messages;
  const { siblings, currentIndex } = useMemo(() => {
    return getMessageSiblings(convMessages || [], message.id);
  }, [convMessages, message.id]);

  const hasMultipleVersions = siblings.length > 1;

  const handlePrevVersion = () => {
    if (currentIndex > 0 && conversationId) switchMessageVersion(conversationId, message.id, currentIndex - 1);
  };

  const handleNextVersion = () => {
    if (currentIndex < siblings.length - 1 && conversationId) switchMessageVersion(conversationId, message.id, currentIndex + 1);
  };

  const detected = useMemo(() => {
    if (!message.content) return null;
    return detectArtifact(message.content, userPrompt);
  }, [message.content, userPrompt]);

  useArtifactSync({
    message, detected, conversationId, artifactPanelOpen, activeArtifact,
    openArtifact, updateActiveArtifactLive, saveOrUpdateArtifact,
  });

  const handleCopy = async (e?: React.MouseEvent) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      showToast(e?.shiftKey ? "Copied raw markdown to clipboard" : "Copied to clipboard", "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Failed to copy", "error");
    }
  };

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
      utterance.onend = () => setSpeechState("idle");
      utterance.onerror = () => setSpeechState("idle");
      window.speechSynthesis.speak(utterance);
      setSpeechState("playing");
    }
  };

  useEffect(() => {
    return () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); };
  }, []);

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
        setSelection({ text: sel.toString().trim(), x: rects.left + rects.width / 2, y: rects.top - 46 });
      }
    } else {
      setSelection(null);
    }
  };

  useEffect(() => {
    const handleGlobalSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setSelection(null);
    };
    document.addEventListener("selectionchange", handleGlobalSelectionChange);
    return () => document.removeEventListener("selectionchange", handleGlobalSelectionChange);
  }, []);

  const isErrorState = Boolean(message.isError || (!message.content && !message.isStreaming && !message.isThinking));
  const displayErrorMessage = message.errorText || "Unable to generate complete response";
  const messageDate = new Date(message.createdAt || Date.now());
  const timeStr = messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fullDateStr = messageDate.toLocaleString([], { dateStyle: "full", timeStyle: "medium" });

  return (
    <ErrorBoundary fallbackType="message">
      <div
        id={`msg-${message.id}`}
        dir={isArabic ? "rtl" : "ltr"}
        className="group relative my-6 w-full max-w-[720px] mx-auto font-sans text-start"
      >
        <TextSelectionTooltip
          selection={selection}
          onCopy={() => {
            if (selection) navigator.clipboard.writeText(selection.text);
            showToast("Selected text copied", "success");
            window.getSelection()?.removeAllRanges();
            setSelection(null);
          }}
          onQuote={() => {
            if (selection) setActiveQuote(selection.text);
            showToast("Quote added to composer", "info");
            window.getSelection()?.removeAllRanges();
            setSelection(null);
          }}
        />

        {(message.isThinking || message.thinking) && (
          <div className="mb-2">
            <ThoughtProcess
              isThinking={Boolean(message.isThinking)}
              thoughts={message.thinking}
              thinkingStartedAt={message.thinkingStartedAt}
              firstTokenAt={message.firstTokenAt}
              thinkingMs={message.thinkingMs}
              hasAnswerToken={!message.isThinking}
            />
          </div>
        )}

        <div
          dir={isArabic ? "rtl" : "ltr"}
          className={`flex items-start gap-3 ${isArabic ? "flex-row-reverse text-start" : "text-start"}`}
        >
          <div className="mt-1 shrink-0 select-none">
            <ClaudeSpark size={20} className="text-accent" />
          </div>

          <div aria-live={message.isStreaming ? "polite" : undefined} className="min-w-0 flex-1 text-start">
            {(message.isSearchingWeb || (message.sources && message.sources.length > 0)) && (
              <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-elev-1 px-2.5 py-0.5 text-[12px] text-ink-muted select-none">
                <Globe size={13} className={`text-accent ${message.isStreaming && !message.content ? "animate-pulse" : ""}`} />
                <span>{message.isStreaming && !message.content ? "Searching the web..." : "Searched the web"}</span>
              </div>
            )}

            {(isErrorState || message.finishReason === "SAFETY") ? (
              <AssistantErrorStateView
                messageId={message.id} isErrorState={isErrorState} displayErrorMessage={displayErrorMessage}
                showErrorDetails={showErrorDetails} setShowErrorDetails={setShowErrorDetails}
                errorDetails={message.errorDetails} finishReason={message.finishReason} onRetry={onRetry}
              />
            ) : message.content ? (
              <>
                <div
                  id={`msg-bubble-${message.id}`}
                  className="relative select-text"
                  onMouseUp={handleTextSelection}
                  onKeyUp={handleTextSelection}
                >
                  <MarkdownView
                    content={message.content} userPrompt={userPrompt} conversationId={conversationId}
                    isStreaming={message.isStreaming} onOpenArtifact={openArtifact}
                  />
                </div>

                <GroundingSourcesView sources={message.sources || []} />
                
                {showMemoryUpdatedChip && (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/5 px-2.5 py-1 text-[11.5px] text-accent animate-fade-in select-none">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                    <span>Memory updated</span>
                    <button
                      onClick={handleManageMemory}
                      className="font-semibold underline cursor-pointer hover:text-accent/80 ml-1"
                    >
                      Manage
                    </button>
                  </div>
                )}
              </>
            ) : message.isThinking ? null : message.isStreaming ? (
              <span className="inline-flex items-center align-middle ms-1 select-none">
                <ClaudeSpark size={14} className="anim-thinking-spark text-accent" />
              </span>
            ) : null}

            {!message.isStreaming && (message.content || message.finishReason === "SAFETY") && message.finishReason !== "SAFETY" && (
              <AssistantMessageToolbar
                message={message} isArabic={isArabic} hasMultipleVersions={hasMultipleVersions}
                currentIndex={currentIndex} siblingsLength={siblings.length}
                onPrevVersion={handlePrevVersion} onNextVersion={handleNextVersion}
                timeStr={timeStr} fullDateStr={fullDateStr} copied={copied}
                handleCopy={handleCopy} handleReadAloud={handleReadAloud} speechState={speechState}
                thumbs={thumbs} setThumbs={setThumbs} thumbsDownPopoverOpen={thumbsDownPopoverOpen}
                setThumbsDownPopoverOpen={setThumbsDownPopoverOpen} retryDropdownOpen={retryDropdownOpen}
                setRetryDropdownOpen={setRetryDropdownOpen} onRetry={onRetry} onContinue={onContinue}
                isLastAssistantMessage={isLastAssistantMessage} dropdownRef={dropdownRef}
              />
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
