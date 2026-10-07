import { useState, useRef, useEffect } from "react";
import {
  PanelLeft,
  MessagesSquare,
  CodeXml,
  Plus,
  Archive,
  Shapes,
  Briefcase,
  Search,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Download,
  MoreHorizontal,
  Star,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "../utils/cn";
import IconButton from "./shared/IconButton";
import UserMenu from "./modals/UserMenu";
import { useChat } from "../context/ChatContext";
import type { Conversation } from "../types/chat";

type Props = {
  open: boolean;
  onToggle: () => void;
};

const NAV = [
  { label: "Projects", icon: Archive, view: "projects" as const },
  { label: "Artifacts", icon: Shapes, view: "artifacts" as const },
  { label: "Customize", icon: Briefcase, view: "customize" as const },
];

function groupConversations(conversations: Conversation[]) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7Days = startOfToday - 86400000 * 6;

  const groups: { label: string; items: Conversation[] }[] = [];

  const starred = conversations.filter((c) => c.starred);
  if (starred.length > 0) {
    groups.push({ label: "Starred", items: starred });
  }

  // Exclude starred items from time groups if already starred
  const nonStarred = conversations.filter((c) => !c.starred);

  const today = nonStarred.filter((c) => c.updatedAt >= startOfToday);
  if (today.length > 0) groups.push({ label: "Today", items: today });

  const yesterday = nonStarred.filter(
    (c) => c.updatedAt >= startOfYesterday && c.updatedAt < startOfToday
  );
  if (yesterday.length > 0) groups.push({ label: "Yesterday", items: yesterday });

  const prev7 = nonStarred.filter(
    (c) => c.updatedAt >= startOf7Days && c.updatedAt < startOfYesterday
  );
  if (prev7.length > 0) groups.push({ label: "Previous 7 days", items: prev7 });

  const older = nonStarred.filter((c) => c.updatedAt < startOf7Days);
  if (older.length > 0) groups.push({ label: "Older", items: older });

  return groups;
}

