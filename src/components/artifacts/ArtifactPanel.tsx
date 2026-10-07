import { useState, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Eye,
  CodeXml,
  ChevronDown,
} from "lucide-react";
import hljs from "highlight.js";
import type { Artifact } from "../../types/chat";
import { useToast } from "../../context/ToastContext";

type Props = {
  artifact: Artifact | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectVersion?: (version: number) => void;
};

export default function ArtifactPanel({
  artifact,
  isOpen,
  onClose,
  onSelectVersion,
}: Props) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);

  // Active code based on version
  const currentCode = artifact?.code || "";

  const handleCopy = async () => {
    if (!currentCode) return;
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      showToast("Code copied to clipboard", "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Failed to copy code", "error");
    }
  };

  const handleDownload = () => {
    if (!artifact) return;
    const extMap: Record<string, string> = {
      html: "html",
      svg: "svg",
      tsx: "tsx",
      jsx: "jsx",
      markdown: "md",
    };
    const ext = extMap[artifact.language] || "txt";
    const filename = `${artifact.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.${ext}`;

    const blob = new Blob([currentCode], {
      type: artifact.language === "svg" ? "image/svg+xml" : "text/plain",
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

  // Prepare iframe HTML for Preview
  const previewHtml = useMemo(() => {
    if (!artifact) return "";
    const lang = artifact.language.toLowerCase();
    const code = currentCode;

    if (lang === "svg" || code.trim().startsWith("<svg")) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      padding: 2rem;
      background: #1e1d1b;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: calc(100vh - 4rem);
    }
    svg {
      max-width: 90%;
      max-height: 80vh;
      filter: drop-shadow(0 4px 20px rgba(0,0,0,0.3));
    }
  </style>
</head>
<body>
  ${code}
</body>
</html>`;
    }

    if (lang === "html" || code.includes("<html") || code.includes("<!DOCTYPE")) {
      return code;
    }

    // Default HTML wrapper with styling
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      margin: 0;
      padding: 1.5rem;
      background: #211f1d;
      color: #edeae4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>
</head>
<body>
  ${code}
</body>
</html>`;
  }, [artifact, currentCode]);

  // Syntax highlighted code split into lines for Line Numbers
  const highlightedLines = useMemo(() => {
    if (!artifact) return [];
    const lang = artifact.language;
    let html = "";
    try {
      if (lang && hljs.getLanguage(lang)) {
        html = hljs.highlight(currentCode, { language: lang }).value;
      } else {
        html = hljs.highlightAuto(currentCode).value;
      }
    } catch {
      html = currentCode
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
    return html.split("\n");
  }, [artifact, currentCode]);

  if (!isOpen || !artifact) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      {/* Artifact Panel Container:
          Desktop: right column w-[45%] with 300ms ease-out
          Mobile: bottom sheet sliding up */}
      <aside
        className="fixed inset-x-0 bottom-0 top-14 z-50 flex flex-col rounded-t-2xl border-t border-line bg-shell shadow-2xl transition-all duration-300 ease-out lg:static lg:inset-auto lg:z-10 lg:h-full lg:w-[45%] lg:min-w-[420px] lg:max-w-[50vw] lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none anim-sheet-up lg:animate-none font-sans"
        aria-label="Artifact viewer"
      >
        {/* Panel Header */}
        <div className="flex h-13 shrink-0 items-center justify-between border-b border-line px-3.5 lg:px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <h3 className="truncate text-[15px] font-medium text-ink">
              {artifact.title}
            </h3>

            {/* Versions Dropdown (v1, v2...) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setVersionMenuOpen((v) => !v)}
                className="flex items-center gap-1 rounded-md border border-line bg-elev-1 px-2 py-0.5 text-[12px] font-medium text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors"
              >
                <span>v{artifact.version || 1}</span>
                <ChevronDown size={12} className="text-ink-muted" />
              </button>

              {versionMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setVersionMenuOpen(false)}
                  />
                  <div className="anim-popover-in absolute left-0 top-full mt-1 z-30 w-32 rounded-lg border border-line bg-elev-1 p-1 shadow-xl">
                    <p className="px-2 py-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">
                      Versions
                    </p>
                    {(artifact.versions || [{ version: 1, content: artifact.code, createdAt: artifact.createdAt }]).map(
                      (v) => (
                        <button
                          key={v.version}
                          type="button"
                          onClick={() => {
                            onSelectVersion?.(v.version);
                            setVersionMenuOpen(false);
                          }}
                          className={`flex h-7 w-full items-center justify-between rounded px-2 text-[12px] transition-colors ${
                            artifact.version === v.version
                              ? "bg-elev-2 text-ink font-medium"
                              : "text-ink-soft hover:bg-elev-2 hover:text-ink"
                          }`}
                        >
                          <span>Version {v.version}</span>
                          {artifact.version === v.version && (
                            <Check size={13} className="text-accent" />
                          )}
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Center/Right Toolbar */}
          <div className="flex items-center gap-2">
            {/* Sliding Pill Tab Switch (Preview | Code) */}
            <div className="relative flex rounded-lg border border-line bg-elev-1 p-[2.5px]">
              <div
                className={`absolute top-[2.5px] bottom-[2.5px] w-[calc(50%-2.5px)] rounded-md bg-elev-4 shadow-sm transition-transform duration-200 ease-out ${
                  tab === "code" ? "translate-x-full" : "translate-x-0"
                }`}
              />
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`relative z-10 flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors ${
                  tab === "preview" ? "text-ink" : "text-ink-muted hover:text-ink-soft"
                }`}
              >
                <Eye size={13} />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("code")}
                className={`relative z-10 flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors ${
                  tab === "code" ? "text-ink" : "text-ink-muted hover:text-ink-soft"
                }`}
              >
                <CodeXml size={13} />
                <span>Code</span>
              </button>
            </div>

            {/* Action buttons */}
            <button
              type="button"
              onClick={handleCopy}
              title="Copy code"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink"
            >
              {copied ? (
                <Check size={15} className="text-accent" />
              ) : (
                <Copy size={15} />
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              title="Download artifact"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink"
            >
              <Download size={15} />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close artifact"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink ml-0.5"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Panel Body: Preview or Code */}
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#181716]">
          {tab === "preview" ? (
            <iframe
              srcDoc={previewHtml}
              sandbox="allow-scripts"
              title={artifact.title}
              className="h-full w-full border-0 bg-transparent"
            />
          ) : (
            <div className="scroll-slim h-full overflow-auto p-4 text-[13px] font-mono leading-relaxed">
              <pre className="code-with-lines m-0 text-ink">
                <code>
                  {highlightedLines.map((lineHtml, lineIdx) => (
                    <span
                      key={lineIdx}
                      className="code-line"
                      dangerouslySetInnerHTML={{ __html: lineHtml || "&nbsp;" }}
                    />
                  ))}
                </code>
              </pre>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
