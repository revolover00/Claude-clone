import { AlertTriangle } from "lucide-react";
import MarkdownView from "../chat/MarkdownView";
import ErrorBoundary from "../shared/ErrorBoundary";
import type { Artifact } from "../../types/chat";

interface ArtifactPreviewProps {
  activeArt: Artifact;
  currentCode: string;
  previewHtml: string;
  isSvg: boolean;
  isMarkdown: boolean;
  reloadKey: number;
  deviceMode: "desktop" | "tablet" | "mobile";
  iframeError: string | null;
  onFixWithAI: () => void;
}

export default function ArtifactPreview({
  activeArt,
  currentCode,
  previewHtml,
  isSvg,
  isMarkdown,
  reloadKey,
  deviceMode,
  iframeError,
  onFixWithAI,
}: ArtifactPreviewProps) {
  const getDeviceFrameStyles = () => {
    if (isSvg || isMarkdown) return undefined;
    if (deviceMode === "tablet") {
      return {
        width: "768px",
        maxWidth: "100%",
        margin: "0 auto",
        borderLeft: "1px solid #3e3b38",
        borderRight: "1px solid #3e3b38",
      };
    }
    if (deviceMode === "mobile") {
      return {
        width: "375px",
        maxWidth: "100%",
        margin: "0 auto",
        borderLeft: "1px solid #3e3b38",
        borderRight: "1px solid #3e3b38",
      };
    }
    return undefined;
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#181716] flex flex-col">
      <ErrorBoundary fallbackType="artifact">
        {isSvg ? (
          <div
            className="flex h-full w-full items-center justify-center p-8 bg-[#181716] overflow-auto scroll-slim [&>svg]:max-w-[90%] [&>svg]:max-h-[85vh] [&>svg]:drop-shadow-lg"
            dangerouslySetInnerHTML={{ __html: currentCode }}
          />
        ) : isMarkdown ? (
          <div className="scroll-slim h-full overflow-auto p-6 bg-shell">
            <div className="max-w-2xl mx-auto">
              <MarkdownView content={currentCode} />
            </div>
          </div>
        ) : (
          <div className="h-full w-full flex-1 overflow-hidden bg-[#181716] relative flex">
            <iframe
              key={reloadKey}
              srcDoc={previewHtml}
              sandbox="allow-scripts"
              title={activeArt.title}
              style={getDeviceFrameStyles()}
              className="h-full w-full border-0 bg-transparent transition-opacity duration-200 opacity-100"
            />

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
                  onClick={onFixWithAI}
                  className="shrink-0 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm ml-3"
                >
                  Fix with AI
                </button>
              </div>
            )}
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}
