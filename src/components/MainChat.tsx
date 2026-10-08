import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { MessagesSquare, Plus } from "lucide-react";
import Composer from "./Composer";
import ChatHeader from "./chat/ChatHeader";
import MessageList from "./chat/MessageList";
import HomeHero from "./chat/HomeHero";
import ScrollToBottomButton from "./chat/ScrollToBottomButton";
import { useAutoScroll } from "./chat/useAutoScroll";
import { useChat } from "../context/ChatContext";
import { useChatStreaming } from "./chat/useChatStreaming";

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

  const messages = activeBranch;
  const inChatView = messages.length > 0;
  const isNotFound = activeView === "chat" && activeConversationId && !activeConversation;

  // Derive current project association
  const currentProjectId = activeConversation?.projectId || null;
  const currentProject = projects.find((p) => p.id === currentProjectId);

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

  const {
    isStreaming,
    composerInitial,
    composerValue,
    setComposerValue,
    followups,
    queuedMessage,
    setQueuedMessage,
    handleSend,
    handleStop,
    handleContinue,
    handleSaveEdit,
    handleRetry,
    handleEditLastMessage,
  } = useChatStreaming({
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
    scrollToBottom: (smooth: boolean) => scrollToBottom(smooth),
    scrollToUserMessage,
  });

  const { scrollRef, checkScroll, showScrollBtn, hasNewUnseenText, scrollToBottom } = useAutoScroll(
    messages,
    inChatView,
    isStreaming
  );

  useEffect(() => {
    const handleGlobalEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isStreaming) {
        handleStop();
      }
    };
    window.addEventListener("keydown", handleGlobalEscape);
    return () => window.removeEventListener("keydown", handleGlobalEscape);
  }, [isStreaming, handleStop]);

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
    return () => window.removeEventListener("claude:fix-artifact-error", handleFixErrorEvent);
  }, [handleSend]);

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
