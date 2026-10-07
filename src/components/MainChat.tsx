import { useEffect, useRef, useState } from "react";
import { ArrowDown, PanelLeft } from "lucide-react";
import IconButton from "./shared/IconButton";
import ClaudeSpark from "./icons/ClaudeSpark";
import Composer from "./Composer";
import ChatMessage from "./chat/ChatMessage";
import ProjectsView from "./views/ProjectsView";
import ArtifactsView from "./views/ArtifactsView";
import CustomizeView from "./views/CustomizeView";
import CodeSessionsView from "./views/CodeSessionsView";
import type { Message, Attachment } from "../types/chat";
import { streamSimulatedResponse } from "../utils/streamResponse";
import { getTimeGreeting } from "../utils/text";
import { useChat } from "../context/ChatContext";

type Props = {
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
};

export default function MainChat({
  sidebarOpen,
  onToggleSidebar,
}: Props) {
  const {
    activeView,
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    saveMessage,
    setConversationMessages,
    updateMessageContent,
    triggerAutoTitle,
    openArtifact,
  } = useChat();

  const [isStreaming, setIsStreaming] = useState(false);
  const [composerInitial, setComposerInitial] = useState("");
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const greetingPrefix = getTimeGreeting();

  // Messages are derived from active conversation
  const messages = activeConversation?.messages || [];
  const inChatView = messages.length > 0;

  // Auto-scroll handler
  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distToBottom = scrollHeight - (scrollTop + clientHeight);
    const near = distToBottom < 80;
    setIsNearBottom(near);
    setShowScrollBtn(!near && inChatView);
  };

  const scrollToBottom = (smooth = true) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // Scroll to bottom when new messages arrive if near bottom
  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom(false);
    }
  }, [messages, isNearBottom]);

  // Clean up streaming on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = (text: string, attachments?: Attachment[]) => {
    if ((!text.trim() && (!attachments || attachments.length === 0)) || isStreaming)
      return;

    abortRef.current?.abort();
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    // Use current conversation ID or create new one
    const conversationId = activeConversationId || `conv-${Date.now()}`;
    const isFirstExchange =
      !activeConversation || activeConversation.messages.length === 0;

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
      isThinking: true,
      isStreaming: true,
      createdAt: Date.now(),
    };

    // Save user message and assistant placeholder in store
    saveMessage(conversationId, userMsg);
    saveMessage(conversationId, assistantMsg);

    if (!activeConversationId) {
      setActiveConversationId(conversationId);
    }

    setIsStreaming(true);
    setIsNearBottom(true);
    setComposerInitial("");

    setTimeout(() => scrollToBottom(true), 100);

    const promptText = text || (attachments && attachments[0]?.name ? `Analyze ${attachments[0].name}` : "Hello");

    streamSimulatedResponse(promptText, abortCtrl.signal, {
      onThinkingStart: () => {
        updateMessageContent(
          conversationId,
          assistantMsgId,
          "",
          true,
          true
        );
      },
      onThinkingUpdate: (thoughts) => {
        updateMessageContent(
          conversationId,
          assistantMsgId,
          "",
          true,
          true,
          thoughts
        );
      },
      onToken: (_token, fullText) => {
        updateMessageContent(
          conversationId,
          assistantMsgId,
          fullText,
          true,
          false
        );
      },
      onDone: (fullText) => {
        updateMessageContent(
          conversationId,
          assistantMsgId,
          fullText,
          false,
          false
        );
        setIsStreaming(false);

        // Auto-title generation with typewriter effect after first reply
        if (isFirstExchange) {
          triggerAutoTitle(conversationId, promptText, fullText);
        }
      },
      onError: () => {
        updateMessageContent(
          conversationId,
          assistantMsgId,
          "",
          false,
          false
        );
        setIsStreaming(false);
      },
    });
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    if (activeConversationId) {
      const activeMsgs = activeConversation?.messages || [];
      const streamingMsg = activeMsgs.find((m) => m.isStreaming);
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

  // Up arrow in empty composer loads the last user message
  const handleEditLastMessage = () => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMessage) {
      setComposerInitial(lastUserMessage.content);
    }
  };

  // Inline edit on message: truncates later messages and regenerates response
  const handleSaveEdit = (messageId: string, newContent: string) => {
    if (!activeConversationId) return;

    abortRef.current?.abort();
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    const targetIdx = messages.findIndex((m) => m.id === messageId);
    if (targetIdx === -1) return;

    // Truncate messages after target message
    const truncated = messages.slice(0, targetIdx + 1).map((m) =>
      m.id === messageId ? { ...m, content: newContent } : m
    );

    const assistantMsgId = `a-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      thinking: "",
      isThinking: true,
      isStreaming: true,
      createdAt: Date.now(),
    };

    const nextMessages = [...truncated, assistantMsg];
    setConversationMessages(activeConversationId, nextMessages);

    setIsStreaming(true);
    setIsNearBottom(true);
    setTimeout(() => scrollToBottom(true), 100);

    streamSimulatedResponse(newContent, abortCtrl.signal, {
      onThinkingStart: () => {
        updateMessageContent(
          activeConversationId,
          assistantMsgId,
          "",
          true,
          true
        );
      },
      onThinkingUpdate: (thoughts) => {
        updateMessageContent(
          activeConversationId,
          assistantMsgId,
          "",
          true,
          true,
          thoughts
        );
      },
      onToken: (_token, fullText) => {
        updateMessageContent(
          activeConversationId,
          assistantMsgId,
          fullText,
          true,
          false
        );
      },
      onDone: (fullText) => {
        updateMessageContent(
          activeConversationId,
          assistantMsgId,
          fullText,
          false,
          false
        );
        setIsStreaming(false);
      },
      onError: () => {
        updateMessageContent(
          activeConversationId,
          assistantMsgId,
          "",
          false,
          false
        );
        setIsStreaming(false);
      },
    });
  };

  const handleRetry = () => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMessage) {
      handleSend(lastUserMessage.content, lastUserMessage.attachments);
    }
  };

  return (
    <main className="relative flex h-full min-w-0 flex-1 flex-col bg-shell font-sans">
      {/* Top toolbar: mobile sidebar toggle */}
      <div className="flex h-12 shrink-0 items-center justify-between px-2.5">
        {!sidebarOpen && onToggleSidebar ? (
          <IconButton
            label="Open sidebar"
            onClick={onToggleSidebar}
            className="lg:hidden"
          >
            <PanelLeft size={18} strokeWidth={1.9} />
          </IconButton>
        ) : (
          <div />
        )}
      </div>

      {/* Routed Views */}
      {activeView === "projects" && <ProjectsView />}
      {activeView === "artifacts" && (
        <ArtifactsView onOpenArtifact={openArtifact} />
      )}
      {activeView === "customize" && <CustomizeView />}
      {activeView === "code" && <CodeSessionsView />}

      {/* Chat View */}
      {activeView === "chat" && (
        <>
          {/* Scrollable stage */}
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="scroll-slim relative min-h-0 flex-1 overflow-y-auto"
          >
            <div className="flex min-h-full flex-col px-4 lg:px-6">
              {/* HOME VIEW: greeting and centered layout */}
              <div
                className={`transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  inChatView
                    ? "max-h-0 opacity-0 overflow-hidden pointer-events-none -translate-y-4"
                    : "flex flex-1 flex-col items-center justify-center pt-8 pb-12 opacity-100 translate-y-0"
                }`}
              >
                <h1 className="anim-rise flex items-center gap-3 text-center font-serif text-[clamp(32px,5.2vw,52px)] font-normal leading-[1.1] tracking-[-0.01em] text-[#edeae4]">
                  <ClaudeSpark size={46} className="shrink-0 text-accent" />
                  <span>{greetingPrefix} how are things?</span>
                </h1>

                {/* Composer centered on Home View */}
                {!inChatView && (
                  <div className="mt-9 w-full max-w-[690px]">
                    <Composer
                      onSend={handleSend}
                      onStop={handleStop}
                      isStreaming={isStreaming}
                      inChatView={false}
                      initialValue={composerInitial}
                      onEditLastMessage={handleEditLastMessage}
                    />
                  </div>
                )}
              </div>

              {/* CHAT VIEW: messages list */}
              {inChatView && (
                <div className="mx-auto w-full max-w-[720px] flex-1 pb-6 pt-2">
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      onSaveEdit={handleSaveEdit}
                      onRetry={handleRetry}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Floating scroll to bottom button */}
          {showScrollBtn && (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              title="Scroll to bottom"
              className="absolute bottom-28 right-6 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-elev-2 text-ink shadow-lg transition-all duration-200 hover:bg-elev-3 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <ArrowDown size={16} strokeWidth={2} />
            </button>
          )}

          {/* DOCKED COMPOSER (In Chat View) */}
          {inChatView && (
            <div className="shrink-0 px-4 pb-3 pt-2 bg-gradient-to-t from-shell via-shell to-transparent transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]">
              <div className="mx-auto w-full max-w-[720px]">
                <Composer
                  onSend={handleSend}
                  onStop={handleStop}
                  isStreaming={isStreaming}
                  inChatView={true}
                  initialValue={composerInitial}
                  onEditLastMessage={handleEditLastMessage}
                />
                {/* Disclaimer footer */}
                <p className="mt-2 text-center text-[12px] text-ink-faint select-none">
                  Claude can make mistakes. Please double-check responses.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
