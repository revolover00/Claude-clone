import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { MessagesSquare, Plus } from "lucide-react";
import Composer from "./Composer";
import ChatHeader from "./chat/ChatHeader";
import MessageList from "./chat/MessageList";
import HomeHero from "./chat/HomeHero";
import ScrollToBottomButton from "./chat/ScrollToBottomButton";
import { useAutoScroll } from "./chat/useAutoScroll";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { streamRealResponse } from "../utils/streamResponse";
import { SmoothStreamer } from "../utils/smoothStreamer";
import type { Attachment, Message } from "../types/chat";

const ProjectsView = lazy(() => import("./views/ProjectsView"));
const ArtifactsView = lazy(() => import("./views/ArtifactsView"));
const CustomizeView = lazy(() => import("./views/CustomizeView"));
const CodeSessionsView = lazy(() => import("./views/CodeSessionsView"));

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar?: () => void;
}

export default function MainChat({ sidebarOpen, onToggleSidebar }: Props) {
  const navigate = useNavigate();
  const {
    activeConversationId,
    activeConversation,
    activeBranch,
    saveMessage,
    updateMessageContent,
    setActiveConversationId,
    triggerAutoTitle,
    preferences,
    activeView,
    projects,
    branchEditUserMessage,
    branchRetryAssistantMessage,
    registerActiveStream,
    unregisterActiveStream,
    stopActiveStream,
    generatingChatIds,
  } = useChat();
  const { showToast } = useToast();

  const [isStreaming, setIsStreaming] = useState(() =>
    activeConversationId ? Boolean(generatingChatIds?.has(activeConversationId)) : false
  );

  useEffect(() => {
    setIsStreaming(activeConversationId ? Boolean(generatingChatIds?.has(activeConversationId)) : false);
  }, [activeConversationId, generatingChatIds]);

  const [composerInitial, setComposerInitial] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [followups, setFollowups] = useState<string[]>([]);
  const [lastOptions, setLastOptions] = useState({
    model: "sonnet-5",
    effort: "Medium",
    webSearch: false,
    extendedThinking: false,
  });

  // Queued next message state & ref
  const [queuedMessage, setQueuedMessage] = useState<{
    text: string;
    attachments: Attachment[];
    options: any;
  } | null>(null);

  const queuedMessageRef = useRef<typeof queuedMessage>(null);
  useEffect(() => {
    queuedMessageRef.current = queuedMessage;
  }, [queuedMessage]);

  const triggerQueuedMessage = () => {
    const queued = queuedMessageRef.current;
    if (queued) {
      setQueuedMessage(null);
      queuedMessageRef.current = null;
      setTimeout(() => {
        handleSend(queued.text, queued.attachments, queued.options);
      }, 150);
    }
  };

  // Connection Resilience & Retry Attempts
  const retryCountRef = useRef(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const streamerRef = useRef<SmoothStreamer | null>(null);

  const messages = activeBranch;
  const inChatView = messages.length > 0;
  const isNotFound = activeView === "chat" && activeConversationId && !activeConversation;

  // Auto scroll hook
  const { scrollRef, checkScroll, showScrollBtn, hasNewUnseenText, scrollToBottom } = useAutoScroll(
    messages,
    inChatView,
    isStreaming
  );

  // Derive current project association
  const currentProjectId = activeConversation?.projectId || null;
  const currentProject = projects.find((p) => p.id === currentProjectId);

  // Clean up streaming on unmount (we stop local streamer, but active background stream can continue)
  useEffect(() => {
    return () => {
      streamerRef.current?.stop();
    };
  }, []);

  // Global keydown to stop generation on Escape
  useEffect(() => {
    const handleGlobalEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isStreaming) {
        handleStop();
      }
    };
    window.addEventListener("keydown", handleGlobalEscape);
    return () => {
      window.removeEventListener("keydown", handleGlobalEscape);
    };
  }, [isStreaming]);

  // Smooth scroll user's message so it sits at the top of the viewport over 300ms
  const scrollToUserMessage = (msgId: string) => {
    setTimeout(() => {
      const element = document.getElementById(`msg-${msgId}`);
      if (element && scrollRef.current) {
        const container = scrollRef.current;
        const targetY = element.offsetTop;
        const startY = container.scrollTop;
        const diff = targetY - startY;
        const duration = 300;
        let startTime: number | null = null;

        const animate = (time: number) => {
          if (!startTime) startTime = time;
          const elapsed = time - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // easeInOutQuad
          const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
          container.scrollTop = startY + diff * ease;
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        requestAnimationFrame(animate);
      }
    }, 100);
  };

  // Continuation generation (Continue button)
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
      assistantMsg.content, // Keep current content
      true, // isStreaming = true
      false, // isThinking = false
      assistantMsg.thinking
    );

    const parentUserMsgIdx = messages.findIndex((m) => m.id === assistantMsgId) - 1;

    const promptToSend = "Continue generating the response exactly from where you left off. Do not repeat any part of your previous response. Just continue typing the remainder immediately.";
    const contextBranch = messages.slice(0, parentUserMsgIdx >= 0 ? parentUserMsgIdx + 1 : undefined);

    let currentContent = assistantMsg.content;

    const streamer = new SmoothStreamer({
      onUpdate: (displayedText, isFinished) => {
        updateMessageContent(
          activeConversationId,
          assistantMsgId,
          currentContent + displayedText,
          !isFinished,
          false,
          assistantMsg.thinking
        );
      },
      onFlushComplete: () => {
        setIsStreaming(false);
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
        extendedThinking: false, // Turn off thinking for continuous flow
        language: preferences.language,
      },
      {
        onThinkingStart: () => {},
        onThinkingUpdate: () => {},
        onSources: () => {},
        onToken: (token) => {
          streamer.push(token);
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

  // Fetch recommended followups when last response finishes
  useEffect(() => {
    if (isStreaming) {
      setFollowups([]);
      return;
    }
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "assistant" && !lastMsg.isStreaming && lastMsg.content) {
      const fetchFollowups = async () => {
        try {
          const response = await fetch("/api/suggest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: lastMsg.content,
              language: preferences.language,
            }),
          });
          const data = await response.json();
          if (data.suggestions && Array.isArray(data.suggestions)) {
            setFollowups(data.suggestions);
          }
        } catch (err) {
          console.error("Failed to fetch followups:", err);
        }
      };
      fetchFollowups();
    } else {
      setFollowups([]);
    }
  }, [messages.length, isStreaming, activeConversationId, preferences.language]);

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
    if (!text.trim() && (!attachments || attachments.length === 0))
      return;

    if (isStreaming) {
      // Queue the message
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
    const isFirstExchange = !activeConversation || activeConversation.messages.length === 0;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    };

    const thinkingStartTime = streamOpts.extendedThinking ? Date.now() : undefined;
    let firstTokenTimestamp: number | undefined;
    let thinkingDurationMs: number | undefined;

    const assistantMsgId = `a-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      thinking: "",
      isThinking: streamOpts.extendedThinking,
      isStreaming: true,
      isSearchingWeb: streamOpts.webSearch,
      thinkingStartedAt: thinkingStartTime,
      createdAt: Date.now(),
    };

    saveMessage(conversationId, userMsg, currentProjectId);
    saveMessage(conversationId, assistantMsg, currentProjectId);

    if (!activeConversationId) {
      setActiveConversationId(conversationId);
    }

    setComposerInitial("");
    setTimeout(() => scrollToBottom(true), 80);

    const promptText =
      text || (attachments && attachments[0]?.name ? `Analyze ${attachments[0].name}` : "Hello");
    const existingMessages = activeBranch || [];

    const projInstructions = currentProject?.instructions || undefined;
    const projKnowledge = currentProject?.knowledge?.map((k) => ({
      title: k.title,
      content: k.content,
    })) || undefined;

    let receivedSources: Array<{ title: string; url: string }> | undefined;
    let accumulatedThoughts = "";

    const runStreaming = (
      pText: string,
      convId: string,
      aMsgId: string,
      ctxMessages: any[],
      sOpts: typeof streamOpts,
      tStartTime?: number
    ) => {
      abortRef.current?.abort();
      const abortCtrl = new AbortController();
      abortRef.current = abortCtrl;
      registerActiveStream(convId, abortCtrl);

      const streamer = new SmoothStreamer({
        onUpdate: (displayedText, isFinished) => {
          updateMessageContent(
            convId,
            aMsgId,
            displayedText,
            !isFinished,
            false,
            accumulatedThoughts || undefined,
            undefined,
            receivedSources,
            sOpts.webSearch,
            {
              thinkingStartedAt: tStartTime,
              firstTokenAt: firstTokenTimestamp,
              thinkingMs: thinkingDurationMs,
            },
            false
          );
        },
        onFlushComplete: () => {
          unregisterActiveStream(convId);
          triggerQueuedMessage();
        },
      });
      streamerRef.current = streamer;
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
        },
        {
          onThinkingStart: () => {
            updateMessageContent(
              convId,
              aMsgId,
              "",
              true,
              sOpts.extendedThinking,
              "",
              undefined,
              undefined,
              sOpts.webSearch,
              { thinkingStartedAt: tStartTime }
            );
          },
          onThinkingUpdate: (thoughts) => {
            accumulatedThoughts = thoughts;
            updateMessageContent(
              convId,
              aMsgId,
              "",
              true,
              sOpts.extendedThinking,
              thoughts,
              undefined,
              undefined,
              sOpts.webSearch,
              { thinkingStartedAt: tStartTime }
            );
          },
          onSources: (sources) => {
            receivedSources = sources;
            updateMessageContent(
              convId,
              aMsgId,
              "",
              true,
              false,
              accumulatedThoughts || undefined,
              undefined,
              sources,
              sOpts.webSearch,
              { thinkingStartedAt: tStartTime }
            );
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
          onDone: (fullText) => {
            streamer.markDone();
            if (isFirstExchange) {
              triggerAutoTitle(convId, pText, fullText);
            }
          },
          onError: (err) => {
            streamer.stop();
            const statusCode = (err as any).code || 500;
            const isNetworkOr5xx = statusCode >= 500 || err.message === "Backend unreachable";

            if (isNetworkOr5xx && retryCountRef.current < 2) {
              retryCountRef.current += 1;
              
              // Mark reconnecting
              updateMessageContent(
                convId,
                aMsgId,
                streamerRef.current?.getDisplayedText() || "",
                true,
                false,
                accumulatedThoughts || undefined,
                undefined,
                receivedSources,
                sOpts.webSearch,
                {
                  thinkingStartedAt: tStartTime,
                  firstTokenAt: firstTokenTimestamp,
                  thinkingMs: thinkingDurationMs,
                },
                true // isReconnecting = true
              );

              setTimeout(() => {
                firstTokenTimestamp = undefined;
                thinkingDurationMs = undefined;
                runStreaming(pText, convId, aMsgId, ctxMessages, sOpts, tStartTime);
              }, 1500);
              return;
            }

            // Normal error handling
            updateMessageContent(
              convId,
              aMsgId,
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
                thinkingStartedAt: tStartTime,
                firstTokenAt: firstTokenTimestamp,
                thinkingMs: thinkingDurationMs,
              },
              false // isReconnecting = false
            );
            unregisterActiveStream(convId);
            triggerQueuedMessage();
          },
        }
      );
    };

    runStreaming(promptText, conversationId, assistantMsgId, existingMessages, streamOpts, thinkingStartTime);
  };

  // Listen for Fix with AI events from the ArtifactPanel
  useEffect(() => {
    const handleFixErrorEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ errorText: string; title: string }>;
      if (customEvent.detail && customEvent.detail.errorText) {
        const { errorText, title } = customEvent.detail;
        const prompt = `I'm seeing a runtime error in the artifact "${title}":\n\n\`\`\`\n${errorText}\n\`\`\`\n\nPlease correct this issue and output a full updated version of the artifact with the same title.`;
        handleSend(prompt);
      }
    };
    window.addEventListener("claude:fix-artifact-error", handleFixErrorEvent);
    return () => {
      window.removeEventListener("claude:fix-artifact-error", handleFixErrorEvent);
    };
  }, [handleSend]);

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

  const handleSaveEdit = (messageId: string, newContent: string) => {
    if (!activeConversationId) return;

    abortRef.current?.abort();
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    const thinkingStartTime = lastOptions.extendedThinking ? Date.now() : undefined;
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

    const streamer = new SmoothStreamer({
      onUpdate: (displayedText, isFinished) => {
        updateMessageContent(
          activeConversationId,
          newAssistantMsg.id,
          displayedText,
          !isFinished,
          false,
          accumulatedThoughts || undefined,
          undefined,
          receivedSources,
          false,
          {
            thinkingStartedAt: thinkingStartTime,
            firstTokenAt: firstTokenTimestamp,
            thinkingMs: thinkingDurationMs,
          }
        );
      },
      onFlushComplete: () => {
        setIsStreaming(false);
      },
    });
    streamerRef.current = streamer;
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
            lastOptions.extendedThinking,
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
            false,
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
        onDone: () => {
          streamer.markDone();
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

  const handleRetry = (
    assistantMsgId: string,
    options?: { model?: string; modifier?: string }
  ) => {
    if (!activeConversationId) return;

    abortRef.current?.abort();
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    const streamModel = options?.model || lastOptions.model;
    const modifierText = options?.modifier || "";

    const thinkingStartTime = lastOptions.extendedThinking ? Date.now() : undefined;
    let firstTokenTimestamp: number | undefined;
    let thinkingDurationMs: number | undefined;

    const res = branchRetryAssistantMessage(activeConversationId, assistantMsgId);
    if (!res) return;

    const { parentUserMsg, newAssistantMsg } = res;
    setIsStreaming(true);
    
    // Smooth scroll to user message
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

    const streamer = new SmoothStreamer({
      onUpdate: (displayedText, isFinished) => {
        updateMessageContent(
          activeConversationId,
          newAssistantMsg.id,
          displayedText,
          !isFinished,
          false,
          accumulatedThoughts || undefined,
          undefined,
          receivedSources,
          false,
          {
            thinkingStartedAt: thinkingStartTime,
            firstTokenAt: firstTokenTimestamp,
            thinkingMs: thinkingDurationMs,
          }
        );
      },
      onFlushComplete: () => {
        setIsStreaming(false);
      },
    });
    streamerRef.current = streamer;
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
            lastOptions.extendedThinking,
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
            false,
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
        onDone: () => {
          streamer.markDone();
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

  return (
    <main className="relative flex h-full min-w-0 flex-1 flex-col bg-shell font-sans">
      <ChatHeader
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        activeConversation={activeConversation}
        currentProject={currentProject}
      />

      {isOffline && (
        <div className="bg-danger/10 border-b border-danger/20 text-danger text-[13px] py-1.5 px-4 text-center font-medium animate-fade-in flex items-center justify-center gap-2 font-sans select-none shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse shrink-0" />
          <span>Network connection lost. You are currently offline.</span>
        </div>
      )}

      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-ink-muted animate-pulse">Loading...</div>}>
        {activeView === "projects" && <ProjectsView />}
        {activeView === "artifacts" && <ArtifactsView />}
        {activeView === "customize" && <CustomizeView />}
        {activeView === "code" && <CodeSessionsView />}
      </Suspense>

      {activeView === "chat" && (
        <>
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="scroll-slim relative min-h-0 flex-1 overflow-y-auto"
          >
            <div className="flex min-h-full flex-col px-4 lg:px-6">
              {isNotFound ? (
                <div className="flex flex-1 flex-col items-center justify-center py-16 text-center font-sans">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-elev-2 text-ink-muted mb-4 shadow-sm">
                    <MessagesSquare size={26} strokeWidth={1.8} />
                  </div>
                  <h2 className="text-[20px] font-medium text-ink">Conversation not found</h2>
                  <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
                    This conversation may have been deleted or the link is invalid.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13.5px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
                  >
                    <Plus size={16} strokeWidth={2.2} />
                    <span>New chat</span>
                  </button>
                </div>
              ) : (
                <>
                  <HomeHero
                    inChatView={inChatView}
                    currentProject={currentProject}
                    isStreaming={isStreaming}
                    onSend={handleSend}
                    onStop={handleStop}
                  />

                  {inChatView && (
                    <>
                      <MessageList
                        messages={messages}
                        conversationId={activeConversationId || ""}
                        onSaveEdit={handleSaveEdit}
                        onRetry={handleRetry}
                        onContinue={handleContinue}
                      />
                      {/* Dynamic bottom spacer below the message list */}
                      <div className={`transition-all duration-500 ${isStreaming ? "h-[40vh]" : "h-6"}`} />
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <ScrollToBottomButton 
            show={showScrollBtn} 
            onClick={() => scrollToBottom(true)} 
            hasNewText={hasNewUnseenText}
          />

          {inChatView && !isNotFound && (
            <div className="shrink-0 px-4 pb-4 pt-1 lg:px-6">
              <div className="mx-auto w-full max-w-[720px]">
                {/* Suggested follow-up questions chips */}
                {!isStreaming && composerValue.trim() === "" && followups.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2 animate-fade-in select-none">
                    {followups.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(q)}
                        style={{ animationDelay: `${idx * 60}ms` }}
                        className="anim-fade-in anim-sheet-up rounded-full border border-line bg-elev-1 px-3.5 py-1.5 text-[13px] text-ink-soft hover:bg-elev-2 hover:text-ink hover:border-accent/40 active:scale-95 transition-all duration-200 cursor-pointer font-sans shadow-xs"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Queued next message status indicator */}
                {queuedMessage && (
                  <div className="mb-3 flex items-center justify-between rounded-lg border border-composer-line bg-composer px-3.5 py-1.5 text-[13px] text-ink font-sans animate-fade-in shadow-xs select-none">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0" />
                      <span className="font-semibold text-accent text-[12.5px] shrink-0">Queued next turn:</span>
                      <span className="truncate italic text-ink-soft max-w-[400px]">"{queuedMessage.text}"</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQueuedMessage(null)}
                      className="text-ink-muted hover:text-ink text-[11.5px] font-semibold underline underline-offset-2 cursor-pointer focus-visible:outline-none shrink-0"
                      title="Cancel queued message"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <Composer
                  onSend={handleSend}
                  onStop={handleStop}
                  isStreaming={isStreaming}
                  inChatView={true}
                  initialValue={composerInitial}
                  onEditLastMessage={handleEditLastMessage}
                  onChangeValue={setComposerValue}
                />
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
