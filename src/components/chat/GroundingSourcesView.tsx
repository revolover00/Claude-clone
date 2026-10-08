import { ExternalLink } from "lucide-react";

interface GroundingSourcesViewProps {
  sources: Array<{ title: string; url: string }>;
}

export default function GroundingSourcesView({ sources }: GroundingSourcesViewProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3.5 pt-2.5 border-t border-line/40 select-none">
      <div className="text-[11.5px] font-medium uppercase tracking-wider text-ink-faint mb-2">
        Sources
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((src, idx) => {
          let domain: string;
          try {
            domain = new URL(src.url).hostname.replace(/^www\./, "");
          } catch {
            domain = src.title || "source";
          }
          const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

          return (
            <a
              key={`${src.url}-${idx}`}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elev-1 px-2.5 py-1 text-[12px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors max-w-[240px]"
              title={src.title}
            >
              <img
                src={faviconUrl}
                alt=""
                className="h-3.5 w-3.5 shrink-0 rounded-xs"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="truncate font-medium">{domain}</span>
              <ExternalLink size={10} className="shrink-0 text-ink-faint" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
