import { useState } from "react";
import { Check, Copy, Download, WrapText, ListOrdered, ChevronDown, ChevronUp } from "lucide-react";
import hljs from "../../utils/hljs";

type Props = {
  language?: string;
  code: string;
};

export default function CodeBlock({ language = "", code }: Props) {
  const [copied, setCopied] = useState(false);
  const [isWrapped, setIsWrapped] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  
  const lines = code.split("\n");
  const lineCount = lines.length;
  
  const isCollapsible = lineCount > 40;
  const [isCollapsed, setIsCollapsed] = useState(isCollapsible);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    const cleanLang = language.trim().toLowerCase();
    let ext = "txt";
    if (cleanLang === "javascript" || cleanLang === "js") ext = "js";
    else if (cleanLang === "typescript" || cleanLang === "ts") ext = "ts";
    else if (cleanLang === "python" || cleanLang === "py") ext = "py";
    else if (cleanLang === "html") ext = "html";
    else if (cleanLang === "css") ext = "css";
    else if (cleanLang === "json") ext = "json";
    else if (cleanLang === "rust" || cleanLang === "rs") ext = "rs";
    else if (cleanLang === "go") ext = "go";
    else if (cleanLang === "bash" || cleanLang === "sh") ext = "sh";
    
    a.download = `code_block.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const cleanLang = language.trim().toLowerCase();
  let highlighted: string;
  try {
    if (cleanLang && hljs.getLanguage(cleanLang)) {
      highlighted = hljs.highlight(code, { language: cleanLang }).value;
    } else {
      highlighted = hljs.highlightAuto(code).value;
    }
  } catch {
    highlighted = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  const htmlLines = highlighted.split("\n");
  const displayedLines = isCollapsed ? htmlLines.slice(0, 20) : htmlLines;

  return (
    <div 
      dir="ltr" 
      className="my-4 overflow-hidden rounded-lg border border-line bg-[#161514] font-sans text-start relative"
    >
      {/* code block header bar */}
      <div className="flex h-9 items-center justify-between border-b border-line/70 bg-[#1e1c1a] px-3.5 text-[12px] text-ink-muted">
        <span className="font-mono text-[12px] uppercase tracking-wider text-ink-soft select-none">
          {cleanLang || "code"}
        </span>
        
        <div className="flex items-center gap-2">
          {/* Line Numbers Toggle */}
          <button
            type="button"
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 cursor-pointer ${
              showLineNumbers ? "bg-accent/15 text-accent hover:bg-accent/25" : "text-ink-muted hover:bg-elev-2 hover:text-ink"
            }`}
            title="Toggle Line Numbers"
            aria-label="Toggle Line Numbers"
          >
            <ListOrdered size={13} />
            <span className="hidden sm:inline">Lines</span>
          </button>

          {/* Wrap Toggle */}
          <button
            type="button"
            onClick={() => setIsWrapped(!isWrapped)}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 cursor-pointer ${
              isWrapped ? "bg-accent/15 text-accent hover:bg-accent/25" : "text-ink-muted hover:bg-elev-2 hover:text-ink"
            }`}
            title="Toggle Word Wrap"
            aria-label="Toggle Word Wrap"
          >
            <WrapText size={13} />
            <span className="hidden sm:inline">Wrap</span>
          </button>

          {/* Download for over 30 lines */}
          {lineCount > 30 && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-ink-muted transition-colors duration-150 hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 cursor-pointer"
              title="Download code file"
              aria-label="Download code file"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-ink-muted transition-colors duration-150 hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 cursor-pointer font-medium"
            aria-label="Copy code to clipboard"
          >
            {copied ? (
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

      {/* highlighted code body */}
      <div className={`overflow-x-auto scroll-slim ${isWrapped ? "" : "whitespace-nowrap"}`}>
        <div className="font-mono text-[13px] leading-relaxed py-2.5">
          {displayedLines.map((lineHtml, i) => (
            <div key={i} className="flex hover:bg-white/5 px-4 group/line min-w-0">
              {showLineNumbers && (
                <span className="w-8 select-none text-right text-[#4a4744] pr-3 font-mono text-[11px] shrink-0 border-r border-[#262422] mr-3 select-none">
                  {i + 1}
                </span>
              )}
              <span
                className={`flex-1 select-text ${isWrapped ? "whitespace-pre-wrap break-all" : "whitespace-pre"}`}
                dangerouslySetInnerHTML={{ __html: lineHtml || " " }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Collapse Overlay */}
      {isCollapsible && (
        <div className={`flex flex-col items-center justify-end ${
          isCollapsed 
            ? "absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#161514] via-[#161514]/90 to-transparent pt-8 pb-3" 
            : "border-t border-line/40 bg-[#1e1c1a]/50 py-2"
        }`}>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1e1c1a] hover:bg-elev-3 text-ink-soft hover:text-ink border border-line/60 px-4 py-1.5 text-[12px] font-medium transition-all shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 cursor-pointer"
          >
            {isCollapsed ? (
              <>
                <span>Show all ({lineCount} lines)</span>
                <ChevronDown size={14} />
              </>
            ) : (
              <>
                <span>Show less</span>
                <ChevronUp size={14} />
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Bottom spacer padding if collapsible but expanded */}
      {isCollapsible && !isCollapsed && <div className="h-4" />}
    </div>
  );
}
