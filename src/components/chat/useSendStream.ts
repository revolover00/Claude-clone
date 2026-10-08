import { useState, useRef } from "react";
import { useToast } from "../../context/ToastContext";
import { SmoothStreamer } from "../../utils/smoothStreamer";
import { streamRealResponse } from "../../utils/streamResponse";
import type { Attachment } from "../../types/chat";
import { useSendQueue } from "./useSendQueue";
import { type SendStreamOptions } from "./useSendStreamTypes";
import { createMessagePair } from "./sendStreamHelpers";

export function useSendStream({
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
  abortRef,
  streamerRef,
  setComposerInitial,
}: SendStreamOptions) {
  const { showToast } = useToast();

  const [followups, setFollowups] = useState<string[]>([]);
  const [lastOptions, setLastOptions] = useState({
    model: "sonnet-5",
    effort: "Medium",
    webSearch: false,
    extendedThinking: false,
  });

  const retryCountRef = useRef(0);
  const isFirstExchange = !activeConversation || activeConversation.messages.length === 0;
  const currentProjectId = activeConversation?.projectId || null;

  const handleSend = (
    text: string,
    attachments?: Attachment[],
    options?: {
      model: string;
      effort: string;
      webSearch: boolean;
      extendedThinking: boolean;
    },
    isRetryAttempt = false
  ) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;

    if (isStreaming) {
      setQueuedMessage({
        text,
        attachments: attachments || [],
        options: options || lastOptions,
      });
      showToast("Next message queued", "info");
      return;
    }

    if (!isRetryAttempt) {
      retryCountRef.current = 0;
    }

    const streamOpts = {
      model: options?.model || lastOptions.model,
      effort: options?.effort || lastOptions.effort,
      webSearch: options?.webSearch ?? lastOptions.webSearch,
      extendedThinking: options?.extendedThinking ?? lastOptions.extendedThinking,
    };
    if (options) {
      setLastOptions(options);
    }

    const conversationId = activeConversationId || `conv-${Date.now()}`;
    const { userMsg, assistantMsg, assistantMsgId, thinkingStartTime } = createMessagePair(
      text,
      attachments,
      streamOpts.extendedThinking,
      streamOpts.webSearch
    );

    let firstTokenTimestamp: number | undefined;
    let thinkingDurationMs: number | undefined;

    const queryParams = new URLSearchParams(window.location.search);
    const isIncognitoFromUrl = queryParams.get("incognito") === "true";
    const isIncognito = activeConversation?.isIncognito || (!activeConversationId && isIncognitoFromUrl);

    saveMessage(conversationId, userMsg, currentProjectId, isIncognito);
    saveMessage(conversationId, assistantMsg, currentProjectId, isIncognito);

    if (!activeConversationId) {
      setActiveConversationId(conversationId);
    }

    setComposerInitial("");
    setTimeout(() => scrollToBottom(true), 80);

    const promptText = text || (attachments && attachments[0]?.name ? `Analyze ${attachments[0].name}` : "Hello");
    const existingMessages = activeBranch || [];

    const projInstructions = currentProject?.instructions || undefined;
    const projKnowledge = currentProject?.knowledge?.map((k) => ({ title: k.title, content: k.content })) || undefined;

    let receivedSources: Array<{ title: string; url: string }> | undefined;
    let accumulatedThoughts = "";
    let latestFinishReason: string | undefined;

    const runStreaming = (
      pText: string,
      convId: string,
      aMsgId: string,
      ctxMessages: any[],
      sOpts: typeof streamOpts,
      tStartTime?: number
    ) => {
      (abortRef as any).current?.abort();
      const abortCtrl = new AbortController();
      (abortRef as any).current = abortCtrl;
      registerActiveStream(convId, abortCtrl);

      const callUpdate = (
        content: string,
        isStreamActive = true,
        isThinkingVal = false,
        thoughts?: string,
        sources?: any[],
        errorVal?: any,
        reconnectVal = false
      ) => {
        updateMessageContent(
          convId,
          aMsgId,
          content,
          isStreamActive,
          isThinkingVal,
          thoughts,
          errorVal,
          sources,
          sOpts.webSearch,
          {
            thinkingStartedAt: tStartTime,
            firstTokenAt: firstTokenTimestamp,
            thinkingMs: thinkingDurationMs,
          },
          reconnectVal,
          latestFinishReason
        );
      };

      const streamer = new SmoothStreamer({
        onUpdate: (displayedText, isFinished) => {
          callUpdate(
            displayedText,
            !isFinished,
            sOpts.extendedThinking && !firstTokenTimestamp,
            accumulatedThoughts || undefined,
            receivedSources
          );
        },
        onFlushComplete: () => {
          unregisterActiveStream(convId);
          triggerQueuedMessage();
          callUpdate(
            streamerRef.current?.getDisplayedText() || "",
            false,
            sOpts.extendedThinking && !firstTokenTimestamp,
            accumulatedThoughts || undefined,
            receivedSources
          );
        },
      });
      (streamerRef as any).current = streamer;
      streamer.start();

      streamRealResponse(
        pText,
        abortCtrl.signal,
        {
          messages: ctxMessages,
          style: preferences.responseStyle,
          profileInstructions: preferences.profileInstructions,
          projectInstructions: projInstructions,
          projectKnowledge: projKnowledge,
          model: sOpts.model,
          effort: sOpts.effort,
          webSearch: sOpts.webSearch,
          extendedThinking: sOpts.extendedThinking,
          language: preferences.language,
          memoryEnabled: preferences.memory_enabled !== false,
        },
        {
          onThinkingStart: () => {
            callUpdate("", true, sOpts.extendedThinking, "");
          },
          onThinkingUpdate: (thoughts) => {
            accumulatedThoughts = thoughts;
            callUpdate("", true, sOpts.extendedThinking && !firstTokenTimestamp, thoughts);
          },
          onSources: (sources) => {
            receivedSources = sources;
            callUpdate("", true, sOpts.extendedThinking && !firstTokenTimestamp, accumulatedThoughts || undefined, sources);
          },
          onToken: (token) => {
            if (!firstTokenTimestamp) {
              firstTokenTimestamp = Date.now();
              if (tStartTime) {
                thinkingDurationMs = firstTokenTimestamp - tStartTime;
              }
            }
            streamer.push(token);
          },
          onFinish: (finish) => {
            latestFinishReason = finish;
          },
          onDone: (fullText) => {
            streamer.markDone();
            if (isFirstExchange) {
              triggerAutoTitle(convId, pText, fullText);
            }
            
            if (preferences.memory_enabled !== false && !isIncognito) {
              fetch("/api/memory/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  conversationId: convId,
                  lastMessages: [
                    { role: "user", content: pText },
                    { role: "assistant", content: fullText }
                  ]
                })
              })
              .then(async (res) => {
                const data = res.ok ? await res.json() : null;
                if (data?.success && data?.changes?.length > 0) window.dispatchEvent(new CustomEvent("claude:memory-updated"));
              }).catch(() => {});
            }
          },
          onError: (err) => {
            streamer.stop();
            const statusCode = (err as any).code || 500;
            const isNetworkOr5xx = statusCode >= 500 || err.message === "Backend unreachable";

            if (isNetworkOr5xx && retryCountRef.current < 2) {
              retryCountRef.current += 1;
              callUpdate(
                streamerRef.current?.getDisplayedText() || "",
                true,
                sOpts.extendedThinking && !firstTokenTimestamp,
                accumulatedThoughts || undefined,
                receivedSources,
                undefined,
                true
              );

              setTimeout(() => {
                firstTokenTimestamp = undefined;
                thinkingDurationMs = undefined;
                runStreaming(pText, convId, aMsgId, ctxMessages, sOpts, tStartTime);
              }, 1500);
              return;
            }

            callUpdate(
              streamerRef.current?.getDisplayedText() || "",
              false,
              false,
              accumulatedThoughts || undefined,
              receivedSources,
              { isError: true, errorText: err.message || "An unexpected error occurred.", errorDetails: (err as any).details || (err.stack ? String(err.stack) : undefined) }
            );
            unregisterActiveStream(convId);
            triggerQueuedMessage();
          },
        }
      );
    };

    runStreaming(promptText, conversationId, assistantMsgId, existingMessages, streamOpts, thinkingStartTime);
  };

  const { queuedMessage, setQueuedMessage, triggerQueuedMessage } = useSendQueue(handleSend);

  return { handleSend, followups, setFollowups, lastOptions, setLastOptions, queuedMessage, setQueuedMessage };
}
