import { ChevronRight, Sparkles } from "lucide-react";
import type { Artifact } from "../../types/chat";

type Props = {
  artifact: Artifact;
  onOpen: (artifact: Artifact) => void;
};

export default function ArtifactCard({ artifact, onOpen }: Props) {
  return (
    <div
      onClick={() => onOpen(artifact)}
      className="my-3 flex items-center justify-between rounded-xl border border-line bg-elev-1 p-3.5 transition-all duration-150 hover:border-accent/60 hover:bg-elev-2 cursor-pointer group shadow-sm font-sans"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-elev-2 text-accent group-hover:scale-105 transition-transform">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-[14.5px] font-medium text-ink group-hover:text-accent transition-colors">
              {artifact.title}
            </h4>
            <span className="rounded bg-elev-3 px-1.5 py-0.2 text-[10.5px] font-mono font-medium text-ink-muted">
              v{artifact.version || 1}
            </span>
          </div>
          <p className="text-[12px] text-ink-muted">
            Code · {artifact.type || "HTML"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-lg border border-line bg-elev-2/80 px-2.5 py-1 text-[12px] font-medium text-ink-soft transition-colors group-hover:border-accent/40 group-hover:text-ink shrink-0 ms-3">
        <span>Click to open</span>
        <ChevronRight size={14} className="text-ink-muted group-hover:text-ink" />
      </div>
    </div>
  );
}
