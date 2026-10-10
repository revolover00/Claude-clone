import { SmoothStreamer } from "../../utils/smoothStreamer";
import { streamRealResponse } from "../../utils/streamResponse";
import type { Message, Project } from "../../types/chat";
import { useRetryStream } from "./useRetryStream";
import { useChat } from "../../context/ChatContext";

interface EditRetryStreamOptions {
  activeConversationId: string | null;
  activeBranch: Message[];
  updateMessageContent: (
    conversationId: string,
    messageId: string,
    content: string,
    isStreaming?: boolean,
    isThinking?: boolean,
    thinking?: string,
    errorInfo?: { isError?: boolean; errorText?: string; errorDetails?: string },
    sources?: Array<{ title: string; url: string }>,
    isSearchingWeb?: boolean,
    timing?: { thinkingStartedAt?: number; firstTokenAt?: number; thinkingMs?: number },
    isReconnecting?: boolean,
    finishReason?: string,
    extra?: { extendedThinking?: boolean; thinkingPlan?: { level: "low" | "medium" | "high"; reason?: string } }
  ) => void;
  preferences: any;
  currentProject: Project | undefined;
  branchEditUserMessage: (conversationId: string, targetMessageId: string, newContent: string) => any;
  branchRetryAssistantMessage: (conversationId: string, assistantMessageId: string) => any;
  setIsStreaming: (streaming: boolean) => void;
  scrollToBottom: (smooth: boolean) => void;
  scrollToUserMessage: (msgId: string) => void;
  abortRef: React.RefObject<AbortController | null>;
  streamerRef: React.RefObject<SmoothStreamer | null>;
  lastOptions: any;
}

