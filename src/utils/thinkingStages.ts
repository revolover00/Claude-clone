export interface ThinkingStage {
  title: string;
  body: string;
  done: boolean;
  type?: 'thinking' | 'tool';
  toolStatus?: 'searching' | 'completed';
  resultCount?: number;
}

export function parseThinkingStages(accumulatedText: string): ThinkingStage[] {
  if (!accumulatedText.trim()) return [];

  const stageRegex = /\*\*([^\*]+)\*\*/g;
  const stages: ThinkingStage[] = [];
  let lastIndex = 0;
  let match;

  // Find all headings
  const matches: { title: string; index: number }[] = [];
  while ((match = stageRegex.exec(accumulatedText)) !== null) {
    matches.push({ title: match[1].trim(), index: match.index });
  }

  // Text before first heading is the "Thinking" stage
  let startIndex = 0;
  if (matches.length === 0) {
    stages.push({ title: "Thinking", body: accumulatedText.trim(), done: false });
    return stages;
  }

  // Handle first stage
  if (matches[0].index > 0) {
    stages.push({
      title: "Thinking",
      body: accumulatedText.slice(0, matches[0].index).trim(),
      done: true,
    });
  }

  // Process all matched stages
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].title.length + 4; // ** + title + **
    const end = i < matches.length - 1 ? matches[i + 1].index : accumulatedText.length;
    
    stages.push({
      title: matches[i].title,
      body: accumulatedText.slice(start, end).trim(),
      done: i < matches.length - 1,
    });
  }

  return stages;
}
