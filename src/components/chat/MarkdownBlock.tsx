import React from "react";
import { marked, type Tokens } from "marked";
import CodeBlock from "./CodeBlock";
import ArtifactCard from "./ArtifactCard";
import ClaudeSpark from "../icons/ClaudeSpark";
import type { Artifact } from "../../types/chat";
import {
  isArtifactCandidate,
  getArtifactType,
  extractArtifactTitle,
} from "../../utils/artifactDetector";

export interface BlockProps {
  token: Tokens.Generic;
  idx: number;
  isLastBlock: boolean;
  isStreaming: boolean;
  userPrompt: string;
  conversationId: string;
  onOpenArtifact?: (artifact: Artifact) => void;
}

/**
 * Inline 14px ClaudeSpark at the end of the last line:
 * Slowly rotating (2.4s linear) and pulsing (scale .92 -> 1.06).
 * Fades out in 150ms when stream ends.
 */
export function LiveStreamSpark({ isStreaming }: { isStreaming: boolean }) {
  const [visible, setVisible] = React.useState(isStreaming);
  const [isExiting, setIsExiting] = React.useState(false);

  React.useEffect(() => {
    if (isStreaming) {
      setVisible(true);
      setIsExiting(false);
    } else if (visible) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setIsExiting(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, visible]);

  if (!visible) return null;

  return (
    <span
      className={`inline-flex items-center align-middle ms-1.5 ${
        isExiting ? "anim-spark-exit" : ""
      }`}
      aria-hidden="true"
    >
      <ClaudeSpark
        size={14}
        className="anim-thinking-spark text-accent inline-block"
      />
    </span>
  );
}

/**
 * Memoized block renderer.
 * If not the last block and raw content hasn't changed, does not re-render.
 */
export const MemoizedBlock = React.memo(
  function MemoizedBlock({
    token,
    isLastBlock,
    isStreaming,
    userPrompt,
    conversationId,
    onOpenArtifact,
  }: BlockProps) {
    switch (token.type) {
      case "code": {
        const codeToken = token as Tokens.Code;
        const lang = codeToken.lang || "";
        const code = codeToken.text || "";

        // Replace qualifying code blocks with interactive ArtifactCard
        if (isArtifactCandidate(lang, code, userPrompt)) {
          const type = getArtifactType(lang, code);
          const title = extractArtifactTitle(code, type);
          let normLang = lang.toLowerCase();
          if (normLang === "react") normLang = "tsx";
          if (normLang === "md") normLang = "markdown";

          const art: Artifact = {
            id: `art-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
            identifier: title.toLowerCase().replace(/[^a-z0-9]/g, "-"),
            title,
            language: normLang,
            type,
            code,
            chatId: conversationId,
            chatTitle: "",
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          return (
            <div className="relative">
              <ArtifactCard
                title={title}
                type={type}
                isStreaming={isStreaming && isLastBlock}
                onClick={() => onOpenArtifact?.(art)}
              />
            </div>
          );
        }

        return (
          <div className="relative">
            <CodeBlock language={codeToken.lang} code={codeToken.text} />
          </div>
        );
      }

      case "heading": {
        const headingToken = token as Tokens.Heading;
        const innerHtml = marked.parseInline(headingToken.text) as string;
        const depth = Math.min(headingToken.depth, 4);
        const sizeClass =
          depth === 1
            ? "text-[24px] font-medium text-ink mt-6 mb-3 text-start"
            : depth === 2
            ? "text-[20px] font-medium text-ink mt-5 mb-2.5 text-start"
            : "text-[18px] font-medium text-ink mt-4 mb-2 text-start";

        const contentElem = (
          <span dangerouslySetInnerHTML={{ __html: innerHtml }} />
        );

        if (depth === 1) {
          return (
            <h1 className={sizeClass}>
              {contentElem}
              {isStreaming && isLastBlock && (
                <LiveStreamSpark isStreaming={isStreaming} />
              )}
            </h1>
          );
        }
        if (depth === 2) {
          return (
            <h2 className={sizeClass}>
              {contentElem}
              {isStreaming && isLastBlock && (
                <LiveStreamSpark isStreaming={isStreaming} />
              )}
            </h2>
          );
        }
        if (depth === 3) {
          return (
            <h3 className={sizeClass}>
              {contentElem}
              {isStreaming && isLastBlock && (
                <LiveStreamSpark isStreaming={isStreaming} />
              )}
            </h3>
          );
        }
        return (
          <h4 className={sizeClass}>
            {contentElem}
            {isStreaming && isLastBlock && (
              <LiveStreamSpark isStreaming={isStreaming} />
            )}
          </h4>
        );
      }

      case "paragraph": {
        const paraToken = token as Tokens.Paragraph;
        const innerHtml = marked.parseInline(paraToken.text) as string;

        return (
          <p
            className={`leading-7 text-ink/95 text-start ${
              isStreaming && isLastBlock ? "anim-chunk" : ""
            }`}
          >
            <span dangerouslySetInnerHTML={{ __html: innerHtml }} />
            {isStreaming && isLastBlock && (
              <LiveStreamSpark isStreaming={isStreaming} />
            )}
          </p>
        );
      }

      case "list": {
        const listToken = token as Tokens.List;
        const ListTag = listToken.ordered ? "ol" : "ul";
        const listStyle = listToken.ordered ? "list-decimal" : "list-disc";

        return (
          <ListTag
            className={`my-3 space-y-1.5 ps-6 pe-2 ${listStyle} text-ink/95 text-start`}
          >
            {listToken.items.map((item, itemIdx) => {
              const itemHtml = marked.parseInline(item.text) as string;
              const isLastItem =
                isStreaming && isLastBlock && itemIdx === listToken.items.length - 1;
              return (
                <li key={itemIdx} className="text-start">
                  <span dangerouslySetInnerHTML={{ __html: itemHtml }} />
                  {isLastItem && <LiveStreamSpark isStreaming={isStreaming} />}
                </li>
              );
            })}
          </ListTag>
        );
      }

      case "blockquote": {
        const bqToken = token as Tokens.Blockquote;
        const bqHtml = marked.parse(bqToken.raw) as string;
        return (
          <blockquote
            className="my-3 border-s-2 border-line-soft ps-4 pe-2 italic text-ink-soft text-start [&>p]:leading-relaxed [&>p]:text-start"
            dangerouslySetInnerHTML={{ __html: bqHtml }}
          />
        );
      }

      case "table": {
        const tableToken = token as Tokens.Table;
        return (
          <div className="my-4 overflow-x-auto">
            <table className="min-w-full border-collapse border border-line text-[14px] font-sans text-start">
              <thead>
                <tr className="bg-elev-1">
                  {tableToken.header.map((cell, cellIdx) => (
                    <th
                      key={cellIdx}
                      className="border border-line px-3.5 py-2 text-start font-medium text-ink"
                      dangerouslySetInnerHTML={{
                        __html: marked.parseInline(cell.text) as string,
                      }}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableToken.rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={rowIdx % 2 === 1 ? "bg-elev-1/40" : ""}
                  >
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className="border border-line px-3.5 py-2 text-ink-soft text-start"
                        dangerouslySetInnerHTML={{
                          __html: marked.parseInline(cell.text) as string,
                        }}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case "hr":
        return <hr className="my-6 border-line" />;

      case "space":
        return null;

      default: {
        const inlineHtml = marked.parseInline(token.raw) as string;
        return (
          <div className="text-start">
            <span dangerouslySetInnerHTML={{ __html: inlineHtml }} />
            {isStreaming && isLastBlock && (
              <LiveStreamSpark isStreaming={isStreaming} />
            )}
          </div>
        );
      }
    }
  },
  (prev, next) => {
    // Custom comparator for React.memo
    // Re-render if it was or is the last block, or if raw token text changed, or if streaming status changed
    if (prev.isLastBlock || next.isLastBlock) return false;
    if (prev.isStreaming !== next.isStreaming) return false;
    if (prev.token.raw !== next.token.raw) return false;
    if (prev.conversationId !== next.conversationId) return false;
    return true;
  }
);
