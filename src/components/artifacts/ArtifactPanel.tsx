import { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Eye,
  CodeXml,
  ChevronDown,
  RotateCw,
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  Tablet,
  Smartphone,
  AlertTriangle,
} from "lucide-react";
import hljs from "../../utils/hljs";
import MarkdownView from "../chat/MarkdownView";
import ErrorBoundary from "../shared/ErrorBoundary";
import type { Artifact } from "../../types/chat";
import { useToast } from "../../context/ToastContext";

type Props = {
  artifact: Artifact | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectVersion?: (version: number) => void;
};

interface DiffLine {
  type: "added" | "removed" | "normal";
  content: string;
}

// Custom simple Lookahead Diff algorithm
function computeLineDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const diff: DiffLine[] = [];

  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        diff.push({ type: "normal", content: newLines[j] });
        i++;
        j++;
      } else {
        // Look ahead 5 lines to detect structural insertions / deletions
        let foundMatch = false;
        for (let k = 1; k <= 5; k++) {
          if (i + k < oldLines.length && oldLines[i + k] === newLines[j]) {
            for (let m = 0; m < k; m++) {
              diff.push({ type: "removed", content: oldLines[i + m] });
            }
            i += k;
            foundMatch = true;
            break;
          }
          if (j + k < newLines.length && oldLines[i] === newLines[j + k]) {
            for (let m = 0; m < k; m++) {
              diff.push({ type: "added", content: newLines[j + m] });
            }
            j += k;
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) {
          diff.push({ type: "removed", content: oldLines[i] });
          diff.push({ type: "added", content: newLines[j] });
          i++;
          j++;
        }
      }
    } else if (i < oldLines.length) {
      diff.push({ type: "removed", content: oldLines[i] });
      i++;
    } else if (j < newLines.length) {
      diff.push({ type: "added", content: newLines[j] });
      j++;
    }
  }
  return diff;
}

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

  // Preview options state
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [iframeError, setIframeError] = useState<string | null>(null);

  // Diff view state
  const [showDiff, setShowDiff] = useState(false);

  // Drag resizer state
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("claude_artifact_panel_width");
      if (saved) return parseInt(saved, 10);
    } catch {
      // ignore
    }
    return Math.max(420, Math.min(650, window.innerWidth * 0.45));
  });

  const [isLargeScreen, setIsLargeScreen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024
  );

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("claude_artifact_panel_width", width.toString());
    } catch {
      // ignore
    }
  }, [width]);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // Dragging left increases width, so we subtract deltaX
      const newWidth = Math.max(
        360,
        Math.min(window.innerWidth * 0.7, startWidth - deltaX)
      );
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Esc key listener to close panel (only when not in simulated fullscreen)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isFullscreen]);

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
    currentCode.includes("import React") ||
    currentCode.includes("recharts") ||
    currentCode.includes("lucide-react");

  // Handle active stream state
  const isCurrentlyStreaming = Boolean(activeArt?.isStreaming);
  const prevStreamingRef = useRef(isCurrentlyStreaming);

  useEffect(() => {
    if (isCurrentlyStreaming) {
      setTab("code");
    } else if (prevStreamingRef.current && !isCurrentlyStreaming) {
      // Stream finished! Auto-switch to preview with 200ms iframe transition
      setTab("preview");
    }
    prevStreamingRef.current = isCurrentlyStreaming;
  }, [isCurrentlyStreaming]);

  // Code tab scroll element ref
  const codeContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isCurrentlyStreaming && codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [currentCode, isCurrentlyStreaming]);

  // Reset errors and diff selection on code update
  useEffect(() => {
    setIframeError(null);
  }, [currentCode, reloadKey]);

  // Listen for console/window errors from iframe
  useEffect(() => {
    const handleIframeMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "iframe-error") {
        setIframeError(e.data.message);
      }
    };
    window.addEventListener("message", handleIframeMessage);
    return () => window.removeEventListener("message", handleIframeMessage);
  }, []);

  const handleFixWithAI = () => {
    if (!iframeError || !activeArt) return;
    window.dispatchEvent(
      new CustomEvent("claude:fix-artifact-error", {
        detail: { errorText: iframeError, title: activeArt.title },
      })
    );
    showToast("Error sent to Claude to fix", "info");
  };

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
    if (!activeArt) return;
    const extMap: Record<string, string> = {
      html: "html",
      svg: "svg",
      tsx: "tsx",
      jsx: "jsx",
      markdown: "md",
    };
    const ext = extMap[lang] || (isReact ? "tsx" : isSvg ? "svg" : "html");
    const filename = `${activeArt.title
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

  // Preview reloading
  const handleReload = () => {
    setReloadKey((k) => k + 1);
    setIframeError(null);
  };

  // Preview in new tab
  const handleOpenNewTab = () => {
    try {
      const blob = new Blob([previewHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      showToast("Could not open in new tab", "error");
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen((f) => !f);
  };

  // Extract previous version code for diff comparisons
  const previousCode = useMemo(() => {
    if (!activeArt || !activeArt.versions || activeArt.versions.length <= 1) return "";
    const currentVerNum = activeArt.version || 1;
    if (currentVerNum <= 1) return "";
    const prevVer = activeArt.versions.find((v) => v.version === currentVerNum - 1);
    return prevVer ? prevVer.content : "";
  }, [activeArt]);

  // Syntax highlighted code lines
  const highlightedLines = useMemo(() => {
    if (!activeArt) return [];
    let html: string;
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

  // Diff lines highlighted
  const diffLinesWithHighlight = useMemo(() => {
    if (!showDiff || !previousCode) return [];
    const diff = computeLineDiff(previousCode, currentCode);

    const oldLines = previousCode.split("\n");
    let oldHighlighted: string[] = [];
    try {
      if (lang && hljs.getLanguage(lang)) {
        oldHighlighted = hljs.highlight(previousCode, { language: lang }).value.split("\n");
      } else {
        oldHighlighted = hljs.highlightAuto(previousCode).value.split("\n");
      }
    } catch {
      oldHighlighted = oldLines.map((l) =>
        l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      );
    }

    const res: Array<{ type: "added" | "removed" | "normal"; html: string }> = [];
    let oldIdx = 0;
    let newIdx = 0;

    for (const line of diff) {
      if (line.type === "normal") {
        res.push({ type: "normal", html: highlightedLines[newIdx] || "" });
        oldIdx++;
        newIdx++;
      } else if (line.type === "added") {
        res.push({ type: "added", html: highlightedLines[newIdx] || "" });
        newIdx++;
      } else if (line.type === "removed") {
        res.push({ type: "removed", html: oldHighlighted[oldIdx] || "" });
        oldIdx++;
      }
    }
    return res;
  }, [showDiff, previousCode, currentCode, highlightedLines, lang]);

  // Iframe srcDoc generator for HTML / React / JS prototypes
  const previewHtml = useMemo(() => {
    if (!activeArt || isSvg || isMarkdown) return "";

    if (isReact) {
      // Map modules to global UMD objects cleanly
      let cleanedCode = currentCode;

      cleanedCode = cleanedCode.replace(
        /import\s+{(.*?)}\s+from\s+['"]lucide-react['"];?/g,
        "const {$1} = window.LucideReact || window.lucide || {};"
      );
      cleanedCode = cleanedCode.replace(
        /import\s+{(.*?)}\s+from\s+['"]recharts['"];?/g,
        "const {$1} = window.Recharts || {};"
      );
      cleanedCode = cleanedCode.replace(
        /import\s+React\s*,\s*{(.*?)}\s+from\s+['"]react['"];?/g,
        "const {$1} = React;"
      );
      cleanedCode = cleanedCode.replace(
        /import\s+React\s+from\s+['"]react['"];?/g,
        ""
      );
      cleanedCode = cleanedCode.replace(
        /import\s+{(.*?)}\s+from\s+['"]react['"];?/g,
        "const {$1} = React;"
      );
      cleanedCode = cleanedCode.replace(/import\s+.*?from\s+['"].*?['"];?/g, "");

      cleanedCode = cleanedCode
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
  
  <!-- Lucide UMD Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <script src="https://unpkg.com/lucide-react@latest/dist/umd/lucide-react.min.js"></script>
  
  <!-- Recharts and dependency Prop-types -->
  <script src="https://unpkg.com/prop-types@15.8.1/prop-types.min.js"></script>
  <script src="https://unpkg.com/recharts/umd/Recharts.js"></script>

  <style>
    body {
      margin: 0;
      padding: 1.5rem;
      background: #181716;
      color: #edeae4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>

  <script>
    // Prevent false alarms for Script errors throwing warnings
    window.onerror = function(message, source, lineno, colno, error) {
      if (String(message).includes("Script error.")) return false;
      window.parent.postMessage({
        type: 'iframe-error',
        message: message + ' (line ' + lineno + ')'
      }, '*');
      return false;
    };
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const errorMsg = args.map(arg => {
        if (arg instanceof Error) return arg.message;
        if (typeof arg === 'object') {
          try { return JSON.stringify(arg); } catch(e) { return String(arg); }
        }
        return String(arg);
      }).join(' ');
      if (errorMsg.includes("React DevTools")) return;
      window.parent.postMessage({
        type: 'iframe-error',
        message: errorMsg
      }, '*');
      originalConsoleError.apply(console, args);
    };
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useMemo, useCallback } = React;
    try {
      \${cleanedCode}

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
      window.parent.postMessage({
        type: 'iframe-error',
        message: err.message
      }, '*');
    }
  </script>
</body>
</html>`;
    }

    if (lang === "html" || currentCode.includes("<html") || currentCode.includes("<!DOCTYPE")) {
      // Inject error capturing scripts inside plain HTML
      let htmlCode = currentCode;
      const injection = `
  <script>
    window.onerror = function(message, source, lineno, colno, error) {
      if (String(message).includes("Script error.")) return false;
      window.parent.postMessage({
        type: 'iframe-error',
        message: message + ' (line ' + lineno + ')'
      }, '*');
      return false;
    };
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const errorMsg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      window.parent.postMessage({
        type: 'iframe-error',
        message: errorMsg
      }, '*');
      originalConsoleError.apply(console, args);
    };
  </script>`;
      if (htmlCode.includes("<head>")) {
        htmlCode = htmlCode.replace("<head>", "<head>" + injection);
      } else {
        htmlCode = injection + htmlCode;
      }
      return htmlCode;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    window.onerror = function(message, source, lineno, colno, error) {
      if (String(message).includes("Script error.")) return false;
      window.parent.postMessage({
        type: 'iframe-error',
        message: message + ' (line ' + lineno + ')'
      }, '*');
      return false;
    };
  </script>
  <style>
    body {
      margin: 0;
      padding: 1.5rem;
      background: #181716;
      color: #edeae4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>
</head>
<body>
  \${currentCode}
</body>
</html>`;
  }, [activeArt, currentCode, isSvg, isMarkdown, isReact, lang]);

  if (!activeArt) return null;

  const versions = activeArt.versions || [
    { version: 1, content: activeArt.code, createdAt: activeArt.createdAt },
  ];

  // Adjust container dimensions if device frames are chosen
  const getDeviceFrameStyles = () => {
    if (tab !== "preview" || isSvg || isMarkdown) return undefined;
    if (deviceMode === "tablet") return { width: "768px", maxWidth: "100%", margin: "0 auto", borderLeft: "1px solid #3e3b38", borderRight: "1px solid #3e3b38" };
    if (deviceMode === "mobile") return { width: "375px", maxWidth: "100%", margin: "0 auto", borderLeft: "1px solid #3e3b38", borderRight: "1px solid #3e3b38" };
    return undefined;
  };

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

      {/* Resizable / Slide-out panel */}
      <aside
        className={`fixed inset-x-0 bottom-0 top-12 z-50 flex flex-col rounded-t-2xl border-t border-line bg-shell shadow-2xl motion-artifact-panel lg:static lg:inset-auto lg:z-10 lg:h-full lg:rounded-none lg:border-t-0 lg:shadow-none font-sans overflow-hidden ${
          isOpen
            ? "translate-y-0 opacity-100 lg:border-l relative"
            : "translate-y-full pointer-events-none lg:translate-y-0 lg:w-0 lg:min-w-0 lg:max-w-0 lg:border-l-0 opacity-0 lg:opacity-0"
        }`}
        style={isOpen && isLargeScreen ? { width: `${width}px`, minWidth: "360px", maxWidth: "70%" } : undefined}
        aria-label="Artifact viewer"
      >
        {/* Resize Handler on Desktop */}
        {isOpen && isLargeScreen && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-accent/50 cursor-col-resize z-50 transition-colors"
            onMouseDown={handleMouseDown}
            title="Drag to resize panel"
          />
        )}

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

              {/* Versions Dropdown */}
              {versions.length > 1 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setVersionMenuOpen((v) => !v)}
                    className="flex items-center gap-1 rounded-md border border-line bg-elev-1 px-2 py-0.5 text-[12px] font-medium text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors cursor-pointer"
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
              {/* Sliding Pill Tab Switch */}
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

              {/* Action buttons */}
              <button
                type="button"
                onClick={handleCopy}
                title="Copy code"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink cursor-pointer"
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

          {/* Panel Body Container */}
          <div className={isFullscreen ? "fixed inset-0 z-[100] bg-[#181716] flex flex-col" : "relative min-h-0 flex-1 flex flex-col bg-[#181716] overflow-hidden"}>
            
            {/* If fullscreen mode, render a clean floating close button for usability */}
            {isFullscreen && (
              <div className="absolute right-4 top-4 z-[110]">
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="bg-elev-4 border border-line h-8 px-3 rounded-lg text-xs text-white hover:bg-elev-3 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Minimize2 size={13} />
                  <span>Exit Fullscreen</span>
                </button>
              </div>
            )}

            {/* PREVIEW TOOLBAR (only visible on preview tab and when not SVG/Markdown) */}
            {tab === "preview" && !isSvg && !isMarkdown && (
              <div className="flex shrink-0 items-center justify-between border-b border-line bg-elev-1 px-3 py-1.5 text-xs text-ink-muted select-none">
                {/* Left side: Device switches */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDeviceMode("desktop")}
                    className={`p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors flex items-center gap-1 font-medium cursor-pointer ${
                      deviceMode === "desktop" ? "text-accent bg-elev-2" : ""
                    }`}
                    title="Desktop frame"
                  >
                    <Monitor size={14} />
                    <span className="hidden sm:inline">Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceMode("tablet")}
                    className={`p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors flex items-center gap-1 font-medium cursor-pointer ${
                      deviceMode === "tablet" ? "text-accent bg-elev-2" : ""
                    }`}
                    title="Tablet frame (768px)"
                  >
                    <Tablet size={14} />
                    <span className="hidden sm:inline">Tablet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceMode("mobile")}
                    className={`p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors flex items-center gap-1 font-medium cursor-pointer ${
                      deviceMode === "mobile" ? "text-accent bg-elev-2" : ""
                    }`}
                    title="Mobile frame (375px)"
                  >
                    <Smartphone size={14} />
                    <span className="hidden sm:inline">Mobile</span>
                  </button>
                </div>

                {/* Right side: Reload, Open in new tab, Fullscreen */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleReload}
                    className="p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors cursor-pointer"
                    title="Reload preview"
                  >
                    <RotateCw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenNewTab}
                    className="p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors cursor-pointer"
                    title="Open in new tab"
                  >
                    <ExternalLink size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors cursor-pointer"
                    title={isFullscreen ? "Minimize preview" : "Simulated fullscreen"}
                  >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                </div>
              </div>
            )}

            {/* DIFF COMPARE HEADER (only visible in Code tab if multiple versions exist) */}
            {tab === "code" && versions.length > 1 && (
              <div className="flex shrink-0 items-center justify-between border-b border-line bg-[#1c1a19] px-4 py-2 text-xs select-none">
                <span className="font-medium text-ink-soft">Compare with previous version</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-ink-muted hover:text-ink transition-colors">
                  <input
                    type="checkbox"
                    checked={showDiff}
                    onChange={(e) => setShowDiff(e.target.checked)}
                    className="accent-accent cursor-pointer rounded"
                  />
                  <span>Show changes (Diff)</span>
                </label>
              </div>
            )}

            {/* Inner iframe / Code Renderer viewport */}
            <div className="relative min-h-0 flex-1 overflow-hidden bg-[#181716] flex flex-col">
              <ErrorBoundary fallbackType="artifact">
                {tab === "preview" ? (
                  isSvg ? (
                    /* SVG center container */
                    <div
                      className="flex h-full w-full items-center justify-center p-8 bg-[#181716] overflow-auto scroll-slim [&>svg]:max-w-[90%] [&>svg]:max-h-[85vh] [&>svg]:drop-shadow-lg"
                      dangerouslySetInnerHTML={{ __html: currentCode }}
                    />
                  ) : isMarkdown ? (
                    /* Markdown renderer */
                    <div className="scroll-slim h-full overflow-auto p-6 bg-shell">
                      <div className="max-w-2xl mx-auto">
                        <MarkdownView content={currentCode} />
                      </div>
                    </div>
                  ) : (
                    /* Sandboxed frame for HTML and React React UMD Babel standalone */
                    <div className="h-full w-full flex-1 overflow-hidden bg-[#181716] relative flex">
                      <iframe
                        key={reloadKey}
                        srcDoc={previewHtml}
                        sandbox="allow-scripts"
                        title={activeArt.title}
                        style={getDeviceFrameStyles()}
                        className="h-full w-full border-0 bg-transparent transition-opacity duration-200 opacity-100"
                      />

                      {/* Floating runtime error banner */}
                      {iframeError && (
                        <div className="absolute bottom-0 inset-x-0 bg-red-950/95 border-t border-red-800/80 px-4 py-3 flex items-center justify-between text-xs text-red-200 z-20 backdrop-blur-sm anim-fade-in font-sans">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AlertTriangle size={15} className="text-red-400 shrink-0 animate-pulse" />
                            <div className="min-w-0">
                              <p className="font-semibold text-red-100">This artifact has an error</p>
                              <p className="truncate text-red-300 font-mono mt-0.5">{iframeError}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleFixWithAI}
                            className="shrink-0 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm ml-3"
                          >
                            Fix with AI
                          </button>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  /* CODE TAB VIEW (renders normal line numbers or diff mode) */
                  <div
                    ref={codeContainerRef}
                    className="scroll-slim h-full overflow-auto p-4 text-[13px] font-mono leading-relaxed"
                  >
                    {showDiff && previousCode ? (
                      /* Diff highlighted lines */
                      <div className="flex flex-col w-full text-start">
                        {diffLinesWithHighlight.map((line, lineIdx) => {
                          if (line.type === "added") {
                            return (
                              <div
                                key={lineIdx}
                                className="flex items-start bg-emerald-950/30 text-emerald-300 border-s-2 border-emerald-500 px-2 py-0.5 w-full leading-relaxed"
                              >
                                <span className="text-emerald-500/50 w-6 shrink-0 text-right pr-2 select-none font-bold">
                                  +
                                </span>
                                <span dangerouslySetInnerHTML={{ __html: line.html || "&nbsp;" }} />
                              </div>
                            );
                          } else if (line.type === "removed") {
                            return (
                              <div
                                key={lineIdx}
                                className="flex items-start bg-rose-950/25 text-rose-300/80 line-through border-s-2 border-rose-500 px-2 py-0.5 w-full leading-relaxed"
                              >
                                <span className="text-rose-500/50 w-6 shrink-0 text-right pr-2 select-none font-bold">
                                  -
                                </span>
                                <span dangerouslySetInnerHTML={{ __html: line.html || "&nbsp;" }} />
                              </div>
                            );
                          } else {
                            return (
                              <div key={lineIdx} className="flex items-start px-2 py-0.5 w-full leading-relaxed text-ink-soft">
                                <span className="text-ink-muted/20 w-6 shrink-0 text-right pr-2 select-none">
                                  &nbsp;
                                </span>
                                <span dangerouslySetInnerHTML={{ __html: line.html || "&nbsp;" }} />
                              </div>
                            );
                          }
                        })}
                      </div>
                    ) : (
                      /* Normal code view with lines */
                      <pre className="code-with-lines m-0 text-ink text-start">
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
                    )}
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
