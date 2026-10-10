import { buildThinkingConfigFromLevel, type ThinkingLevel } from "./thinkingRouter";

export const THREE_BOXES_PUZZLE =
  "There are three boxes: one contains only apples, one contains only oranges, and one contains both apples and oranges. Every box is mislabeled. You can pick one fruit from one box without looking inside. Which box do you pick from, and how do you deduce the correct labels for all three boxes? Walk through your reasoning step by step.";

export type ThinkingVerdict =
  | "Returns thought summaries"
  | "Thinks but returns no summary"
  | "Does not think"
  | "Rejected the config";

export interface LevelDiagnosticResult {
  level: ThinkingLevel;
  accepted: boolean;
  error: string | null;
  timeToFirstThoughtMs: number | null;
  thoughtParts: number;
  thoughtChars: number;
  thoughtsTokenCount: number;
  totalMs: number;
  fallbackApplied: boolean;
  firstThoughtPreview: string;
}

export function computeThinkingVerdict(results: LevelDiagnosticResult[]): ThinkingVerdict {
  if (results.length === 0) return "Rejected the config";

  // If all levels completely failed or had fallback applied with no thoughts
  const allRejected = results.every(
    (r) => (!r.accepted || r.fallbackApplied) && r.thoughtParts === 0 && r.thoughtsTokenCount === 0
  );
  if (allRejected) {
    return "Rejected the config";
  }

  // Model actually outputs thought text chunks
  const hasThoughtSummaries = results.some(
    (r) => r.thoughtParts > 0 || r.thoughtChars > 0 || r.firstThoughtPreview.trim().length > 0
  );
  if (hasThoughtSummaries) {
    return "Returns thought summaries";
  }

  // Model used internal thinking tokens but returned no thought summaries
  const hasInternalThinking = results.some((r) => r.thoughtsTokenCount > 0);
  if (hasInternalThinking) {
    return "Thinks but returns no summary";
  }

  // Model accepted config but generated 0 thinking tokens and 0 thoughts
  return "Does not think";
}

export async function runSingleLevelDiagnostic(
  aiClient: any,
  apiModelId: string,
  level: ThinkingLevel
): Promise<LevelDiagnosticResult> {
  const config: any = {
    thinkingConfig: buildThinkingConfigFromLevel(apiModelId, level),
    maxOutputTokens: 256,
  };

  const start = Date.now();
  let timeToFirstThoughtMs: number | null = null;
  let thoughtParts = 0;
  let thoughtChars = 0;
  let thoughtsTokenCount = 0;
  let firstThoughtPreview = "";
  let accepted = true;
  let fallbackApplied = false;
  let error: string | null = null;

  try {
    const stream = await aiClient.models.generateContentStream({
      model: apiModelId,
      contents: [{ role: "user", parts: [{ text: THREE_BOXES_PUZZLE }] }],
      config,
    });

    for await (const chunk of stream) {
      const candidate = chunk?.candidates?.[0];
      const tokenCount =
        chunk?.usageMetadata?.thoughtsTokenCount ?? candidate?.usageMetadata?.thoughtsTokenCount;
      if (typeof tokenCount === "number") {
        thoughtsTokenCount = tokenCount;
      }

      const parts = candidate?.content?.parts || [];
      for (const part of parts) {
        if (part?.thought) {
          if (timeToFirstThoughtMs === null) {
            timeToFirstThoughtMs = Date.now() - start;
          }
          thoughtParts++;
          const txt = part.text || "";
          thoughtChars += txt.length;
          if (firstThoughtPreview.length < 200) {
            firstThoughtPreview = (firstThoughtPreview + txt).slice(0, 200);
          }
        }
      }
    }
  } catch (err: any) {
    accepted = false;
    error = err?.message || String(err);

    // Try fallback once to check if API specifically rejected thinkingConfig
    try {
      const fallbackConfig = { ...config };
      delete fallbackConfig.thinkingConfig;
      await aiClient.models.generateContentStream({
        model: apiModelId,
        contents: [{ role: "user", parts: [{ text: THREE_BOXES_PUZZLE }] }],
        config: fallbackConfig,
      });
      fallbackApplied = true;
    } catch {
      // API call failed completely
    }
  }

  return {
    level,
    accepted,
    error,
    timeToFirstThoughtMs,
    thoughtParts,
    thoughtChars,
    thoughtsTokenCount,
    totalMs: Date.now() - start,
    fallbackApplied,
    firstThoughtPreview: firstThoughtPreview.trim(),
  };
}

export async function runThinkingDiagnostic(
  aiClient: any,
  apiModelId: string
): Promise<{
  levels: Record<ThinkingLevel, LevelDiagnosticResult>;
  verdict: ThinkingVerdict;
}> {
  const levels: ThinkingLevel[] = ["low", "medium", "high"];
  const results: LevelDiagnosticResult[] = [];

  for (const lvl of levels) {
    const res = await runSingleLevelDiagnostic(aiClient, apiModelId, lvl);
    results.push(res);
  }

  const verdict = computeThinkingVerdict(results);

  return {
    levels: {
      low: results[0],
      medium: results[1],
      high: results[2],
    },
    verdict,
  };
}