export default function Sidebar({ open, onToggle }: Props) {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    createNewChat,
    deleteConversation,
    toggleStar,
    renameConversation,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    activeView,
    setActiveView,
    setSearchModalOpen,
  } = useChat();

  const [tab, setTab] = useState<"chat" | "code">("chat");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 750);
    return () => clearTimeout(timer);
  }, []);

  // Chat item menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  const handleStartRename = (c: Conversation) => {
    setEditingId(c.id);
    setEditingTitle(c.title);
    setActiveMenuId(null);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim()) {
      renameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const grouped = groupConversations(conversations);

  // Collapsed rail view
  if (!open) {
    return (
      <aside className="fixed inset-y-0 left-0 z-40 flex h-full shrink-0 flex-col items-center border-r border-line bg-panel transition-all duration-200 ease-out -translate-x-full lg:translate-x-0 lg:static lg:w-[52px]">
        {/* toggle button to expand */}
        <div className="flex h-12 w-full shrink-0 items-center justify-center">
          <IconButton label="Open sidebar" onClick={onToggle}>
            <PanelLeft size={18} strokeWidth={1.9} />
          </IconButton>
        </div>

        {/* nav icon rail */}
        <div className="flex flex-1 flex-col items-center gap-1.5 pt-1">
          <IconButton
            label="New chat"
            onClick={() => {
              createNewChat();
            }}
          >
            <Plus size={18} strokeWidth={2} />
          </IconButton>

          <IconButton
            label="Search (⌘K)"
            onClick={() => setSearchModalOpen(true)}
          >
            <Search size={18} strokeWidth={1.8} />
          </IconButton>

          <IconButton
            label="Chats"
            active={activeView === "chat"}
            onClick={() => {
              setActiveView("chat");
              onToggle();
            }}
          >
            <MessagesSquare size={18} strokeWidth={1.8} />
          </IconButton>

          <IconButton
            label="Projects"
            active={activeView === "projects"}
            onClick={() => {
              setActiveView("projects");
            }}
          >
            <Archive size={18} strokeWidth={1.8} />
          </IconButton>

          <IconButton
            label="Artifacts"
            active={activeView === "artifacts"}
            onClick={() => {
              setActiveView("artifacts");
            }}
          >
            <Shapes size={18} strokeWidth={1.8} />
          </IconButton>

          <IconButton
            label="Code sessions"
            active={activeView === "code"}
            onClick={() => {
              setActiveView("code");
            }}
          >
            <CodeXml size={18} strokeWidth={1.8} />
          </IconButton>
        </div>

        {/* user avatar at bottom */}
        <div className="relative flex h-14 w-full shrink-0 items-center justify-center border-t border-line-soft">
          <button
            type="button"
            title="Account"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-elev-3 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-elev-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            N
          </button>
          <UserMenu
            isOpen={userMenuOpen}
            onClose={() => setUserMenuOpen(false)}
          />
        </div>
      </aside>
    );
  }

  // Expanded sidebar view
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex h-full shrink-0 flex-col border-r border-line bg-panel transition-all duration-200 ease-out lg:static w-[85vw] max-w-[320px] lg:w-[280px] lg:max-w-none">
      {/* Top toolbar with Panel toggle, Search, and History Back/Forward */}
      <div className="flex h-12 shrink-0 items-center justify-between px-2">
        <div className="flex items-center gap-0.5">
          <IconButton label="Close sidebar" onClick={onToggle}>
            <PanelLeft size={18} strokeWidth={1.9} />
          </IconButton>

          <IconButton
            label="Search (⌘K)"
            onClick={() => setSearchModalOpen(true)}
          >
            <Search size={18} strokeWidth={1.9} />
          </IconButton>
        </div>

        <div className="flex items-center gap-0.5">
          <IconButton
            label="Back in history"
            disabled={!canGoBack}
            onClick={goBack}
          >
            <ArrowLeft size={17} strokeWidth={1.9} />
          </IconButton>
          <IconButton
            label="Forward in history"
            disabled={!canGoForward}
            onClick={goForward}
          >
            <ArrowRight size={17} strokeWidth={1.9} />
          </IconButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
        {/* Segmented control with smooth sliding pill indicator */}
        <div
          role="tablist"
          aria-label="Workspace"
          className="relative flex rounded-lg border border-line bg-elev-1 p-[3px]"
        >
          {/* Sliding indicator pill */}
          <div
            className={`absolute top-[3px] bottom-[3px] w-[calc(50%-3px)] rounded-md bg-elev-4 shadow-sm transition-transform duration-200 ease-out ${
              tab === "code" ? "translate-x-full" : "translate-x-0"
            }`}
          />

          <button
            role="tab"
            type="button"
            aria-selected={tab === "chat"}
            onClick={() => {
              setTab("chat");
              setActiveView("chat");
            }}
            className={cn(
              "relative z-10 flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-md text-[13.5px] font-medium transition-colors duration-150",
              tab === "chat" ? "text-ink" : "text-ink-muted hover:text-ink-soft"
            )}
          >
            <MessagesSquare size={15} strokeWidth={1.9} />
            Chat
          </button>

          <button
            role="tab"
            type="button"
            aria-selected={tab === "code"}
            onClick={() => {
              setTab("code");
              setActiveView("code");
            }}
            className={cn(
              "relative z-10 flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-md text-[13.5px] font-medium transition-colors duration-150",
              tab === "code" ? "text-ink" : "text-ink-muted hover:text-ink-soft"
            )}
          >
            <CodeXml size={15} strokeWidth={1.9} />
            Code
          </button>
        </div>

        {/* New chat button */}
        <button
          type="button"
          onClick={() => {
            createNewChat();
          }}
          className="mt-3 flex h-[34px] w-full items-center gap-2.5 rounded-lg bg-elev-3 px-2.5 text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-elev-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <Plus size={16} strokeWidth={2} />
          New chat
        </button>

        {/* Primary nav: Projects, Artifacts, Customize */}
        <nav className="mt-1.5 flex flex-col gap-0.5">
          {NAV.map(({ label, icon: Icon, view }) => {
            const isActive = activeView === view;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setActiveView(view);
                }}
                className={cn(
                  "flex h-[34px] items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                  isActive
                    ? "bg-elev-2 text-ink font-medium"
                    : "text-ink-soft hover:bg-elev-2 hover:text-ink"
                )}
              >
                <Icon
                  size={17}
                  strokeWidth={1.8}
                  className={isActive ? "text-accent" : "text-ink-muted"}
                />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Chats header */}
        <div className="mt-6 flex items-center justify-between px-2 pb-1">
          <span className="text-[12.5px] font-medium text-ink-muted">
            Chats ({conversations.length})
          </span>
        </div>

        {/* Grouped conversations list */}
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto pb-4">
          {isLoading ? (
            /* Loading skeleton shimmer on first load */
            <div className="animate-pulse space-y-4 px-2 py-3 select-none">
              <div className="space-y-2">
                <div className="h-2 w-12 rounded bg-elev-3/50" />
                <div className="space-y-1.5">
                  <div className="h-8 w-full rounded-md bg-elev-2/40" />
                  <div className="h-8 w-full rounded-md bg-elev-2/40" />
                  <div className="h-8 w-full rounded-md bg-elev-2/40" />
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-2 w-16 rounded bg-elev-3/50" />
                <div className="space-y-1.5">
                  <div className="h-8 w-full rounded-md bg-elev-2/40" />
                  <div className="h-8 w-full rounded-md bg-elev-2/40" />
                </div>
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-2 py-6 text-center text-[13px] text-ink-muted">
              No recent conversations
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className="mt-2">
                <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((conv) => {
                    const isActive =
                      activeView === "chat" &&
                      activeConversationId === conv.id;
                    const isMenuOpen = activeMenuId === conv.id;
                    const isEditing = editingId === conv.id;
                    const isDeleting = deletingId === conv.id;

                    return (
                      <div
                        key={conv.id}
                        className={cn(
                          "group anim-chat-item-in relative flex h-8 items-center rounded-md px-2 text-[13.5px] transition-colors",
                          isActive
                            ? "bg-elev-2 text-ink font-medium"
                            : "text-ink-soft hover:bg-elev-2 hover:text-ink"
                        )}
                      >
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={() => handleSaveRename(conv.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveRename(conv.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-6 w-full rounded bg-elev-3 px-1.5 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveConversationId(conv.id);
                              setActiveView("chat");
                            }}
                            className="flex-1 truncate text-start"
                            title={conv.title}
                          >
                            <span className="truncate">
                              {conv.title}
                              {conv.isTypingTitle && (
                                <span className="inline-block w-1.5 h-3 ml-0.5 bg-accent animate-pulse" />
                              )}
                            </span>
                          </button>
                        )}

                        {/* Star indicator or hover action menu */}
                        <div className="flex items-center gap-0.5">
                          {conv.starred && !isMenuOpen && !isEditing && (
                            <Star
                              size={12}
                              fill="currentColor"
                              className="text-accent shrink-0 ms-1"
                            />
                          )}

                          {/* Three dots hover button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId((prev) =>
                                  prev === conv.id ? null : conv.id
                                );
                              }}
                              className={cn(
                                "h-6 w-6 items-center justify-center rounded text-ink-muted transition-colors hover:text-ink hover:bg-elev-3 focus:outline-none",
                                isMenuOpen ? "flex" : "hidden group-hover:flex"
                              )}
                              title="Conversation options"
                            >
                              <MoreHorizontal size={14} />
                            </button>

                            {/* Dropdown menu */}
                            {isMenuOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    setDeletingId(null);
                                  }}
                                />
                                <div className="anim-popover-in absolute right-0 top-7 z-40 w-44 rounded-lg border border-line bg-elev-1 p-1 shadow-xl">
                                  {isDeleting ? (
                                    <div className="p-2 text-start">
                                      <p className="text-[12px] font-medium text-ink">
                                        Delete chat?
                                      </p>
                                      <p className="mt-0.5 text-[11px] text-ink-muted">
                                        This cannot be undone.
                                      </p>
                                      <div className="mt-2.5 flex justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setDeletingId(null)}
                                          className="rounded px-2 py-0.5 text-[11px] text-ink-muted hover:text-ink"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            deleteConversation(conv.id);
                                            setActiveMenuId(null);
                                            setDeletingId(null);
                                          }}
                                          className="rounded bg-[#a83428] px-2 py-0.5 text-[11px] font-medium text-white hover:bg-[#bd3d30]"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleStar(conv.id);
                                          setActiveMenuId(null);
                                        }}
                                        className="flex h-7 w-full items-center gap-2 rounded px-2 text-[12.5px] text-ink-soft hover:bg-elev-2 hover:text-ink"
                                      >
                                        <Star
                                          size={13}
                                          className={
                                            conv.starred ? "text-accent" : ""
                                          }
                                        />
                                        <span>
                                          {conv.starred ? "Unstar" : "Star"}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartRename(conv);
                                        }}
                                        className="flex h-7 w-full items-center gap-2 rounded px-2 text-[12.5px] text-ink-soft hover:bg-elev-2 hover:text-ink"
                                      >
                                        <Pencil size={13} />
                                        <span>Rename</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingId(conv.id);
                                        }}
                                        className="flex h-7 w-full items-center gap-2 rounded px-2 text-[12.5px] text-[#f08578] hover:bg-[#68241d]/30"
                                      >
                                        <Trash2 size={13} />
                                        <span>Delete</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* User profile row with popup menu */}
        <div className="relative -mx-3 flex h-16 shrink-0 items-center justify-between border-t border-line-soft px-3">
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pe-1 text-start transition-colors duration-150 hover:bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-elev-3 text-[11px] font-semibold text-ink-soft">
              N
            </span>
            <span className="truncate text-[13px] font-medium text-ink">
              Nolen
            </span>
            <span className="shrink-0 text-[12px] text-ink-muted">· Free</span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className="shrink-0 text-ink-muted ms-auto"
            />
          </button>

          <IconButton
            label="Download apps"
            onClick={() =>
              alert("Claude desktop & mobile apps are available at claude.ai/download")
            }
          >
            <Download size={16} strokeWidth={1.9} />
          </IconButton>

          {/* User Menu Popup */}
          <UserMenu
            isOpen={userMenuOpen}
            onClose={() => setUserMenuOpen(false)}
          />
        </div>
      </div>
    </aside>
  );
}
