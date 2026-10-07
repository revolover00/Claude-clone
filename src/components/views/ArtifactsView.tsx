import { useState } from "react";
import { Copy, Check, CodeXml } from "lucide-react";
import { useChat } from "../../context/ChatContext";

export default function ArtifactsView() {
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
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8 lg:px-12">
      <div className="mx-auto w-full max-w-[840px]">
        {/* Header */}
        <div className="border-b border-line pb-6">
          <h1 className="text-[26px] font-medium text-ink">Artifacts</h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            Standalone code, diagrams, and documents generated during your conversations.
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
                When Claude creates substantial code snippets, SVGs, or components, you can save and review them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {artifacts.map((art) => (
                <div
                  key={art.id}
                  className="flex flex-col justify-between rounded-xl border border-line bg-elev-1 p-5 transition-all hover:border-line-soft hover:bg-elev-2"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-elev-3 text-accent">
                          <CodeXml size={15} />
                        </div>
                        <h3 className="text-[15px] font-medium text-ink">
                          {art.title}
                        </h3>
                      </div>
                      <span className="rounded bg-elev-3 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                        {art.language}
                      </span>
                    </div>

                    {/* Code snippet preview */}
                    <div className="mt-4 overflow-hidden rounded-lg border border-line/60 bg-[#141312] p-3">
                      <pre className="scroll-slim max-h-28 overflow-x-auto text-[12px] font-mono text-ink-muted leading-relaxed">
                        <code>{art.code}</code>
                      </pre>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                    <span className="text-[12px] text-ink-faint">
                      {art.chatTitle || "From chat"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(art.id, art.code)}
                      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-ink-muted hover:bg-elev-3 hover:text-ink transition-colors"
                    >
                      {copiedId === art.id ? (
                        <>
                          <Check size={13} className="text-accent" />
                          <span className="text-accent">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy</span>
                        </>
                      )}
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
