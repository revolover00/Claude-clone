/**
 * Utility functions for streaming markdown and smooth character rendering.
 */

/**
 * Calculates adaptive drain rate (chars per animation frame).
 * chars/frame = clamp(ceil(queueLength / 10), 1, 60)
 * Allows catching up a backlog in ~250ms (~15 frames @ 60fps = ~15 * 40 = 600 chars)
 * while small chunks drain at a steady 1-3 chars/frame.
 */
export function getAdaptiveDrainRate(queueLength: number): number {
  if (queueLength <= 0) return 0;
  const calculated = Math.ceil(queueLength / 10);
  return Math.max(1, Math.min(60, calculated));
}

/**
 * Checks if index cuts in the middle of a UTF-16 surrogate pair.
 * High surrogate is \uD800-\uDBFF (0xD800-0xDBFF).
 */
export function isInsideSurrogatePair(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return false;
  const prevCode = text.charCodeAt(index - 1);
  return prevCode >= 0xd800 && prevCode <= 0xdbff;
}

/**
 * Checks if index cuts in the middle of a markdown delimiter marker.
 * Tokens to avoid cutting in half:
 * - ``` (code fence: 3 backticks)
 * - ** (bold: 2 asterisks)
 * - * (italic)
 * - ` (inline code)
 * - ~~ (strikethrough)
 * If index is in the middle of a contiguous sequence of ` or *, return adjusted boundary.
 */
export function adjustDrainBoundary(text: string, rawCutIndex: number): number {
  if (rawCutIndex >= text.length) return text.length;
  if (rawCutIndex <= 0) return 0;

  let cut = rawCutIndex;

  // 1. Surrogate pair check: never split high surrogate and low surrogate
  if (isInsideSurrogatePair(text, cut)) {
    // Advance past the low surrogate
    cut++;
    if (cut >= text.length) return text.length;
  }

  // 2. Markdown delimiter tokens: check if we are in the middle of repeated delimiters like ``` or ** or ~~
  const charAtCut = text[cut];
  const charBefore = text[cut - 1];

  // If previous char and current char are identical delimiter characters (` or * or ~),
  // don't cut between them - advance to the end of that sequence of identical delimiters
  if (
    (charBefore === "`" && charAtCut === "`") ||
    (charBefore === "*" && charAtCut === "*") ||
    (charBefore === "~" && charAtCut === "~")
  ) {
    while (cut < text.length && text[cut] === charBefore) {
      cut++;
    }
  }

  return cut;
}

/**
 * Auto-closes unclosed markdown delimiters in streaming partial text.
 * - Unclosed ```: auto-appends \n``` so code blocks format properly in marked.
 * - Unclosed inline code `: auto-appends `
 * - Unclosed **: auto-appends **
 * - Unclosed *: auto-appends *
 * - Table row with partial pipe: avoids flashing raw | if header + separator row not complete
 */
export function autoCloseMarkdown(text: string): string {
  if (!text) return "";

  let result = text;

  // 1. Check code fences ```
  // Count unescaped ``` fences
  const fenceMatches = result.match(/^```/gm);
  const fenceCount = fenceMatches ? fenceMatches.length : 0;
  if (fenceCount % 2 !== 0) {
    // An open fence exists. Check if it's on a new line or needs \n```
    if (!result.endsWith("\n")) {
      result += "\n```";
    } else {
      result += "```";
    }
    // If inside an open code block, return immediately so we don't fiddle with internal markdown
    return result;
  }

  // 2. Count inline code backticks ` outside of ``` fences
  // Split by code fences if any
  const parts = result.split(/(```[\s\S]*?```)/g);
  let processed = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith("```")) {
      processed += part;
      continue;
    }

    let segment = part;

    // Check single backticks `
    // Matches single ` not preceded or followed by `
    const backticks = segment.match(/(?<!`)`(?!`)/g);
    if (backticks && backticks.length % 2 !== 0) {
      segment += "`";
    }

    // Check bold **
    // Count occurrences of **
    const boldMatches = segment.match(/\*\*/g);
    if (boldMatches && boldMatches.length % 2 !== 0) {
      segment += "**";
    } else {
      // Check italic * (only when bold count is even)
      // Count single * not adjacent to *
      const italicMatches = segment.match(/(?<!\*)\*(?!\*)/g);
      if (italicMatches && italicMatches.length % 2 !== 0) {
        segment += "*";
      }
    }

    // Check tables: Table renders only after header + separator rows exist
    // If a line starts with | or contains | but there's no matching table separator row (e.g. |---|),
    // don't let broken pipes format prematurely or crash marked.
    processed += segment;
  }

  return processed;
}

/**
 * Checks if a partial table has both header and separator rows (| --- |).
 * If a block begins like a table (| col 1 | col 2 |) but doesn't have the separator line yet,
 * we hide or escape the raw table text until the separator arrives.
 */
export function isCompleteOrNonTable(blockRaw: string): boolean {
  const lines = blockRaw.trim().split("\n");
  if (lines.length === 0) return true;
  const firstLine = lines[0].trim();
  if (!firstLine.startsWith("|") && !firstLine.includes("|")) {
    return true; // Not a table block
  }
  // It looks like a table row: check if there's at least a 2nd line that is a separator (|---| or |:---:|)
  if (lines.length < 2) return false;
  const secondLine = lines[1].trim();
  const isSeparator = /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(secondLine);
  return isSeparator;
}

/**
 * Formats duration in milliseconds into Claude.ai thinking badge style:
 * e.g. "8s", "1m 5s", "42s"
 */
export function formatThinkingDuration(ms: number): string {
  if (!ms || ms < 1000) {
    const s = Math.max(1, Math.round(ms / 1000));
    return `${s}s`;
  }
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
