import { useState } from "react";
import { Check, Copy } from "lucide-react";
import hljs from "../../utils/hljs";

type Props = {
  language?: string;
  code: string;
};

export default function CodeBlock({ language = "", code }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
    }
  };

  const cleanLang = language.trim().toLowerCase();
  let highlighted = "";
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

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-line bg-[#161514] font-sans">
      {/* code block header bar */}
      <div className="flex h-9 items-center justify-between border-b border-line/70 bg-[#1e1c1a] px-3.5 text-[12px] text-ink-muted">
        <span className="font-mono text-[12px] uppercase tracking-wider text-ink-soft">
          {cleanLang || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-ink-muted transition-colors duration-150 hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
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

      {/* highlighted code */}
      <div className="scroll-slim overflow-x-auto">
        <pre className="m-0 p-0">
          <code
            className="hljs"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      </div>
    </div>
  );
}
