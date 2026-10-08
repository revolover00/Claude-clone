import { useState } from "react";
import { ChevronDown, Check, Eye, CodeXml, Copy, Download, X } from "lucide-react";

interface ArtifactHeaderProps {
  title: string;
  version: number;
  versions: Array<{ version: number; content: string; createdAt: number }>;
  onSelectVersion?: (version: number) => void;
  tab: "preview" | "code";
  setTab: (tab: "preview" | "code") => void;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onClose: () => void;
}

export default function ArtifactHeader({
  title,
  version,
  versions,
  onSelectVersion,
  tab,
  setTab,
  copied,
  onCopy,
  onDownload,
  onClose,
}: ArtifactHeaderProps) {
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);

  return (
    <div className="flex h-13 shrink-0 items-center justify-between border-b border-line px-3.5 lg:px-4 bg-shell">
      <div className="flex items-center gap-2.5 min-w-0">
        <h3 className="truncate text-[15px] font-medium text-ink select-none">
          {title}
        </h3>

        {versions.length > 1 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setVersionMenuOpen((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-line bg-elev-1 px-2 py-0.5 text-[12px] font-medium text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer"
            >
              <span>v{version}</span>
              <ChevronDown size={12} className="text-ink-muted" />
            </button>

            {versionMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setVersionMenuOpen(false)}
                />
                <div className="anim-popover-in absolute left-0 top-full mt-1 z-30 w-32 rounded-lg border border-line bg-elev-1 p-1 shadow-xl">
                  <p className="px-2 py-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-faint select-none">
                    Versions
                  </p>
                  {versions.map((v) => (
                    <button
                      key={v.version}
                      type="button"
                      onClick={() => {
                        onSelectVersion?.(v.version);
                        setVersionMenuOpen(false);
                      }}
                      className={`flex h-7 w-full items-center justify-between rounded px-2 text-[12px] transition-colors cursor-pointer ${
                        version === v.version
                          ? "bg-elev-2 text-ink font-medium"
                          : "text-ink-soft hover:bg-elev-2 hover:text-ink"
                      }`}
                    >
                      <span>Version {v.version}</span>
                      {version === v.version && (
                        <Check size={13} className="text-accent" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex rounded-lg border border-line bg-elev-1 p-[2.5px]">
          <div
            className={`absolute top-[2.5px] bottom-[2.5px] w-[calc(50%-2.5px)] rounded-md bg-elev-4 shadow-sm transition-transform duration-200 ease-out ${
              tab === "code" ? "translate-x-full" : "translate-x-0"
            }`}
          />
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`relative z-10 flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors cursor-pointer ${
              tab === "preview"
                ? "text-ink"
                : "text-ink-muted hover:text-ink-soft"
            }`}
          >
            <Eye size={13} />
            <span>Preview</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("code")}
            className={`relative z-10 flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors cursor-pointer ${
              tab === "code"
                ? "text-ink"
                : "text-ink-muted hover:text-ink-soft"
            }`}
          >
            <CodeXml size={13} />
            <span>Code</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onCopy}
          title="Copy code"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink cursor-pointer"
        >
          {copied ? <Check size={15} className="text-accent" /> : <Copy size={15} />}
        </button>

        <button
          type="button"
          onClick={onDownload}
          title="Download artifact"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink cursor-pointer"
        >
          <Download size={15} />
        </button>

        <button
          type="button"
          onClick={onClose}
          title="Close artifact"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink ml-0.5 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
