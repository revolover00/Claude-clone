import { useRef } from "react";
import { SmoothStreamer } from "../../utils/smoothStreamer";
import { streamRealResponse } from "../../utils/streamResponse";
import type { Message, Project } from "../../types/chat";
import { buildContinuationContext } from "./sendStreamHelpers";

type UpdateMessageContent = (
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

interface ContinueStreamOptions {
  activeConversationId: string | null;
  activeBranch: Message[];
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  updateMessageContent: UpdateMessageContent;
  preferences: any;
  currentProject: Project | undefined;
  lastOptions: any;
  abortRef: { current: AbortController | null };
  streamerRef: { current: SmoothStreamer | null };
  registerActiveStream: (conversationId: string, controller: AbortController) => void;
  unregisterActiveStream: (conversationId: string) => void;
}

export function useContinueStream({
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
}: ContinueStreamOptions) {
  const continuationRef = useRef<{ messageId: string; prefix: string } | null>(null);
  const getContinuationPrefix = (messageId: string) =>
    continuationRef.current?.messageId === messageId ? continuationRef.current.prefix : null;

  const handleContinue = (assistantMsgId: string) => {
    const conversationId = activeConversationId;
    if (isStreaming || !conversationId) return;
    const assistantMsg = activeBranch.find((message) => message.id === assistantMsgId);
    if (!assistantMsg) return;

    continuationRef.current = { messageId: assistantMsgId, prefix: assistantMsg.content };
    abortRef.current?.abort();
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;
    registerActiveStream(conversationId, abortCtrl);
    setIsStreaming(true);
    updateMessageContent(conversationId, assistantMsgId, assistantMsg.content, true, false, assistantMsg.thinking);

    const prompt = "Continue generating the response exactly from where you left off. Do not repeat any part of your previous response. Just continue typing the remainder immediately.";
    const context = buildContinuationContext(activeBranch, assistantMsgId);
    const currentContent = assistantMsg.content;
    let finishReason: string | undefined;

    const streamer = new SmoothStreamer({
      onUpdate: (text, finished) => updateMessageContent(
        conversationId, assistantMsgId, currentContent + text, !finished, false,
        assistantMsg.thinking, undefined, undefined, false, undefined, false, finishReason
      ),
      onFlushComplete: () => {
        setIsStreaming(false);
        unregisterActiveStream(conversationId);
        updateMessageContent(
          conversationId, assistantMsgId, currentContent + streamer.getDisplayedText(), false, false,
          assistantMsg.thinking, undefined, undefined, false, undefined, false, finishReason
        );
        continuationRef.current = null;
      },
    });
    streamerRef.current = streamer;
    streamer.start();

    streamRealResponse(prompt, abortCtrl.signal, {
      messages: context,
      style: preferences.responseStyle,
      profileInstructions: preferences.profileInstructions,
      projectInstructions: currentProject?.instructions || undefined,
      projectKnowledge: currentProject?.knowledge?.map(({ title, content }) => ({ title, content })) || undefined,
      model: lastOptions.model,
      effort: lastOptions.effort,
      webSearch: lastOptions.webSearch,
      extendedThinking: false,
      language: preferences.language,
      memoryEnabled: preferences.memory_enabled !== false,
    }, {
      onThinkingStart: () => {},
      onThinkingUpdate: () => {},
      onSources: () => {},
      onToken: (token) => streamer.push(token),
      onFinish: (reason) => { finishReason = reason; },
      onDone: () => streamer.markDone(),
      onError: () => {
        streamer.flushImmediate();
        setIsStreaming(false);
        if (!abortCtrl.signal.aborted) {
          updateMessageContent(
            conversationId, assistantMsgId, currentContent + streamer.getDisplayedText(), false, false,
            assistantMsg.thinking, undefined, undefined, false, undefined, false, "INTERRUPTED"
          );
        }
      },
    });
  };

  return { handleContinue, getContinuationPrefix };
}
