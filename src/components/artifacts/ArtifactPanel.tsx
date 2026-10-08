import { useState, useMemo, useEffect, useRef } from "react";
import { Minimize2 } from "lucide-react";
import hljs from "../../utils/hljs";
import type { Artifact } from "../../types/chat";
import { useToast } from "../../context/ToastContext";
import { computeHighlightedDiffLines } from "../../utils/diffUtils";
import { generatePreviewHtml } from "../../utils/artifactPreviewGenerator";
import ArtifactHeader from "./ArtifactHeader";
import ArtifactPreview from "./ArtifactPreview";
import ArtifactCodeView from "./ArtifactCodeView";
import ArtifactPreviewToolbar from "./ArtifactPreviewToolbar";
import { usePanelResize } from "./usePanelResize";

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

  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const { width, isLargeScreen, handleMouseDown } = usePanelResize();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isFullscreen]);

  const [displayedArtifact, setDisplayedArtifact] = useState<Artifact | null>(artifact);

  useEffect(() => {
    if (artifact) setDisplayedArtifact(artifact);
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

  const isCurrentlyStreaming = Boolean(activeArt?.isStreaming);
  const prevStreamingRef = useRef(isCurrentlyStreaming);

  useEffect(() => {
    if (isCurrentlyStreaming) {
      setTab("code");
    } else if (prevStreamingRef.current && !isCurrentlyStreaming) {
      setTab("preview");
    }
    prevStreamingRef.current = isCurrentlyStreaming;
  }, [isCurrentlyStreaming]);

  const codeContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isCurrentlyStreaming && codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [currentCode, isCurrentlyStreaming]);

  useEffect(() => {
    setIframeError(null);
  }, [currentCode, reloadKey]);

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
    const filename = `${activeArt.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.${ext}`;

    const blob = new Blob([currentCode], {
      type: isSvg ? "image/svg+xml" : lang === "html" ? "text/html" : "text/plain",
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

  const previousCode = useMemo(() => {
    if (!activeArt || !activeArt.versions || activeArt.versions.length <= 1) return "";
    const currentVerNum = activeArt.version || 1;
    if (currentVerNum <= 1) return "";
    const prevVer = activeArt.versions.find((v) => v.version === currentVerNum - 1);
    return prevVer ? prevVer.content : "";
  }, [activeArt]);

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
      html = currentCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    return html.split("\n");
  }, [activeArt, currentCode, lang]);

  const diffLinesWithHighlight = useMemo(() => {
    if (!showDiff || !previousCode) return [];
    return computeHighlightedDiffLines(previousCode, currentCode, lang, highlightedLines);
  }, [showDiff, previousCode, currentCode, highlightedLines, lang]);

  const previewHtml = useMemo(() => {
    if (!activeArt) return "";
    return generatePreviewHtml(activeArt, currentCode, isSvg, isMarkdown, isReact, lang);
  }, [activeArt, currentCode, isSvg, isMarkdown, isReact, lang]);

  if (!activeArt) return null;

  const versions = activeArt.versions || [
    { version: 1, content: activeArt.code, createdAt: activeArt.createdAt },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-x-0 bottom-0 top-12 z-50 flex flex-col rounded-t-2xl border-t border-line bg-shell shadow-2xl motion-artifact-panel lg:static lg:inset-auto lg:z-10 lg:h-full lg:rounded-none lg:border-t-0 lg:shadow-none font-sans overflow-hidden ${
          isOpen
            ? "translate-y-0 opacity-100 lg:border-l relative"
            : "translate-y-full pointer-events-none lg:translate-y-0 lg:w-0 lg:min-w-0 lg:max-w-0 lg:border-l-0 opacity-0 lg:opacity-0"
        }`}
        style={isOpen && isLargeScreen ? { width: `${width}px`, minWidth: "360px", maxWidth: "70%" } : undefined}
        aria-label="Artifact viewer"
      >
        {isOpen && isLargeScreen && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-accent/50 cursor-col-resize z-50 transition-colors"
            onMouseDown={handleMouseDown}
            title="Drag to resize panel"
          />
        )}

        <div className="flex h-full w-full min-w-[320px] lg:min-w-[420px] flex-col overflow-hidden">
          <div
            className="flex justify-center pt-2.5 pb-1 lg:hidden cursor-grab active:cursor-grabbing touch-none"
            onClick={onClose}
          >
            <div className="h-1.5 w-12 rounded-full bg-elev-4" />
          </div>

          <ArtifactHeader
            title={activeArt.title}
            version={activeArt.version || 1}
            versions={versions}
            onSelectVersion={onSelectVersion}
            tab={tab}
            setTab={setTab}
            copied={copied}
            onCopy={handleCopy}
            onDownload={handleDownload}
            onClose={onClose}
          />

          <div className={isFullscreen ? "fixed inset-0 z-[100] bg-[#181716] flex flex-col" : "relative min-h-0 flex-1 flex flex-col bg-[#181716] overflow-hidden"}>
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

            {tab === "preview" && !isSvg && !isMarkdown && (
              <ArtifactPreviewToolbar
                deviceMode={deviceMode}
                setDeviceMode={setDeviceMode}
                setReloadKey={setReloadKey}
                previewHtml={previewHtml}
                isFullscreen={isFullscreen}
                setIsFullscreen={setIsFullscreen}
              />
            )}

            {tab === "preview" ? (
              <ArtifactPreview
                activeArt={activeArt}
                currentCode={currentCode}
                previewHtml={previewHtml}
                isSvg={isSvg}
                isMarkdown={isMarkdown}
                reloadKey={reloadKey}
                deviceMode={deviceMode}
                iframeError={iframeError}
                onFixWithAI={handleFixWithAI}
              />
            ) : (
              <ArtifactCodeView
                currentCode={currentCode}
                previousCode={previousCode}
                showDiff={showDiff}
                setShowDiff={setShowDiff}
                highlightedLines={highlightedLines}
                diffLinesWithHighlight={diffLinesWithHighlight}
                codeContainerRef={codeContainerRef}
                versionsCount={versions.length}
              />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
