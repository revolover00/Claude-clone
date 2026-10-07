import { useState } from "react";
import { Copy, Check, ExternalLink, CodeXml, Sparkles } from "lucide-react";
import { useChat } from "../../context/ChatContext";
import type { Artifact } from "../../types/chat";

type Props = {
  onOpenArtifact?: (artifact: Artifact) => void;
};

export default function ArtifactsView({ onOpenArtifact }: Props) {
  const { artifacts } = useChat();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // fallback
    }
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
            /* Thumbnail-less cards as requested */
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {artifacts.map((art) => (
                <div
                  key={art.id}
                  className="group flex flex-col justify-between rounded-xl border border-line bg-elev-1 p-4.5 transition-all hover:border-line-soft hover:bg-elev-2 shadow-sm"
                >
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

                    <div className="mt-3 flex items-center justify-between text-[12px] text-ink-muted">
                      <span>Created {new Date(art.createdAt).toLocaleDateString()}</span>
                      <span className="truncate max-w-[140px] text-ink-faint">
                        {art.chatTitle || "Conversation"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3">
                    <button
                      type="button"
                      onClick={() => handleCopy(art.id, art.code)}
                      className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] text-ink-muted transition-colors hover:bg-elev-3 hover:text-ink"
                    >
                      {copiedId === art.id ? (
                        <>
                          <Check size={13} className="text-accent" />
                          <span className="text-accent">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy code</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenArtifact?.(art)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-line-soft hover:bg-elev-3 hover:text-ink"
                    >
                      <span>Open</span>
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
