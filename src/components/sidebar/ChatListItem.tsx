import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal, Star, Pencil, Trash2 } from "lucide-react";
import { cn } from "../../utils/cn";
import { useChat } from "../../context/ChatContext";
import type { Conversation } from "../../types/chat";

interface Props {
  conversation: Conversation;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}

export default function ChatListItem({
  conversation,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
}: Props) {
  const { toggleStar, renameConversation, deleteConversation, generatingChatIds } = useChat();
  const location = useLocation();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [isDeleting, setIsDeleting] = useState(false);

  const editInputRef = useRef<HTMLInputElement>(null);
  const isActive = location.pathname === `/chat/${conversation.id}`;
  const isGenerating = generatingChatIds?.has(conversation.id);

  useEffect(() => {
    if (isEditing) {
      setEditTitle(conversation.title);
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [isEditing, conversation.title]);

  const handleSaveRename = () => {
    if (editTitle.trim()) {
      renameConversation(conversation.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "group anim-chat-item-in relative flex h-8 items-center rounded-md px-2 text-[13.5px] transition-colors font-sans",
        isActive
          ? "bg-elev-2 text-ink font-medium"
          : "text-ink-soft hover:bg-elev-2 hover:text-ink"
      )}
    >
      {isEditing ? (
        <input
          ref={editInputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSaveRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveRename();
            if (e.key === "Escape") setIsEditing(false);
          }}
          className="h-6 w-full rounded bg-elev-3 px-1.5 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            navigate(`/chat/${conversation.id}`);
          }}
          className="flex-1 truncate text-start flex items-center gap-1.5"
          title={conversation.title}
        >
          {isGenerating && (
            <span className="h-2 w-2 rounded-full bg-accent shrink-0 animate-pulse" title="Claude is thinking..." />
          )}
          <span className="truncate flex-1">
            {conversation.title}
            {conversation.isTypingTitle && (
              <span className="inline-block w-1.5 h-3 ms-0.5 bg-accent animate-pulse" />
            )}
          </span>
        </button>
      )}

      {/* Star indicator or hover action menu */}
      <div className="flex items-center gap-0.5">
        {conversation.starred && !isMenuOpen && !isEditing && (
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
              onToggleMenu();
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
                  onCloseMenu();
                  setIsDeleting(false);
                }}
              />
              <div className="anim-popover-in absolute right-0 top-7 z-40 w-44 rounded-lg border border-line bg-elev-1 p-1 shadow-xl font-sans">
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
                        onClick={() => setIsDeleting(false)}
                        className="rounded px-2 py-0.5 text-[11px] text-ink-muted hover:text-ink"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteConversation(conversation.id);
                          onCloseMenu();
                          setIsDeleting(false);
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
                        toggleStar(conversation.id);
                        onCloseMenu();
                      }}
                      className="flex h-7 w-full items-center gap-2 rounded px-2 text-[12.5px] text-ink-soft hover:bg-elev-2 hover:text-ink"
                    >
                      <Star
                        size={13}
                        className={conversation.starred ? "text-accent" : ""}
                      />
                      <span>{conversation.starred ? "Unstar" : "Star"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                        onCloseMenu();
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
                        setIsDeleting(true);
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
}
