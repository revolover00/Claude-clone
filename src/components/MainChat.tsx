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
import { streamRealResponse } from "../utils/streamResponse";
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
  } = useChat();

  const [isStreaming, setIsStreaming] = useState(false);
  const [composerInitial, setComposerInitial] = useState("");
  const [lastOptions, setLastOptions] = useState({
    model: "sonnet-5",
    effort: "Medium",
    webSearch: false,
    extendedThinking: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  const messages = activeBranch;
  const inChatView = messages.length > 0;
  const isNotFound = activeView === "chat" && activeConversationId && !activeConversation;

  // Auto scroll hook
  const { scrollRef, checkScroll, showScrollBtn, scrollToBottom } = useAutoScroll(
    messages,
    inChatView
  );

  // Derive current project association
  const currentProjectId = activeConversation?.projectId || null;
  const currentProject = projects.find((p) => p.id === currentProjectId);

  // Clean up streaming on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = (
    text: string,
    attachments?: Attachment[],
    options?: {
      model: string;
      effort: string;
      webSearch: boolean;
      extendedThinking: boolean;
    }
  ) => {
    if ((!text.trim() && (!attachments || attachments.length === 0)) || isStreaming)
      return;

    const streamOpts = {
      model: options?.model || lastOptions.model,
      effort: options?.effort || lastOptions.effort,
      webSearch: options?.webSearch ?? lastOptions.webSearch,
      extendedThinking: options?.extendedThinking ?? lastOptions.extendedThinking,
    };
    if (options) {
      setLastOptions(options);
    }

    abortRef.current?.abort();
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    const conversationId = activeConversationId || `conv-${Date.now()}`;
    const isFirstExchange = !activeConversation || activeConversation.messages.length === 0;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    };

    const assistantMsgId = `a-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      thinking: "",
      isThinking: streamOpts.extendedThinking,
      isStreaming: true,
      isSearchingWeb: streamOpts.webSearch,
      createdAt: Date.now(),
    };

    saveMessage(conversationId, userMsg, currentProjectId);
    saveMessage(conversationId, assistantMsg, currentProjectId);

    if (!activeConversationId) {
      setActiveConversationId(conversationId);
    }

    setIsStreaming(true);
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

    streamRealResponse(
      promptText,
      abortCtrl.signal,
      {
        messages: existingMessages,
        style: preferences.responseStyle,
        profileInstructions: preferences.profileInstructions,
        projectInstructions: projInstructions,
        projectKnowledge: projKnowledge,
        model: streamOpts.model,
        effort: streamOpts.effort,
        webSearch: streamOpts.webSearch,
        extendedThinking: streamOpts.extendedThinking,
        language: preferences.language,
      },
      {
        onThinkingStart: () => {
          updateMessageContent(conversationId, assistantMsgId, "", true, streamOpts.extendedThinking, "");
        },
        onThinkingUpdate: (thoughts) => {
          updateMessageContent(conversationId, assistantMsgId, "", true, streamOpts.extendedThinking, thoughts);
        },
        onSources: (sources) => {
          receivedSources = sources;
          updateMessageContent(conversationId, assistantMsgId, "", true, false, undefined, undefined, sources, false);
        },
        onToken: (_token, fullText) => {
          updateMessageContent(conversationId, assistantMsgId, fullText, true, false, undefined, undefined, receivedSources, false);
        },
        onDone: (fullText) => {
          updateMessageContent(conversationId, assistantMsgId, fullText, false, false, undefined, undefined, receivedSources, false);
          setIsStreaming(false);

          if (isFirstExchange) {
            triggerAutoTitle(conversationId, promptText, fullText);
          }
        },
        onError: (err) => {
          updateMessageContent(
            conversationId,
            assistantMsgId,
            "",
            false,
            false,
            undefined,
            {
              isError: true,
              errorText: err.message || "An unexpected error occurred.",
              errorDetails: (err as any).details || (err.stack ? String(err.stack) : undefined),
            }
          );
          setIsStreaming(false);
        },
      }
    );
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    if (activeConversationId) {
      const streamingMsg = messages.find((m) => m.isStreaming);
      if (streamingMsg) {
        updateMessageContent(
          activeConversationId,
          streamingMsg.id,
          streamingMsg.content,
          false,
          false
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
          updateMessageContent(activeConversationId, newAssistantMsg.id, "", true, lastOptions.extendedThinking, "");
        },
        onThinkingUpdate: (thoughts) => {
          updateMessageContent(activeConversationId, newAssistantMsg.id, "", true, lastOptions.extendedThinking, thoughts);
        },
        onSources: (sources) => {
          receivedSources = sources;
          updateMessageContent(activeConversationId, newAssistantMsg.id, "", true, false, undefined, undefined, sources, false);
        },
        onToken: (_token, fullText) => {
          updateMessageContent(activeConversationId, newAssistantMsg.id, fullText, true, false, undefined, undefined, receivedSources, false);
        },
        onDone: (fullText) => {
          updateMessageContent(activeConversationId, newAssistantMsg.id, fullText, false, false, undefined, undefined, receivedSources, false);
          setIsStreaming(false);
        },
        onError: (err) => {
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            "",
            false,
            false,
            undefined,
            {
              isError: true,
              errorText: err.message || "An unexpected error occurred.",
              errorDetails: (err as any).details || (err.stack ? String(err.stack) : undefined),
            }
          );
          setIsStreaming(false);
        },
      }
    );
  };

  const handleRetry = (assistantMsgId: string) => {
    if (!activeConversationId) return;

    abortRef.current?.abort();
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    const res = branchRetryAssistantMessage(activeConversationId, assistantMsgId);
    if (!res) return;

    const { parentUserMsg, newAssistantMsg } = res;
    setIsStreaming(true);
    setTimeout(() => scrollToBottom(true), 80);

    const userMsgIdx = messages.findIndex((m) => m.id === parentUserMsg.id);
    const contextBranch = messages.slice(0, userMsgIdx >= 0 ? userMsgIdx : undefined);

    const projInstructions = currentProject?.instructions || undefined;
    const projKnowledge = currentProject?.knowledge?.map((k) => ({
      title: k.title,
      content: k.content,
    })) || undefined;

    let receivedSources: Array<{ title: string; url: string }> | undefined;

    streamRealResponse(
      parentUserMsg.content,
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
          updateMessageContent(activeConversationId, newAssistantMsg.id, "", true, lastOptions.extendedThinking, "");
        },
        onThinkingUpdate: (thoughts) => {
          updateMessageContent(activeConversationId, newAssistantMsg.id, "", true, lastOptions.extendedThinking, thoughts);
        },
        onSources: (sources) => {
          receivedSources = sources;
          updateMessageContent(activeConversationId, newAssistantMsg.id, "", true, false, undefined, undefined, sources, false);
        },
        onToken: (_token, fullText) => {
          updateMessageContent(activeConversationId, newAssistantMsg.id, fullText, true, false, undefined, undefined, receivedSources, false);
        },
        onDone: (fullText) => {
          updateMessageContent(activeConversationId, newAssistantMsg.id, fullText, false, false, undefined, undefined, receivedSources, false);
          setIsStreaming(false);
        },
        onError: (err) => {
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            "",
            false,
            false,
            undefined,
            {
              isError: true,
              errorText: err.message || "An unexpected error occurred.",
              errorDetails: (err as any).details || (err.stack ? String(err.stack) : undefined),
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
                    <MessageList
                      messages={messages}
                      conversationId={activeConversationId || ""}
                      onSaveEdit={handleSaveEdit}
                      onRetry={handleRetry}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          <ScrollToBottomButton show={showScrollBtn} onClick={() => scrollToBottom(true)} />

          {inChatView && !isNotFound && (
            <div className="shrink-0 px-4 pb-4 pt-1 lg:px-6">
              <div className="mx-auto w-full max-w-[720px]">
                <Composer
                  onSend={handleSend}
                  onStop={handleStop}
                  isStreaming={isStreaming}
                  inChatView={true}
                  initialValue={composerInitial}
                  onEditLastMessage={handleEditLastMessage}
                />
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
