import DOMPurify from "dompurify";

/** Sanitize markdown-generated HTML before it reaches dangerouslySetInnerHTML. */
export function sanitizeMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html);
}

/** Sanitize model-provided SVG before inserting it into the live document. */
export function sanitizeSvgHtml(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true },
    FORBID_TAGS: ["foreignObject", "script"],
    FORBID_ATTR: ["style"],
  });
}
