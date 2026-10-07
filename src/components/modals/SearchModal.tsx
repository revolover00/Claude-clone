import { useEffect, useRef, useState } from "react";
import { Search, MessageSquare, ArrowRight, X } from "lucide-react";
import { useChat } from "../../context/ChatContext";
import { useFocusTrap } from "../../utils/useFocusTrap";

export default function SearchModal() {
  const {
    searchModalOpen,
    setSearchModalOpen,
    conversations,
    setActiveConversationId,
  } = useChat();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, searchModalOpen, () => setSearchModalOpen(false), inputRef);

  useEffect(() => {
    if (searchModalOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [searchModalOpen]);

  // Filter conversations
  const trimmed = query.trim().toLowerCase();
  const filtered = conversations.filter((c) => {
    if (!trimmed) return true;
    if (c.title.toLowerCase().includes(trimmed)) return true;
    return c.messages.some((m) => m.content.toLowerCase().includes(trimmed));
  });

  const displayResults = trimmed ? filtered : filtered.slice(0, 6);

  // Keyboard navigation inside search modal
  useEffect(() => {
    if (!searchModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSearchModalOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          displayResults.length === 0 ? 0 : (prev + 1) % displayResults.length
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          displayResults.length === 0
            ? 0
            : (prev - 1 + displayResults.length) % displayResults.length
        );
      } else if (e.key === "Enter" && displayResults[selectedIndex]) {
        e.preventDefault();
        setActiveConversationId(displayResults[selectedIndex].id);
        setSearchModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    searchModalOpen,
    displayResults,
    selectedIndex,
    setActiveConversationId,
    setSearchModalOpen,
  ]);

  if (!searchModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[14vh] backdrop-blur-sm"
      onClick={() => setSearchModalOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search conversations"
        className="anim-modal-in w-full max-w-[580px] overflow-hidden rounded-xl border border-line bg-elev-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header & input */}
        <div className="flex h-13 items-center gap-3 border-b border-line px-4">
          <Search size={18} className="text-ink-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search conversations and messages..."
            className="flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-muted focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
              }}
              className="text-ink-muted hover:text-ink"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Results list */}
        <div className="scroll-slim max-h-[380px] overflow-y-auto p-2">
          {displayResults.length === 0 ? (
            <div className="py-12 text-center text-[14px] text-ink-muted">
              No conversations found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              {!trimmed && (
                <div className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                  Recent chats
                </div>
              )}
              {displayResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const snippet = item.messages[0]?.content.slice(0, 70);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveConversationId(item.id);
                      setSearchModalOpen(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start transition-colors duration-150 ${
                      isSelected
                        ? "bg-elev-3 text-ink"
                        : "text-ink-soft hover:bg-elev-2 hover:text-ink"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <MessageSquare
                        size={16}
                        className={`mt-0.5 shrink-0 ${
                          isSelected ? "text-accent" : "text-ink-muted"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-ink">
                          {item.title}
                        </p>
                        {snippet && (
                          <p className="truncate text-[12.5px] text-ink-muted">
                            {snippet}
                          </p>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <ArrowRight size={14} className="text-ink-muted shrink-0 ms-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-line bg-elev-2/40 px-4 py-2 text-[11.5px] text-ink-muted">
          <span>
            <kbd className="rounded bg-elev-3 px-1.5 py-0.5 text-[10.5px] font-mono">↑</kbd>{" "}
            <kbd className="rounded bg-elev-3 px-1.5 py-0.5 text-[10.5px] font-mono">↓</kbd> navigate
          </span>
          <span>
            <kbd className="rounded bg-elev-3 px-1.5 py-0.5 text-[10.5px] font-mono">↵</kbd> open
          </span>
          <span>
            <kbd className="rounded bg-elev-3 px-1.5 py-0.5 text-[10.5px] font-mono">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
