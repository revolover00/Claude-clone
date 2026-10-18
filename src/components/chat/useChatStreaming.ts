import { useState, useEffect, useRef } from "react";
import { SmoothStreamer } from "../../utils/smoothStreamer";
import type { Message, Project } from "../../types/chat";
import { useSendStream } from "./useSendStream";
import { useEditRetryStream } from "./useEditRetryStream";
import { useContinueStream } from "./useContinueStream";

interface StreamingOptions {
  activeConversationId: string | null;
  activeConversation: any;
  activeBranch: Message[];
  saveMessage: (conversationId: string, message: Message, projectId?: string | null) => void;
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
  setActiveConversationId: (id: string | null) => void;
  triggerAutoTitle: (conversationId: string, firstUserMsg: string, firstReply: string) => Promise<void>;
  preferences: any;
  currentProject: Project | undefined;
  branchEditUserMessage: (conversationId: string, targetMessageId: string, newContent: string) => any;
  branchRetryAssistantMessage: (conversationId: string, assistantMessageId: string) => any;
  registerActiveStream: (chatId: string, abortCtrl: AbortController) => void;
  unregisterActiveStream: (chatId: string) => void;
  stopActiveStream: (chatId: string) => void;
  generatingChatIds: Set<string>;
  scrollToBottom: (smooth: boolean) => void;
  scrollToUserMessage: (msgId: string) => void;
}

export function useChatStreaming({
  activeConversationId,
  activeConversation,
  activeBranch,
  saveMessage,
  updateMessageContent,
  setActiveConversationId,
  triggerAutoTitle,
  preferences,
  currentProject,
  branchEditUserMessage,
  branchRetryAssistantMessage,
  registerActiveStream,
  unregisterActiveStream,
  stopActiveStream,
  generatingChatIds,
  scrollToBottom,
  scrollToUserMessage,
}: StreamingOptions) {
  const [isStreaming, setIsStreaming] = useState(() =>
    activeConversationId ? Boolean(generatingChatIds?.has(activeConversationId)) : false
  );

  useEffect(() => {
    setIsStreaming(activeConversationId ? Boolean(generatingChatIds?.has(activeConversationId)) : false);
  }, [activeConversationId, generatingChatIds]);

  const [composerInitial, setComposerInitial] = useState("");
  const [composerValue, setComposerValue] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const streamerRef = useRef<SmoothStreamer | null>(null);

  useEffect(() => {
    return () => {
      // Intentionally stop whichever streamer is active when this hook unmounts.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      streamerRef.current?.stop();
    };
  }, []);

  const messages = activeBranch;

  const {
    handleSend,
    followups,
    setFollowups,
    lastOptions,
    setLastOptions,
    queuedMessage,
    setQueuedMessage,
  } = useSendStream({
    activeConversationId,
    activeConversation,
    activeBranch,
    saveMessage,
    updateMessageContent,
    setActiveConversationId,
    triggerAutoTitle,
    preferences,
    currentProject,
    registerActiveStream,
    unregisterActiveStream,
    scrollToBottom,
    isStreaming,
    setIsStreaming,
    abortRef,
    streamerRef,
    setComposerInitial,
  });

  const {
    handleSaveEdit,
    handleRetry,
  } = useEditRetryStream({
    activeConversationId,
    activeBranch,
    updateMessageContent,
    preferences,
    currentProject,
    branchEditUserMessage,
    branchRetryAssistantMessage,
    setIsStreaming,
    scrollToBottom,
    scrollToUserMessage,
    abortRef,
    streamerRef,
    lastOptions,
  });

  const { handleContinue, getContinuationPrefix } = useContinueStream({
    activeConversationId,
    activeBranch,
    isStreaming,
    setIsStreaming,
    updateMessageContent,
    preferences,
    currentProject,
    lastOptions,
    abortRef,
    streamerRef,
    registerActiveStream,
    unregisterActiveStream,
  });

  const handleStop = () => {
    const streamingMsg = messages.find((message) => message.isStreaming);
    const continuationPrefix = streamingMsg ? getContinuationPrefix(streamingMsg.id) : null;
    if (activeConversationId) stopActiveStream(activeConversationId);
    streamerRef.current?.flushImmediate();
    if (activeConversationId && streamingMsg) {
      const displayed = continuationPrefix !== null
        ? continuationPrefix + (streamerRef.current?.getDisplayedText() ?? "")
        : streamerRef.current?.getDisplayedText() ?? streamingMsg.content;
      const stopError = displayed.trim()
        ? undefined
        : { isError: true, errorText: "Stopped before the model produced a response." };
      updateMessageContent(
        activeConversationId, streamingMsg.id, displayed, false, false, streamingMsg.thinking,
        stopError, streamingMsg.sources, false,
        { thinkingStartedAt: streamingMsg.thinkingStartedAt, firstTokenAt: streamingMsg.firstTokenAt, thinkingMs: streamingMsg.thinkingMs },
        false, continuationPrefix !== null ? "INTERRUPTED" : undefined
      );
    }
  };

  const handleEditLastMessage = () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      setComposerInitial(lastUserMessage.content);
    }
  };

  return {
    isStreaming,
    composerInitial,
    setComposerInitial,
    composerValue,
    setComposerValue,
    followups,
    setFollowups,
    lastOptions,
    setLastOptions,
    queuedMessage,
    setQueuedMessage,
    handleSend,
    handleStop,
    handleContinue,
    handleSaveEdit,
    handleRetry,
    handleEditLastMessage,
  };
}
