import { useState, useEffect, useRef } from "react";
import { SmoothStreamer } from "../../utils/smoothStreamer";
import { streamRealResponse } from "../../utils/streamResponse";
import type { Message, Project } from "../../types/chat";
import { useSendStream } from "./useSendStream";
import { useEditRetryStream } from "./useEditRetryStream";

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

  const handleContinue = (assistantMsgId: string) => {
    if (isStreaming || !activeConversationId) return;

    const assistantMsg = messages.find((m) => m.id === assistantMsgId);
    if (!assistantMsg) return;

    abortRef.current?.abort();
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    setIsStreaming(true);

    updateMessageContent(
      activeConversationId,
      assistantMsgId,
      assistantMsg.content,
      true,
      false,
      assistantMsg.thinking
    );

    const parentUserMsgIdx = messages.findIndex((m) => m.id === assistantMsgId) - 1;
    const promptToSend = "Continue generating the response exactly from where you left off. Do not repeat any part of your previous response. Just continue typing the remainder immediately.";
    const contextBranch = messages.slice(0, parentUserMsgIdx >= 0 ? parentUserMsgIdx + 1 : undefined);

    let currentContent = assistantMsg.content;
    let latestContinueFinishReason: string | undefined;

    const streamer = new SmoothStreamer({
      onUpdate: (displayedText, isFinished) => {
        updateMessageContent(
          activeConversationId,
          assistantMsgId,
          currentContent + displayedText,
          !isFinished,
          false,
          assistantMsg.thinking,
          undefined,
          undefined,
          false,
          undefined,
          false,
          latestContinueFinishReason
        );
      },
      onFlushComplete: () => {
        setIsStreaming(false);
        updateMessageContent(
          activeConversationId,
          assistantMsgId,
          currentContent + streamer.getDisplayedText(),
          false,
          false,
          assistantMsg.thinking,
          undefined,
          undefined,
          false,
          undefined,
          false,
          latestContinueFinishReason
        );
      },
    });
    streamerRef.current = streamer;
    streamer.start();

    streamRealResponse(
      promptToSend,
      abortCtrl.signal,
      {
        messages: contextBranch,
        style: preferences.responseStyle,
        profileInstructions: preferences.profileInstructions,
        model: lastOptions.model,
        effort: lastOptions.effort,
        webSearch: lastOptions.webSearch,
        extendedThinking: false,
        language: preferences.language,
      },
      {
        onThinkingStart: () => {},
        onThinkingUpdate: () => {},
        onSources: () => {},
        onToken: (token) => {
          streamer.push(token);
        },
        onFinish: (finish) => {
          latestContinueFinishReason = finish;
        },
        onDone: () => {
          streamer.markDone();
        },
        onError: (_err) => {
          streamer.stop();
          setIsStreaming(false);
        },
      }
    );
  };

  const handleStop = () => {
    if (activeConversationId) {
      stopActiveStream(activeConversationId);
    }
    if (streamerRef.current) {
      streamerRef.current.flushImmediate();
    }
    if (activeConversationId) {
      const streamingMsg = messages.find((m) => m.isStreaming);
      if (streamingMsg) {
        const displayed = streamerRef.current?.getDisplayedText() ?? streamingMsg.content;
        updateMessageContent(
          activeConversationId,
          streamingMsg.id,
          displayed,
          false,
          false,
          streamingMsg.thinking,
          undefined,
          streamingMsg.sources,
          false,
          {
            thinkingStartedAt: streamingMsg.thinkingStartedAt,
            firstTokenAt: streamingMsg.firstTokenAt,
            thinkingMs: streamingMsg.thinkingMs,
          }
        );
      }
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
