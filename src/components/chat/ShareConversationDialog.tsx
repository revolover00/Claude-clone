import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, LoaderCircle, ShieldCheck, X } from "lucide-react";
import type { Conversation, Message } from "../../types/chat";
import { buildShareSnapshot, encodeShareToken } from "../../shared/conversationShare";

interface Props {
  conversation: Conversation;
  messages: Message[];
  onClose: () => void;
}

export default function ShareConversationDialog({ conversation, messages, onClose }: Props) {
  const [shareLink, setShareLink] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const messageCount = messages.filter((message) =>
    (message.role === "user" || message.role === "assistant") && Boolean(message.content?.trim())
  ).length;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const copyLink = async (value: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setError("");
    } catch {
      setCopied(false);
      setError("The link is ready, but clipboard access was blocked. Copy it from the field below.");
      window.setTimeout(() => {
        linkInputRef.current?.focus();
        linkInputRef.current?.select();
      }, 0);
    }
  };

  const createLink = async () => {
    setIsCreating(true);
    setError("");
    setCopied(false);
    try {
      const snapshot = buildShareSnapshot(conversation.title, messages);
      const token = await encodeShareToken(snapshot);
      const url = new URL("/share", window.location.origin);
      url.hash = `share=${token}`;
      const value = url.toString();
      setShareLink(value);
      await copyLink(value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a share link.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        aria-labelledby="share-conversation-title"
        aria-modal="true"
        className="anim-modal-in w-full max-w-lg rounded-2xl border border-line bg-elev-1 p-5 shadow-2xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 id="share-conversation-title" className="text-[17px] font-semibold text-ink">Share a read-only snapshot</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                {messageCount} text {messageCount === 1 ? "message" : "messages"} from the active conversation branch.
              </p>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close share dialog" className="rounded-lg p-1.5 text-ink-muted hover:bg-elev-2 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              Anyone with the link can read this snapshot, including its title and visible text in this branch. Attachments, hidden reasoning, and alternate versions are excluded. The link contains the snapshot data and cannot be revoked, so share it only with people you trust.
            </p>
          </div>
        </div>

        {shareLink && (
          <div className="mt-4 flex gap-2">
            <input
              ref={linkInputRef}
              aria-label="Read-only conversation share link"
              className="min-w-0 flex-1 rounded-lg border border-line bg-shell px-3 py-2 text-[12px] text-ink outline-none focus:border-accent"
              readOnly
              value={shareLink}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button type="button" onClick={() => void copyLink(shareLink)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12.5px] font-medium text-white hover:opacity-90">
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-[12.5px] leading-relaxed text-danger">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] text-ink-soft hover:bg-elev-2">Cancel</button>
          {!shareLink && (
            <button type="button" disabled={isCreating || messageCount === 0} onClick={() => void createLink()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {isCreating ? <LoaderCircle size={15} className="animate-spin" /> : <Copy size={15} />}
              {isCreating ? "Creating link…" : "Create and copy link"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