export function useEditRetryStream(options: EditRetryStreamOptions) {
  const {
    activeConversationId,
    activeBranch,
    updateMessageContent,
    preferences,
    currentProject,
    branchEditUserMessage,
    setIsStreaming,
    scrollToBottom,
    abortRef,
    streamerRef,
    lastOptions,
  } = options;

  const { activeConversation } = useChat();

  const messages = activeBranch;

  const handleSaveEdit = (messageId: string, newContent: string) => {
    if (!activeConversationId) return;

    (abortRef as any).current?.abort();
    const abortCtrl = new AbortController();
    (abortRef as any).current = abortCtrl;

    let thinkingStartTime = lastOptions.extendedThinking ? Date.now() : undefined;
    let firstTokenTimestamp: number | undefined;
    let thinkingDurationMs: number | undefined;

    const res = branchEditUserMessage(activeConversationId, messageId, newContent);
    if (!res) return;

    const { newAssistantMsg } = res;
    setIsStreaming(true);
    setTimeout(() => scrollToBottom(true), 80);

    const contextBranch = messages.slice(0, messages.findIndex((m) => m.id === messageId));
    const projInstructions = currentProject?.instructions || undefined;
    const projKnowledge = currentProject?.knowledge?.map((k) => ({
      title: k.title,
      content: k.content,
    })) || undefined;

    let receivedSources: Array<{ title: string; url: string }> | undefined;
    let accumulatedThoughts = "";
    let latestFinishReason: string | undefined;
    let receivedPlan: { level: "low" | "medium" | "high"; reason?: string } | undefined;

    const streamer = new SmoothStreamer({
      onUpdate: (displayedText, isFinished) => {
        const isThinkingActive = (lastOptions.extendedThinking || (receivedPlan && receivedPlan.level !== "low")) && !firstTokenTimestamp;
        updateMessageContent(
          activeConversationId, newAssistantMsg.id, displayedText, !isFinished,
          isThinkingActive, accumulatedThoughts || undefined, undefined, receivedSources, false,
          { thinkingStartedAt: thinkingStartTime, firstTokenAt: firstTokenTimestamp, thinkingMs: thinkingDurationMs },
          false, latestFinishReason,
          { extendedThinking: lastOptions.extendedThinking, thinkingPlan: receivedPlan }
        );
      },
      onFlushComplete: () => {
        setIsStreaming(false);
        updateMessageContent(
          activeConversationId, newAssistantMsg.id, streamerRef.current?.getDisplayedText() || "", false,
          false, accumulatedThoughts || undefined, undefined, receivedSources, false,
          { thinkingStartedAt: thinkingStartTime, firstTokenAt: firstTokenTimestamp, thinkingMs: thinkingDurationMs },
          false, latestFinishReason,
          { extendedThinking: lastOptions.extendedThinking, thinkingPlan: receivedPlan }
        );
      },
    });
    (streamerRef as any).current = streamer;
    streamer.start();

    streamRealResponse(
      newContent,
      abortCtrl.signal,
      {
        messages: contextBranch,
        style: preferences.responseStyle,
        profileInstructions: preferences.profileInstructions,
        projectInstructions: projInstructions,
        projectKnowledge: projKnowledge,
        model: lastOptions.model,
        effort: lastOptions.effort,
        webSearch: lastOptions.webSearch,
        extendedThinking: lastOptions.extendedThinking,
        language: preferences.language,
        memoryEnabled: preferences.memory_enabled !== false,
      },
      {
        onThinkingPlan: (plan) => {
          receivedPlan = plan;
          const isMediumOrHigh = plan.level === "medium" || plan.level === "high";
          if (isMediumOrHigh && !thinkingStartTime) thinkingStartTime = Date.now();
          updateMessageContent(
            activeConversationId, newAssistantMsg.id, "", true,
            (lastOptions.extendedThinking || isMediumOrHigh) && !firstTokenTimestamp,
            accumulatedThoughts || undefined, undefined, undefined, false,
            { thinkingStartedAt: thinkingStartTime }, false, undefined,
            { extendedThinking: lastOptions.extendedThinking, thinkingPlan: receivedPlan }
          );
        },
        onThinkingStart: () => {
          if (!thinkingStartTime) thinkingStartTime = Date.now();
          updateMessageContent(
            activeConversationId, newAssistantMsg.id, "", true, true, "", undefined, undefined, false,
            { thinkingStartedAt: thinkingStartTime }, false, undefined,
            { extendedThinking: lastOptions.extendedThinking, thinkingPlan: receivedPlan }
          );
        },
        onThinkingUpdate: (thoughts) => {
          if (!thinkingStartTime) thinkingStartTime = Date.now();
          accumulatedThoughts = thoughts;
          updateMessageContent(
            activeConversationId, newAssistantMsg.id, "", true, !firstTokenTimestamp, thoughts, undefined, undefined, false,
            { thinkingStartedAt: thinkingStartTime }, false, undefined,
            { extendedThinking: lastOptions.extendedThinking, thinkingPlan: receivedPlan }
          );
        },
        onSources: (sources) => {
          receivedSources = sources;
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            "",
            true,
            lastOptions.extendedThinking && !firstTokenTimestamp,
            accumulatedThoughts || undefined,
            undefined,
            sources,
            false,
            { thinkingStartedAt: thinkingStartTime }
          );
        },
        onToken: (token) => {
          if (!firstTokenTimestamp) {
            firstTokenTimestamp = Date.now();
            if (thinkingStartTime) {
              thinkingDurationMs = firstTokenTimestamp - thinkingStartTime;
            }
          }
          streamer.push(token);
        },
        onFinish: (finish) => {
          latestFinishReason = finish;
        },
        onDone: (fullText) => {
          streamer.markDone();
          
          if (preferences.memory_enabled !== false && activeConversation && !activeConversation.isIncognito) {
            fetch("/api/memory/extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversationId: activeConversationId,
                lastMessages: [
                  { role: "user", content: newContent },
                  { role: "assistant", content: fullText || streamer.getDisplayedText() }
                ]
              })
            })
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                if (data.success && data.changes && data.changes.length > 0) {
                  window.dispatchEvent(new CustomEvent("claude:memory-updated"));
                }
              }
            })
            .catch(() => {});
          }
        },
        onError: (err) => {
          streamer.stop();
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            "",
            false,
            false,
            accumulatedThoughts || undefined,
            {
              isError: true,
              errorText: err.message || "An unexpected error occurred.",
              errorDetails: (err as any).details || (err.stack ? String(err.stack) : undefined),
            },
            receivedSources,
            false,
            {
              thinkingStartedAt: thinkingStartTime,
              firstTokenAt: firstTokenTimestamp,
              thinkingMs: thinkingDurationMs,
            }
          );
          setIsStreaming(false);
        },
      }
    );
  };

  const { handleRetry } = useRetryStream(options);

  return {
    handleSaveEdit,
    handleRetry,
  };
}
