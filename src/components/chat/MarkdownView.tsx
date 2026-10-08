import React from "react";
import { marked } from "marked";
import type { Artifact } from "../../types/chat";
import {
  autoCloseMarkdown,
  isCompleteOrNonTable,
} from "../../utils/streamSmoothing";
import { MemoizedBlock, LiveStreamSpark } from "./MarkdownBlock";

type Props = {
  content: string;
  className?: string;
  userPrompt?: string;
  isStreaming?: boolean;
  onOpenArtifact?: (artifact: Artifact) => void;
  conversationId?: string;
};

export default function MarkdownView({
  content,
  className = "",
  userPrompt = "",
  isStreaming = false,
  onOpenArtifact,
  conversationId = "",
}: Props) {
  // Normalize and auto-close unclosed markdown while streaming
  const processedContent = React.useMemo(() => {
    if (!isStreaming) return content;
    return autoCloseMarkdown(content);
  }, [content, isStreaming]);

  // Use marked.lexer to separate block-level structures
  const tokens = React.useMemo(() => {
    if (!processedContent) return [];
    try {
      const rawTokens = marked.lexer(processedContent);
      // Filter out partial broken tables that have not formed a header + separator row yet
      if (isStreaming) {
        return rawTokens.filter((tok) => {
          if (tok.type === "table") {
            return true;
          }
          // If token raw looks like a half-formed table, check it
          return isCompleteOrNonTable(tok.raw);
        });
      }
      return rawTokens;
    } catch {
      return [];
    }
  }, [processedContent, isStreaming]);

  if (!tokens || tokens.length === 0) {
    return (
      <span className={className}>
        {content}
        {isStreaming && <LiveStreamSpark isStreaming={isStreaming} />}
      </span>
    );
  }

  return (
    <div
      className={`space-y-3 font-serif text-[16px] leading-7 text-ink ${className}`}
    >
      {tokens.map((token, idx) => {
        const isLast = idx === tokens.length - 1;
        // Key consists of index and type, ensuring stability
        const key = `${idx}-${token.type}`;

        return (
          <MemoizedBlock
            key={key}
            token={token}
            idx={idx}
            isLastBlock={isLast}
            isStreaming={isStreaming}
            userPrompt={userPrompt}
            conversationId={conversationId}
            onOpenArtifact={onOpenArtifact}
          />
        );
      })}
    </div>
  );
}
export { LiveStreamSpark };
