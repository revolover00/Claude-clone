import { Monitor, Tablet, Smartphone, RotateCw, ExternalLink, Minimize2, Maximize2 } from "lucide-react";

interface ArtifactPreviewToolbarProps {
  deviceMode: "desktop" | "tablet" | "mobile";
  setDeviceMode: (mode: "desktop" | "tablet" | "mobile") => void;
  setReloadKey: React.Dispatch<React.SetStateAction<number>>;
  previewHtml: string;
  isFullscreen: boolean;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ArtifactPreviewToolbar({
  deviceMode,
  setDeviceMode,
  setReloadKey,
  previewHtml,
  isFullscreen,
  setIsFullscreen,
}: ArtifactPreviewToolbarProps) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-line bg-elev-1 px-3 py-1.5 text-xs text-ink-muted select-none">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setDeviceMode("desktop")}
          className={`p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors flex items-center gap-1 font-medium cursor-pointer ${deviceMode === "desktop" ? "text-accent bg-elev-2" : ""}`}
          title="Desktop frame"
        >
          <Monitor size={14} />
          <span className="hidden sm:inline">Desktop</span>
        </button>
        <button
          type="button"
          onClick={() => setDeviceMode("tablet")}
          className={`p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors flex items-center gap-1 font-medium cursor-pointer ${deviceMode === "tablet" ? "text-accent bg-elev-2" : ""}`}
          title="Tablet frame (768px)"
        >
          <Tablet size={14} />
          <span className="hidden sm:inline">Tablet</span>
        </button>
        <button
          type="button"
          onClick={() => setDeviceMode("mobile")}
          className={`p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors flex items-center gap-1 font-medium cursor-pointer ${deviceMode === "mobile" ? "text-accent bg-elev-2" : ""}`}
          title="Mobile frame (375px)"
        >
          <Smartphone size={14} />
          <span className="hidden sm:inline">Mobile</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors cursor-pointer"
          title="Reload preview"
        >
          <RotateCw size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            const blob = new Blob([previewHtml], { type: "text/html" });
            window.open(URL.createObjectURL(blob), "_blank");
          }}
          className="p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors cursor-pointer"
          title="Open in new tab"
        >
          <ExternalLink size={14} />
        </button>
        <button
          type="button"
          onClick={() => setIsFullscreen((f) => !f)}
          className="p-1.5 rounded hover:bg-elev-3 hover:text-ink transition-colors cursor-pointer"
          title={isFullscreen ? "Minimize preview" : "Simulated fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );
}
