import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  PanelLeft,
  MessagesSquare,
  Plus,
  Star,
  MoreHorizontal,
  Pencil,
  Download,
  Share2,
  Trash2,
  FolderGit2,
  Check,
  X,
} from "lucide-react";
import IconButton from "./shared/IconButton";
import ClaudeSpark from "./icons/ClaudeSpark";
import Composer from "./Composer";
import ChatMessage from "./chat/ChatMessage";

const ProjectsView = lazy(() => import("./views/ProjectsView"));
const ArtifactsView = lazy(() => import("./views/ArtifactsView"));
const CustomizeView = lazy(() => import("./views/CustomizeView"));
const CodeSessionsView = lazy(() => import("./views/CodeSessionsView"));
import type { Message, Attachment } from "../types/chat";
import { streamRealResponse } from "../utils/streamResponse";
import { getTimeGreeting } from "../utils/text";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";

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
    activeBranch,
    setActiveConversationId,
    saveMessage,
    updateMessageContent,
    triggerAutoTitle,
    preferences,
    projects,
    toggleStar,
    renameConversation,
    deleteConversation,
    branchEditUserMessage,
    branchRetryAssistantMessage,
  } = useChat();
  const { showToast } = useToast();

  const location = useLocation();
  const navigate = useNavigate();

  const isChatRoute = location.pathname.startsWith("/chat/");
  const routeChatId = isChatRoute
    ? location.pathname.replace("/chat/", "")
    : null;
  const isNotFound = Boolean(isChatRoute && routeChatId && !activeConversation);

  // Search param project context when starting new chat
  const searchParams = new URLSearchParams(location.search);
  const queryProjectId = searchParams.get("project");

  // Effective project ID (either on conversation or query param)
  const currentProjectId = activeConversation?.projectId || queryProjectId || null;
  const currentProject = currentProjectId
    ? projects.find((p) => p.id === currentProjectId)
    : null;

  const [isStreaming, setIsStreaming] = useState(false);
  const [composerInitial, setComposerInitial] = useState("");
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  const [lastOptions, setLastOptions] = useState({
    model: "sonnet-5",
    effort: "Medium",
    webSearch: false,
    extendedThinking: false,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const greetingPrefix = getTimeGreeting();

  // Active messages to display follow the active branch tree
  const messages = activeBranch;
  const inChatView = messages.length > 0;

  // Close chat actions menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setChatMenuOpen(false);
      }
    };
    if (chatMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [chatMenuOpen]);

  useEffect(() => {
    if (isRenaming) {
      setEditTitle(activeConversation?.title || "");
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 50);
    }
  }, [isRenaming, activeConversation]);

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
      isThinking: streamOpts.extendedThinking,
      isStreaming: true,
      createdAt: Date.now(),
    };

    // Save user message and assistant placeholder in store with project association
    saveMessage(conversationId, userMsg, currentProjectId);
    saveMessage(conversationId, assistantMsg, currentProjectId);

    if (!activeConversationId) {
      setActiveConversationId(conversationId);
    }

    setIsStreaming(true);
    setIsNearBottom(true);
    setComposerInitial("");

    setTimeout(() => scrollToBottom(true), 100);

    const promptText = text || (attachments && attachments[0]?.name ? `Analyze ${attachments[0].name}` : "Hello");
    const existingMessages = activeBranch || [];

    // Project instructions & knowledge grounding
    const projInstructions = currentProject?.instructions || undefined;
    const projKnowledge = currentProject?.knowledge?.map((k) => ({
      title: k.title,
      content: k.content,
    })) || undefined;

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
          updateMessageContent(
            conversationId,
            assistantMsgId,
            "",
            true,
            streamOpts.extendedThinking,
            ""
          );
        },
        onThinkingUpdate: (thoughts) => {
          updateMessageContent(
            conversationId,
            assistantMsgId,
            "",
            true,
            streamOpts.extendedThinking,
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

          if (isFirstExchange) {
            triggerAutoTitle(conversationId, promptText, fullText);
          }
        },
        onError: (err) => {
          updateMessageContent(
            conversationId,
            assistantMsgId,
            err.message || "An unexpected error occurred.",
            false,
            false
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
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMessage) {
      setComposerInitial(lastUserMessage.content);
    }
  };

  // Branching: Editing a user message creates a new version branch
  const handleSaveEdit = (messageId: string, newContent: string) => {
    if (!activeConversationId) return;

    abortRef.current?.abort();
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    const res = branchEditUserMessage(activeConversationId, messageId, newContent);
    if (!res) return;

    const { newAssistantMsg } = res;

    setIsStreaming(true);
    setIsNearBottom(true);
    setTimeout(() => scrollToBottom(true), 100);

    // Target parent message context
    const contextBranch = messages.slice(
      0,
      messages.findIndex((m) => m.id === messageId)
    );

    const projInstructions = currentProject?.instructions || undefined;
    const projKnowledge = currentProject?.knowledge?.map((k) => ({
      title: k.title,
      content: k.content,
    })) || undefined;

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
            ""
          );
        },
        onThinkingUpdate: (thoughts) => {
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            "",
            true,
            lastOptions.extendedThinking,
            thoughts
          );
        },
        onToken: (_token, fullText) => {
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            fullText,
            true,
            false
          );
        },
        onDone: (fullText) => {
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            fullText,
            false,
            false
          );
          setIsStreaming(false);
        },
        onError: (err) => {
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            err.message || "An unexpected error occurred.",
            false,
            false
          );
          setIsStreaming(false);
        },
      }
    );
  };

  // Branching: Retrying an assistant response creates a new version branch
  const handleRetry = (assistantMsgId: string) => {
    if (!activeConversationId) return;

    abortRef.current?.abort();
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    const res = branchRetryAssistantMessage(activeConversationId, assistantMsgId);
    if (!res) return;

    const { parentUserMsg, newAssistantMsg } = res;

    setIsStreaming(true);
    setIsNearBottom(true);
    setTimeout(() => scrollToBottom(true), 100);

    const userMsgIdx = messages.findIndex((m) => m.id === parentUserMsg.id);
    const contextBranch = messages.slice(0, userMsgIdx >= 0 ? userMsgIdx : undefined);

    const projInstructions = currentProject?.instructions || undefined;
    const projKnowledge = currentProject?.knowledge?.map((k) => ({
      title: k.title,
      content: k.content,
    })) || undefined;

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
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            "",
            true,
            lastOptions.extendedThinking,
            ""
          );
        },
        onThinkingUpdate: (thoughts) => {
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            "",
            true,
            lastOptions.extendedThinking,
            thoughts
          );
        },
        onToken: (_token, fullText) => {
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            fullText,
            true,
            false
          );
        },
        onDone: (fullText) => {
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            fullText,
            false,
            false
          );
          setIsStreaming(false);
        },
        onError: (err) => {
          updateMessageContent(
            activeConversationId,
            newAssistantMsg.id,
            err.message || "An unexpected error occurred.",
            false,
            false
          );
          setIsStreaming(false);
        },
      }
    );
  };

  // Export conversation as markdown file
  const handleExportMarkdown = () => {
    if (!activeConversation) return;
    const dateStr = new Date(activeConversation.createdAt).toLocaleDateString();
    let md = `# ${activeConversation.title}\n*Exported from Claude UI on ${dateStr}*\n\n---\n\n`;

    messages.forEach((m) => {
      const sender = m.role === "user" ? "### User" : "### Claude";
      md += `${sender}\n\n${m.content}\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const cleanTitle = activeConversation.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    link.href = url;
    link.download = `${cleanTitle || "conversation"}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Exported as Markdown", "success");
    setChatMenuOpen(false);
  };

  // Share conversation link
  const handleShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copied to clipboard", "success");
    } catch {
      showToast("Failed to copy link", "error");
    }
    setChatMenuOpen(false);
  };

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeConversationId && editTitle.trim()) {
      renameConversation(activeConversationId, editTitle.trim());
      showToast("Conversation renamed", "success");
    }
    setIsRenaming(false);
  };

  const handleDeleteActiveChat = () => {
    if (!activeConversationId) return;
    if (confirm("Are you sure you want to delete this conversation?")) {
      deleteConversation(activeConversationId);
      showToast("Conversation deleted", "info");
      setChatMenuOpen(false);
    }
  };

  return (
    <main className="relative flex h-full min-w-0 flex-1 flex-col bg-shell font-sans">
      {/* Top toolbar: mobile sidebar toggle & chat actions header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line/40 px-3 font-sans">
        <div className="flex items-center gap-2 min-w-0">
          {!sidebarOpen && onToggleSidebar && (
            <IconButton
              label="Open sidebar"
              onClick={onToggleSidebar}
              className="lg:hidden"
            >
              <PanelLeft size={18} strokeWidth={1.9} />
            </IconButton>
          )}

          {/* Active conversation title / project badge */}
          {activeConversation && activeView === "chat" && (
            <div className="flex items-center gap-2 min-w-0">
              {currentProject && (
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${currentProject.id}`)}
                  className="flex items-center gap-1.5 rounded-md bg-elev-2 px-2 py-0.5 text-[12px] font-medium text-accent hover:bg-elev-3 transition-colors shrink-0"
                >
                  <FolderGit2 size={13} />
                  <span className="truncate max-w-[120px]">{currentProject.name}</span>
                </button>
              )}

              {isRenaming ? (
                <form onSubmit={handleSaveRename} className="flex items-center gap-1">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="rounded border border-accent bg-elev-2 px-2 py-0.5 text-[13.5px] font-medium text-ink focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="p-1 text-accent hover:text-ink transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRenaming(false)}
                    className="p-1 text-ink-muted hover:text-ink transition-colors"
                  >
                    <X size={14} />
                  </button>
                </form>
              ) : (
                <h2
                  onClick={() => setIsRenaming(true)}
                  title="Click to rename"
                  className="text-[14.5px] font-medium text-ink truncate cursor-pointer hover:text-accent transition-colors max-w-[200px] sm:max-w-[340px]"
                >
                  {activeConversation.title}
                </h2>
              )}
            </div>
          )}
        </div>

        {/* Right Header Actions: Star & More menu */}
        {activeConversation && activeView === "chat" && (
          <div className="flex items-center gap-1 relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => {
                if (activeConversationId) toggleStar(activeConversationId);
              }}
              title={activeConversation.starred ? "Unstar chat" : "Star chat"}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-elev-2 ${
                activeConversation.starred
                  ? "text-amber-500 fill-amber-500"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Star
                size={16}
                strokeWidth={2}
                className={activeConversation.starred ? "fill-amber-500" : ""}
              />
            </button>

            <button
              type="button"
              onClick={() => setChatMenuOpen((v) => !v)}
              title="Chat actions"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-elev-2 hover:text-ink transition-colors"
            >
              <MoreHorizontal size={17} strokeWidth={2} />
            </button>

            {/* Chat actions dropdown */}
            {chatMenuOpen && (
              <div className="anim-modal-in absolute right-0 top-10 z-50 w-52 rounded-xl border border-line bg-elev-1 p-1.5 shadow-2xl font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setIsRenaming(true);
                    setChatMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] text-ink hover:bg-elev-2 transition-colors"
                >
                  <Pencil size={15} className="text-ink-muted" />
                  <span>Rename</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (activeConversationId) toggleStar(activeConversationId);
                    setChatMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] text-ink hover:bg-elev-2 transition-colors"
                >
                  <Star size={15} className="text-ink-muted" />
                  <span>{activeConversation.starred ? "Unstar" : "Star"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] text-ink hover:bg-elev-2 transition-colors"
                >
                  <Download size={15} className="text-ink-muted" />
                  <span>Export as Markdown</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareLink}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] text-ink hover:bg-elev-2 transition-colors"
                >
                  <Share2 size={15} className="text-ink-muted" />
                  <span>Share link</span>
                </button>

                <div className="my-1 border-t border-line/60" />

                <button
                  type="button"
                  onClick={handleDeleteActiveChat}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={15} />
                  <span>Delete chat</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Routed Views with Suspense */}
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-ink-muted animate-pulse">Loading...</div>}>
        {activeView === "projects" && <ProjectsView />}
        {activeView === "artifacts" && (
          <ArtifactsView />
        )}
        {activeView === "customize" && <CustomizeView />}
        {activeView === "code" && <CodeSessionsView />}
      </Suspense>

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
              {/* NOT FOUND STATE */}
              {isNotFound ? (
                <div className="flex flex-1 flex-col items-center justify-center py-16 text-center font-sans">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-elev-2 text-ink-muted mb-4 shadow-sm">
                    <MessagesSquare size={26} strokeWidth={1.8} />
                  </div>
                  <h2 className="text-[20px] font-medium text-ink">
                    Conversation not found
                  </h2>
                  <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
                    This conversation may have been deleted or the link is invalid.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13.5px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <Plus size={16} strokeWidth={2.2} />
                    <span>New chat</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* HOME VIEW: greeting and centered layout */}
                  <div
                    className={`transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      inChatView
                        ? "max-h-0 opacity-0 overflow-hidden pointer-events-none -translate-y-4"
                        : "flex flex-1 flex-col items-center justify-center pt-8 pb-12 opacity-100 translate-y-0"
                    }`}
                  >
                    <h1 className="anim-rise flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-3.5 text-center font-serif text-[clamp(28px,4.5vw,48px)] font-normal leading-[1.15] tracking-[-0.01em] text-ink">
                      <ClaudeSpark size={46} className="shrink-0 text-accent mb-1 sm:mb-0" />
                      <span className="break-words max-w-[90vw] sm:max-w-none">{greetingPrefix} how are things?</span>
                    </h1>

                    {/* Active Project indicator if starting chat within project */}
                    {currentProject && !inChatView && (
                      <div className="mt-4 flex items-center gap-2 rounded-full border border-line bg-elev-2 px-3.5 py-1 text-[13px] text-ink-soft">
                        <FolderGit2 size={14} className="text-accent" />
                        <span>Project: <strong>{currentProject.name}</strong></span>
                      </div>
                    )}

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

                  {/* CHAT VIEW: messages list along active branch */}
                  {inChatView && (
                    <div className="mx-auto w-full max-w-[720px] flex-1 pb-6 pt-2">
                      {messages.map((message, idx) => {
                        const prevUserMsg = messages
                          .slice(0, idx)
                          .reverse()
                          .find((m) => m.role === "user");
                        return (
                          <ChatMessage
                            key={message.id}
                            message={message}
                            userPrompt={prevUserMsg?.content || ""}
                            conversationId={activeConversationId || ""}
                            onSaveEdit={handleSaveEdit}
                            onRetry={handleRetry}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
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
            <div
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
              className="shrink-0 px-4 pb-3 pt-2 bg-gradient-to-t from-shell via-shell to-transparent transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
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
