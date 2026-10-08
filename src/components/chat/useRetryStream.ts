import { SmoothStreamer } from "../../utils/smoothStreamer";
import { streamRealResponse } from "../../utils/streamResponse";
import type { Message, Project } from "../../types/chat";

interface RetryStreamOptions {
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
    finishReason?: string
  ) => void;
  preferences: any;
  currentProject: Project | undefined;
  branchRetryAssistantMessage: (conversationId: string, assistantMessageId: string) => any;
  setIsStreaming: (streaming: boolean) => void;
  scrollToBottom: (smooth: boolean) => void;
  scrollToUserMessage: (msgId: string) => void;
  abortRef: React.RefObject<AbortController | null>;
  streamerRef: React.RefObject<SmoothStreamer | null>;
  lastOptions: any;
}

export function useRetryStream({
  activeConversationId,
  activeBranch,
  updateMessageContent,
  preferences,
  currentProject,
  branchRetryAssistantMessage,
  setIsStreaming,
  scrollToBottom,
  scrollToUserMessage,
  abortRef,
  streamerRef,
  lastOptions,
}: RetryStreamOptions) {
  const messages = activeBranch;

  const handleRetry = (
    assistantMsgId: string,
    options?: { model?: string; modifier?: string }
  ) => {
    if (!activeConversationId) return;

    (abortRef as any).current?.abort();
    const abortCtrl = new AbortController();
    (abortRef as any).current = abortCtrl;

    const streamModel = options?.model || lastOptions.model;
    const modifierText = options?.modifier || "";

    const thinkingStartTime = lastOptions.extendedThinking ? Date.now() : undefined;
    let firstTokenTimestamp: number | undefined;
    let thinkingDurationMs: number | undefined;

    const res = branchRetryAssistantMessage(activeConversationId, assistantMsgId);
    if (!res) return;

    const { parentUserMsg, newAssistantMsg } = res;
    setIsStreaming(true);
    setTimeout(() => scrollToBottom(true), 80);
    scrollToUserMessage(parentUserMsg.id);

    const userMsgIdx = messages.findIndex((m) => m.id === parentUserMsg.id);
    const contextBranch = messages.slice(0, userMsgIdx >= 0 ? userMsgIdx : undefined);

    const projInstructions = currentProject?.instructions || undefined;
    const projKnowledge = currentProject?.knowledge?.map((k) => ({
      title: k.title,
      content: k.content,
    })) || undefined;

    let receivedSources: Array<{ title: string; url: string }> | undefined;
    let accumulatedThoughts = "";
    let latestFinishReason: string | undefined;

    const streamer = new SmoothStreamer({
      onUpdate: (displayedText, isFinished) => {
        updateMessageContent(
          activeConversationId,
          newAssistantMsg.id,
          displayedText,
          !isFinished,
          lastOptions.extendedThinking && !firstTokenTimestamp,
          accumulatedThoughts || undefined,
          undefined,
          receivedSources,
          false,
          {
            thinkingStartedAt: thinkingStartTime,
            firstTokenAt: firstTokenTimestamp,
            thinkingMs: thinkingDurationMs,
          },
          false,
          latestFinishReason
        );
      },
      onFlushComplete: () => {
        setIsStreaming(false);
        updateMessageContent(
          activeConversationId,
          newAssistantMsg.id,
          streamerRef.current?.getDisplayedText() || "",
          false,
          lastOptions.extendedThinking && !firstTokenTimestamp,
          accumulatedThoughts || undefined,
          undefined,
          receivedSources,
          false,
          {
            thinkingStartedAt: thinkingStartTime,
            firstTokenAt: firstTokenTimestamp,
            thinkingMs: thinkingDurationMs,
          },
          false,
          latestFinishReason
        );
      },
    });
    (streamerRef as any).current = streamer;
    streamer.start();

    const promptToSend = modifierText
      ? `${parentUserMsg.content}\n\nPlease update your previous response based on this directive: ${modifierText}`
      : parentUserMsg.content;

    streamRealResponse(
      promptToSend,
      abortCtrl.signal,
      {
        messages: contextBranch,
        style: preferences.responseStyle,
        profileInstructions: preferences.profileInstructions,
        projectInstructions: projInstructions,
        projectKnowledge: projKnowledge,
        model: streamModel,
        effort: lastOptions.effort,
        webSearch: lastOptions.webSearch,
        extendedThinking: lastOptions.extendedThinking,
        language: preferences.language,
      },
      {
        onThinkingStart: () => {
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            "",
            true,
            lastOptions.extendedThinking,
            "",
            undefined,
            undefined,
            false,
            { thinkingStartedAt: thinkingStartTime }
          );
        },
        onThinkingUpdate: (thoughts) => {
          accumulatedThoughts = thoughts;
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            "",
            true,
            lastOptions.extendedThinking && !firstTokenTimestamp,
            thoughts,
            undefined,
            undefined,
            false,
            { thinkingStartedAt: thinkingStartTime }
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
        onDone: () => {
          streamer.markDone();
        },
        onError: (err) => {
          streamer.stop();
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            streamerRef.current?.getDisplayedText() || "",
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

  return {
    handleRetry,
  };
}
