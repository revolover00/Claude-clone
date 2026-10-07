import { useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  CodeXml,
  Sparkles,
  Download,
  Trash2,
} from "lucide-react";
import { useChat } from "../../context/ChatContext";
import type { Artifact } from "../../types/chat";
import { useToast } from "../../context/ToastContext";

export default function ArtifactsView() {
  const {
    artifacts,
    deleteArtifact,
    setActiveConversationId,
    setActiveView,
    openArtifact,
  } = useChat();

  const { showToast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCopy = async (e: React.MouseEvent, id: string, code: string) => {
    e.stopPropagation(); // prevent triggering card navigation
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      showToast("Code copied to clipboard", "success");
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      showToast("Failed to copy code", "error");
    }
  };

  const handleDownload = (e: React.MouseEvent, art: Artifact) => {
    e.stopPropagation(); // prevent triggering card navigation
    const lang = (art.language || "").toLowerCase();
    const isSvg = lang === "svg" || art.code.trim().startsWith("<svg");
    const isReact =
      lang === "jsx" ||
      lang === "tsx" ||
      lang === "react" ||
      art.code.includes("import React");

    const extMap: Record<string, string> = {
      html: "html",
      svg: "svg",
      tsx: "tsx",
      jsx: "jsx",
      markdown: "md",
    };
    const ext = extMap[lang] || (isReact ? "tsx" : isSvg ? "svg" : "html");
    const filename = `${art.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")}.${ext}`;

    const blob = new Blob([art.code], {
      type: isSvg
        ? "image/svg+xml"
        : lang === "html"
        ? "text/html"
        : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, "success");
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent triggering card navigation
    setDeletingId(id);
  };

  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent triggering card navigation
    deleteArtifact(id);
    setDeletingId(null);
    showToast("Artifact deleted", "success");
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent triggering card navigation
    setDeletingId(null);
  };

  const handleCardClick = (art: Artifact) => {
    if (art.chatId) {
      setActiveConversationId(art.chatId);
    }
    openArtifact(art);
    setActiveView("chat");
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8 lg:px-12 font-sans">
      <div className="mx-auto w-full max-w-[840px]">
        {/* Header */}
        <div className="border-b border-line pb-6">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-accent" />
            <h1 className="text-[26px] font-medium text-ink">Artifacts</h1>
          </div>
          <p className="mt-1 text-[14px] text-ink-muted">
            Reusable components, prototypes, SVG graphics, and standalone documents created during your conversations.
          </p>
        </div>

        {/* Content */}
        <div className="mt-8">
          {artifacts.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[15px] font-medium text-ink-soft">
                No artifacts yet.
              </p>
              <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
                When Claude creates substantial code snippets, SVGs, or components, they will be automatically saved here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {artifacts.map((art) => {
                const isDeleting = deletingId === art.id;

                return (
                  <div
                    key={art.id}
                    onClick={() => handleCardClick(art)}
                    className="group relative flex flex-col justify-between rounded-xl border border-line bg-elev-1 p-4.5 transition-all duration-200 hover:border-line-soft hover:bg-elev-2 hover:-translate-y-0.5 shadow-sm cursor-pointer select-none"
                  >
                    {isDeleting ? (
                      /* Confirm Delete Overlay inside the card */
                      <div className="flex h-full flex-col justify-center py-6 text-center">
                        <p className="text-[14px] font-semibold text-ink">
                          Delete this artifact?
                        </p>
                        <p className="mt-1 text-[12.5px] text-ink-muted">
                          This will permanently remove &ldquo;{art.title}&rdquo;.
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2.5">
                          <button
                            type="button"
                            onClick={handleCancelDelete}
                            className="rounded-lg border border-line bg-elev-2 px-3.5 py-1.5 text-[12.5px] font-medium text-ink-soft hover:bg-elev-3 hover:text-ink transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleConfirmDelete(e, art.id)}
                            className="rounded-lg bg-[#a83428] px-3.5 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-[#bd3d30] transition-colors"
                          >
                            Yes, Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Standard Card UI */
                      <>
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-elev-2 text-accent">
                                <CodeXml size={16} />
                              </div>
                              <h3 className="truncate text-[15px] font-medium text-ink">
                                {art.title}
                              </h3>
                            </div>
                            <span className="rounded bg-elev-3 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-soft shrink-0">
                              {art.type || art.language.toUpperCase()}
                            </span>
                          </div>

                          <div className="mt-3.5 flex items-center justify-between text-[12.5px] text-ink-muted">
                            <span>
                              Created {new Date(art.createdAt).toLocaleDateString()}
                            </span>
                            <span className="truncate max-w-[140px] text-ink-faint">
                              {art.chatTitle || "Conversation"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3">
                          <div className="flex items-center gap-1.5">
                            {/* Copy button */}
                            <button
                              type="button"
                              onClick={(e) => handleCopy(e, art.id, art.code)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-ink-muted transition-colors hover:bg-elev-3 hover:text-ink"
                              title="Copy code"
                            >
                              {copiedId === art.id ? (
                                <>
                                  <Check size={13.5} className="text-accent" />
                                  <span className="text-accent font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13.5} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            {/* Download button */}
                            <button
                              type="button"
                              onClick={(e) => handleDownload(e, art)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elev-3 hover:text-ink"
                              title="Download code"
                            >
                              <Download size={13.5} />
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteClick(e, art.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                              title="Delete artifact"
                            >
                              <Trash2 size={13.5} />
                            </button>
                          </div>

                          <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft group-hover:border-line-soft group-hover:bg-elev-3 group-hover:text-ink transition-all">
                            <span>Open</span>
                            <ExternalLink size={13} className="text-ink-muted" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
