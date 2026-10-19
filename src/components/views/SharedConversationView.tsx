import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, MessageSquareText, ShieldCheck } from "lucide-react";
import ClaudeSpark from "../icons/ClaudeSpark";
import {
  decodeShareToken,
  readShareTokenFromHash,
  renderSafeSharedMarkdown,
  type SharedConversationSnapshot,
} from "../../shared/conversationShare";

function SharedMessage({ role, content }: { role: "user" | "assistant"; content: string }) {
  const html = useMemo(() => renderSafeSharedMarkdown(content), [content]);
  const isUser = role === "user";
  return (
    <article className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-elev-2 text-accent" aria-hidden="true">
          <ClaudeSpark size={16} />
        </span>
      )}
      <div className={`min-w-0 max-w-[min(100%,760px)] rounded-2xl px-4 py-3 sm:px-5 ${isUser ? "bg-elev-2 text-ink" : "text-ink"}`}>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{isUser ? "User" : "Assistant"}</p>
        <div
          className="share-markdown text-[14.5px] leading-7 text-ink/95 [&_a]:text-accent [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:border-accent/50 [&_blockquote]:ps-4 [&_code]:rounded [&_code]:bg-elev-2 [&_code]:px-1 [&_h1]:my-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:ps-6 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-code-surface [&_pre]:p-4 [&_table]:block [&_table]:overflow-x-auto [&_ul]:list-disc [&_ul]:ps-6"
          dir="auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      {isUser && (
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-elev-2 text-ink-muted" aria-hidden="true">
          <MessageSquareText size={15} />
        </span>
      )}
    </article>
  );
}

export default function SharedConversationView() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<SharedConversationSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const originalTitle = document.title;
    const token = readShareTokenFromHash(window.location.hash);
    if (!token) {
      setError("This link does not contain a conversation snapshot. Ask the sender to create a new share link.");
      return () => { document.title = originalTitle; };
    }
    let active = true;
    decodeShareToken(token)
      .then((value) => {
        if (active) {
          setSnapshot(value);
          document.title = `${value.title} · Shared conversation`;
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "This share link could not be opened.");
      });
    return () => {
      active = false;
      document.title = originalTitle;
    };
  }, []);

  return (
    <main className="min-h-[100dvh] bg-shell text-ink">
      <header className="sticky top-0 z-10 border-b border-line/60 bg-shell/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><ClaudeSpark size={19} /></span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">Shared conversation</p>
              <p className="flex items-center gap-1 text-[11px] text-ink-muted"><ShieldCheck size={11} /> Read-only snapshot</p>
            </div>
          </div>
          <button type="button" onClick={() => navigate("/")} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink">
            <ExternalLink size={14} /> Open app
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
        {error ? (
          <section className="mx-auto max-w-lg rounded-2xl border border-line bg-elev-1 p-6 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-ink">Unable to open this share link</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{error}</p>
            <button type="button" onClick={() => navigate("/")} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white hover:opacity-90">
              <ArrowLeft size={15} /> Return to the app
            </button>
          </section>
        ) : !snapshot ? (
          <div className="py-20 text-center text-[13px] text-ink-muted" role="status">Opening shared conversation…</div>
        ) : (
          <>
            <section className="mb-8 border-b border-line/60 pb-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Shared snapshot</p>
              <h1 className="break-words text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{snapshot.title}</h1>
              <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-ink-muted">
                Anyone with this link can read the text below. Attachments, private reasoning, and other message versions are not included.
              </p>
            </section>
            <section aria-label="Conversation messages" className="space-y-6">
              {snapshot.messages.map((message, index) => (
                <SharedMessage key={`${message.role}-${index}`} role={message.role} content={message.content} />
              ))}
            </section>
            <p className="mt-10 border-t border-line/50 pt-4 text-center text-[11px] text-ink-muted">A portable, read-only snapshot. It does not update when the original conversation changes.</p>
          </>
        )}
      </div>
    </main>
  );
}
