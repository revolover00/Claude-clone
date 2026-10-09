export interface ThinkingStage {
  title: string;
  body: string;
  done: boolean;
  type?: "thinking" | "tool";
  toolStatus?: "searching" | "completed";
  resultCount?: number;
  queries?: string[];
}

export function isRtlText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function formatThinkingDuration(ms: number): string {
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

export function parseThinkingStages(accumulatedText: string, isThinking = true): ThinkingStage[] {
  if (!accumulatedText || !accumulatedText.trim()) return [];

  // Normalize any literal escaped newlines (e.g. from JSX string attributes)
  const normalizedText = accumulatedText.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");

  // Match bold titles that start on their own line (or start of stream)
  // e.g. "**Planning the layout**\n\nbody..."
  const headingRegex = /(?:^|\r?\n)[ \t]*\*\*([^*\r\n]+)\*\*[ \t]*(?:\r?\n|$)/g;
  const matches: { title: string; startIndex: number; endIndex: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = headingRegex.exec(normalizedText)) !== null) {
    matches.push({
      title: m[1].trim(),
      startIndex: m.index,
      endIndex: headingRegex.lastIndex,
    });
  }

  // An unclosed "**title" at the end of the stream is not shown until it closes
  const trailingUnclosedRegex = /(?:^|\r?\n)[ \t]*\*\*[^*\r\n]*$/;
  const cleanedText = normalizedText.replace(trailingUnclosedRegex, "");

  const stages: ThinkingStage[] = [];

  // If there are no closed headings
  if (matches.length === 0) {
    const body = cleanedText.trim();
    if (body) {
      stages.push({
        title: "Thinking",
        body,
        done: !isThinking,
      });
    }
    return stages;
  }

  // Text before the first heading becomes a stage titled "Thinking"
  const textBefore = normalizedText.slice(0, matches[0].startIndex).trim();
  if (textBefore) {
    stages.push({
      title: "Thinking",
      body: textBefore,
      done: true,
    });
  }

  // Process each closed heading
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextStart = i < matches.length - 1 ? matches[i + 1].startIndex : cleanedText.length;
    const body = cleanedText.slice(cur.endIndex, nextStart).trim();

    stages.push({
      title: cur.title,
      body,
      done: i < matches.length - 1 ? true : !isThinking,
    });
  }

  return stages;
}
