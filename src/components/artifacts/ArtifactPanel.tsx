import { useState, useMemo, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Eye,
  CodeXml,
  ChevronDown,
} from "lucide-react";
import hljs from "../../utils/hljs";
import MarkdownView from "../chat/MarkdownView";
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

  // Esc key listener to close panel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const [displayedArtifact, setDisplayedArtifact] = useState<Artifact | null>(artifact);

  useEffect(() => {
    if (artifact) {
      setDisplayedArtifact(artifact);
    }
  }, [artifact]);

  const activeArt = artifact || displayedArtifact;

  const currentCode = activeArt?.code || "";
  const lang = (activeArt?.language || "").toLowerCase();
  const isSvg = lang === "svg" || currentCode.trim().startsWith("<svg");
  const isMarkdown = lang === "markdown" || lang === "md";
  const isReact =
    lang === "jsx" ||
    lang === "tsx" ||
    lang === "react" ||
    currentCode.includes("import React");

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
    const ext = extMap[lang] || (isReact ? "tsx" : isSvg ? "svg" : "html");
    const filename = `${artifact.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")}.${ext}`;

    const blob = new Blob([currentCode], {
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

  // Iframe srcDoc generator for HTML / React / JS prototypes
  const previewHtml = useMemo(() => {
    if (!artifact || isSvg || isMarkdown) return "";

    if (isReact) {
      // Strip import statements for Babel standalone in-browser runtime
      const cleanedCode = currentCode
        .replace(/import\s+.*?from\s+['"].*?['"];?/g, "")
        .replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, "function $1")
        .replace(/export\s+default\s+/g, "const __DefaultExport__ = ")
        .replace(/export\s+(?:const|let|var|function|class)\s+/g, "");

      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.12/babel.min.js"></script>
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
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useMemo, useCallback } = React;
    try {
      ${cleanedCode}

      let TargetComp = null;
      if (typeof __DefaultExport__ !== 'undefined') {
        TargetComp = __DefaultExport__;
      } else if (typeof App !== 'undefined') {
        TargetComp = App;
      } else if (typeof ModernCounter !== 'undefined') {
        TargetComp = ModernCounter;
      } else if (typeof Button !== 'undefined') {
        TargetComp = Button;
      }

      if (!TargetComp) {
        const possible = Object.keys(window).filter(k => /^[A-Z]/.test(k) && typeof window[k] === 'function');
        if (possible.length > 0) TargetComp = window[possible[0]];
      }

      if (TargetComp) {
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(TargetComp));
      } else {
        document.getElementById('root').innerHTML = '<div style="color: #edeae4; padding: 1rem; text-align: center; font-size: 13.5px;">Component mounted successfully.</div>';
      }
    } catch (err) {
      document.getElementById('root').innerHTML = '<div style="color: #f08578; padding: 1rem; border: 1px solid #7d2d24; border-radius: 8px; font-size: 13px;"><b>Render Error:</b> ' + err.message + '</div>';
    }
  </script>
</body>
</html>`;
    }

    if (lang === "html" || currentCode.includes("<html") || currentCode.includes("<!DOCTYPE")) {
      return currentCode;
    }

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
  ${currentCode}
</body>
</html>`;
  }, [artifact, currentCode, isSvg, isMarkdown, isReact, lang]);

  // Syntax highlighted code split into lines for Line Numbers
  const highlightedLines = useMemo(() => {
    if (!activeArt) return [];
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
  }, [activeArt, currentCode, lang]);

  if (!activeArt) return null;

  const versions = activeArt.versions || [
    { version: 1, content: activeArt.code, createdAt: activeArt.createdAt },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Artifact Panel Container:
          Desktop: right column width 0 -> 45% with 300ms cubic-bezier(0.22, 1, 0.36, 1)
          Mobile: bottom sheet sliding up with drag handle */}
      <aside
        className={`fixed inset-x-0 bottom-0 top-12 z-50 flex flex-col rounded-t-2xl border-t border-line bg-shell shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:static lg:inset-auto lg:z-10 lg:h-full lg:rounded-none lg:border-t-0 lg:shadow-none font-sans overflow-hidden ${
          isOpen
            ? "translate-y-0 opacity-100 lg:w-[45%] lg:min-w-[420px] lg:max-w-[50vw] lg:border-l"
            : "translate-y-full pointer-events-none lg:translate-y-0 lg:w-0 lg:min-w-0 lg:max-w-0 lg:border-l-0 opacity-0 lg:opacity-0"
        }`}
        aria-label="Artifact viewer"
      >
        <div className="flex h-full w-full min-w-[320px] lg:min-w-[420px] flex-col overflow-hidden">
          {/* Mobile Drag Handle */}
          <div
            className="flex justify-center pt-2.5 pb-1 lg:hidden cursor-grab active:cursor-grabbing touch-none"
            onClick={onClose}
          >
            <div className="h-1.5 w-12 rounded-full bg-elev-4" />
          </div>

          {/* Panel Header */}
          <div className="flex h-13 shrink-0 items-center justify-between border-b border-line px-3.5 lg:px-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <h3 className="truncate text-[15px] font-medium text-ink">
                {activeArt.title}
              </h3>

              {/* Versions Dropdown (v1, v2...) */}
              {versions.length > 1 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setVersionMenuOpen((v) => !v)}
                    className="flex items-center gap-1 rounded-md border border-line bg-elev-1 px-2 py-0.5 text-[12px] font-medium text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors"
                  >
                    <span>v{activeArt.version || 1}</span>
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
                      {versions.map((v) => (
                        <button
                          key={v.version}
                          type="button"
                          onClick={() => {
                            onSelectVersion?.(v.version);
                            setVersionMenuOpen(false);
                          }}
                          className={`flex h-7 w-full items-center justify-between rounded px-2 text-[12px] transition-colors ${
                            activeArt.version === v.version
                              ? "bg-elev-2 text-ink font-medium"
                              : "text-ink-soft hover:bg-elev-2 hover:text-ink"
                          }`}
                        >
                          <span>Version {v.version}</span>
                          {activeArt.version === v.version && (
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
                className={`relative z-10 flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors ${
                  tab === "code"
                    ? "text-ink"
                    : "text-ink-muted hover:text-ink-soft"
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
            isSvg ? (
              /* Inline SVG in centered container */
              <div
                className="flex h-full w-full items-center justify-center p-8 bg-[#181716] overflow-auto scroll-slim [&>svg]:max-w-[90%] [&>svg]:max-h-[85vh] [&>svg]:drop-shadow-lg"
                dangerouslySetInnerHTML={{ __html: currentCode }}
              />
            ) : isMarkdown ? (
              /* Markdown rendered with MarkdownView */
              <div className="scroll-slim h-full overflow-auto p-6 bg-shell">
                <div className="max-w-2xl mx-auto">
                  <MarkdownView content={currentCode} />
                </div>
              </div>
            ) : (
              /* Sandboxed iframe for HTML and React */
              <iframe
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                title={activeArt.title}
                className="h-full w-full border-0 bg-transparent"
              />
            )
          ) : (
            /* Syntax highlighted code with line numbers */
            <div className="scroll-slim h-full overflow-auto p-4 text-[13px] font-mono leading-relaxed">
              <pre className="code-with-lines m-0 text-ink">
                <code>
                  {highlightedLines.map((lineHtml, lineIdx) => (
                    <span
                      key={lineIdx}
                      className="code-line"
                      dangerouslySetInnerHTML={{
                        __html: lineHtml || "&nbsp;",
                      }}
                    />
                  ))}
                </code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </aside>
  </>
);
}
