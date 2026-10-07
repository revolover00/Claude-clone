import React from "react";
import { marked, type Tokens } from "marked";
import CodeBlock from "./CodeBlock";

type Props = {
  content: string;
  className?: string;
};

export default function MarkdownView({ content, className = "" }: Props) {
  // Use marked.lexer to separate block-level structures
  const tokens = React.useMemo(() => {
    try {
      return marked.lexer(content);
    } catch {
      return [];
    }
  }, [content]);

  if (!tokens || tokens.length === 0) {
    return <span className={className}>{content}</span>;
  }

  return (
    <div className={`space-y-3 font-serif text-[16px] leading-7 text-ink ${className}`}>
      {tokens.map((token, idx) => {
        switch (token.type) {
          case "code": {
            const codeToken = token as Tokens.Code;
            return (
              <CodeBlock
                key={idx}
                language={codeToken.lang}
                code={codeToken.text}
              />
            );
          }

          case "heading": {
            const headingToken = token as Tokens.Heading;
            const innerHtml = marked.parseInline(headingToken.text) as string;
            const depth = Math.min(headingToken.depth, 4);
            const sizeClass =
              depth === 1
                ? "text-[24px] font-medium text-[#edeae4] mt-6 mb-3"
                : depth === 2
                ? "text-[20px] font-medium text-[#edeae4] mt-5 mb-2.5"
                : "text-[18px] font-medium text-[#edeae4] mt-4 mb-2";

            if (depth === 1) {
              return <h1 key={idx} className={sizeClass} dangerouslySetInnerHTML={{ __html: innerHtml }} />;
            }
            if (depth === 2) {
              return <h2 key={idx} className={sizeClass} dangerouslySetInnerHTML={{ __html: innerHtml }} />;
            }
            if (depth === 3) {
              return <h3 key={idx} className={sizeClass} dangerouslySetInnerHTML={{ __html: innerHtml }} />;
            }
            return <h4 key={idx} className={sizeClass} dangerouslySetInnerHTML={{ __html: innerHtml }} />;
          }

          case "paragraph": {
            const paraToken = token as Tokens.Paragraph;
            const innerHtml = marked.parseInline(paraToken.text) as string;
            return (
              <p
                key={idx}
                className="leading-7 text-ink/95"
                dangerouslySetInnerHTML={{ __html: innerHtml }}
              />
            );
          }

          case "list": {
            const listToken = token as Tokens.List;
            const ListTag = listToken.ordered ? "ol" : "ul";
            const listStyle = listToken.ordered ? "list-decimal" : "list-disc";

            return (
              <ListTag
                key={idx}
                className={`my-3 space-y-1.5 pl-6 ${listStyle} text-ink/95`}
              >
                {listToken.items.map((item, itemIdx) => {
                  const itemHtml = marked.parseInline(item.text) as string;
                  return (
                    <li
                      key={itemIdx}
                      dangerouslySetInnerHTML={{ __html: itemHtml }}
                    />
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
                key={idx}
                className="my-3 border-l-2 border-[#54504b] pl-4 italic text-ink-soft [&>p]:leading-relaxed"
                dangerouslySetInnerHTML={{ __html: bqHtml }}
              />
            );
          }

          case "table": {
            const tableToken = token as Tokens.Table;
            return (
              <div key={idx} className="my-4 overflow-x-auto">
                <table className="min-w-full border-collapse border border-line text-[14px] font-sans">
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
                            className="border border-line px-3.5 py-2 text-ink-soft"
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
            return <hr key={idx} className="my-6 border-line" />;

          case "space":
            return null;

          default: {
            const inlineHtml = marked.parseInline(token.raw) as string;
            return (
              <div
                key={idx}
                dangerouslySetInnerHTML={{ __html: inlineHtml }}
              />
            );
          }
        }
      })}
    </div>
  );
}
