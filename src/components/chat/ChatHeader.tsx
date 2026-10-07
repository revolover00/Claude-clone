import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PanelLeft,
  FolderGit2,
  Check,
  Star,
  MoreHorizontal,
  Pencil,
  Download,
  Share2,
  Trash2,
} from "lucide-react";
import IconButton from "../shared/IconButton";
import { useChat } from "../../context/ChatContext";
import { useToast } from "../../context/ToastContext";
import type { Conversation, Project } from "../../types/chat";

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar?: () => void;
  activeConversation: Conversation | null;
  currentProject?: Project;
}

export default function ChatHeader({
  sidebarOpen,
  onToggleSidebar,
  activeConversation,
  currentProject,
}: Props) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    toggleStar,
    renameConversation,
    deleteConversation,
    activeBranch,
  } = useChat();

  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setChatMenuOpen(false);
      }
    };
    if (chatMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [chatMenuOpen]);

  // Focus rename input
  useEffect(() => {
    if (isRenaming) {
      setEditTitle(activeConversation?.title || "");
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 50);
    }
  }, [isRenaming, activeConversation]);

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeConversation && editTitle.trim()) {
      renameConversation(activeConversation.id, editTitle.trim());
      showToast("Conversation renamed", "success");
    }
    setIsRenaming(false);
  };

  const handleExportMarkdown = () => {
    if (!activeConversation) return;
    const msgs = activeBranch || [];
    let md = `# ${activeConversation.title}\n\n`;
    msgs.forEach((m) => {
      const roleName = m.role === "user" ? "User" : "Claude";
      md += `### ${roleName}\n\n${m.content}\n\n`;
    });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeConversation.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Exported conversation as Markdown", "success");
    setChatMenuOpen(false);
  };

  const handleShareLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      showToast("Link copied to clipboard", "success");
    } catch {
      showToast("Failed to copy link", "error");
    }
    setChatMenuOpen(false);
  };

  const handleDeleteActiveChat = () => {
    if (!activeConversation) return;
    if (window.confirm("Are you sure you want to delete this conversation?")) {
      deleteConversation(activeConversation.id);
      showToast("Conversation deleted", "info");
      setChatMenuOpen(false);
      navigate("/");
    }
  };

  return (
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
        {activeConversation && (
          <div className="flex items-center gap-2 min-w-0">
            {currentProject && (
              <button
                type="button"
                onClick={() => navigate(`/projects/${currentProject.id}`)}
                className="flex items-center gap-1.5 rounded-md bg-elev-2 px-2 py-0.5 text-[12px] font-medium text-accent hover:bg-elev-3 transition-colors shrink-0 cursor-pointer"
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
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setIsRenaming(false);
                  }}
                  className="rounded border border-accent bg-elev-2 px-2 py-0.5 text-[13.5px] font-medium text-ink focus:outline-none"
                />
                <button
                  type="submit"
                  className="p-1 text-accent hover:text-ink transition-colors cursor-pointer"
                  title="Save title"
                >
                  <Check size={14} />
                </button>
              </form>
            ) : (
              <h2
                onClick={() => setIsRenaming(true)}
                title="Click to rename"
                className="truncate text-[14px] font-medium text-ink hover:text-accent cursor-pointer transition-colors max-w-[280px] sm:max-w-[400px]"
              >
                {activeConversation.title}
              </h2>
            )}
          </div>
        )}
      </div>

      {/* Right Header Actions: Star & More menu */}
      {activeConversation && (
        <div className="flex items-center gap-1 relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => toggleStar(activeConversation.id)}
            title={activeConversation.starred ? "Unstar chat" : "Star chat"}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-elev-2 cursor-pointer ${
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer"
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
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] text-ink hover:bg-elev-2 transition-colors cursor-pointer"
              >
                <Pencil size={15} className="text-ink-muted" />
                <span>Rename</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleStar(activeConversation.id);
                  setChatMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] text-ink hover:bg-elev-2 transition-colors cursor-pointer"
              >
                <Star
                  size={15}
                  className={activeConversation.starred ? "text-amber-500 fill-amber-500" : "text-ink-muted"}
                />
                <span>{activeConversation.starred ? "Unstar" : "Star"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportMarkdown}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] text-ink hover:bg-elev-2 transition-colors cursor-pointer"
              >
                <Download size={15} className="text-ink-muted" />
                <span>Export as Markdown</span>
              </button>

              <button
                type="button"
                onClick={handleShareLink}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] text-ink hover:bg-elev-2 transition-colors cursor-pointer"
              >
                <Share2 size={15} className="text-ink-muted" />
                <span>Share link</span>
              </button>

              <div className="my-1 border-t border-line/60" />

              <button
                type="button"
                onClick={handleDeleteActiveChat}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] text-danger hover:bg-danger-bg transition-colors cursor-pointer"
              >
                <Trash2 size={15} className="text-danger" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
