export interface DetectedArtifact {
  title: string;
  language: string;
  type: string;
  code: string;
  lineCount: number;
  rawLang: string;
}

export function extractArtifactTitle(code: string, type: string): string {
  // 1. First <title>...</title>
  const titleTagMatch = code.match(/<title>([^<]+)<\/title>/i);
  if (titleTagMatch && titleTagMatch[1].trim()) {
    return titleTagMatch[1].trim();
  }

  // 2. First <h1>...</h1> or # ...
  const h1TagMatch = code.match(/<h1>([^<]+)<\/h1>/i);
  if (h1TagMatch && h1TagMatch[1].trim()) {
    return h1TagMatch[1].trim();
  }
  const mdHeadingMatch = code.match(/^#\s+([^\n#]+)/m);
  if (mdHeadingMatch && mdHeadingMatch[1].trim()) {
    return mdHeadingMatch[1].trim();
  }

  // 3. First comment: // Title: ... or <!-- Title: ... --> or /* Title: ... */
  const commentMatch = code.match(
    /(?:\/\/|<!--|\/\*)\s*(?:Title:|Artifact:)?\s*([^\n*>-]+)/i
  );
  if (commentMatch && commentMatch[1].trim().length > 2) {
    const candidate = commentMatch[1].trim();
    if (
      !candidate.startsWith("http") &&
      !candidate.startsWith("@ts-") &&
      !candidate.startsWith("eslint")
    ) {
      return candidate;
    }
  }

  // 4. Default export / component name for React
  if (type === "React") {
    const compMatch = code.match(
      /(?:function|const|class)\s+([A-Z][a-zA-Z0-9]+)/
    );
    if (compMatch) return compMatch[1] + " Component";
  }

  return "Untitled";
}

export function getArtifactType(lang: string, code: string): string {
  const clean = lang.trim().toLowerCase();
  if (clean === "svg" || code.includes("<svg")) return "SVG";
  if (clean === "html" || clean === "xml") return "HTML";
  if (clean === "jsx" || clean === "tsx" || clean === "react") return "React";
  if (clean === "markdown" || clean === "md") return "Markdown";
  return "Code";
}

export function isArtifactCandidate(
  lang: string,
  code: string,
  userPrompt = ""
): boolean {
  const cleanLang = lang.trim().toLowerCase();
  const validLangs = [
    "html",
    "svg",
    "jsx",
    "tsx",
    "markdown",
    "md",
    "xml",
    "react",
  ];
  if (!validLangs.includes(cleanLang)) return false;

  const lineCount = code.split("\n").length;
  if (lineCount > 15) return true;

  const promptLower = userPrompt.toLowerCase();
  const hasCreationKeyword =
    promptLower.includes("create") ||
    promptLower.includes("make") ||
    promptLower.includes("build") ||
    promptLower.includes("اعمل") ||
    promptLower.includes("ابني") ||
    promptLower.includes("صمم");

  if (hasCreationKeyword && lineCount >= 3) {
    return true;
  }

  return false;
}

export function detectArtifact(
  content: string,
  userPrompt = ""
): DetectedArtifact | null {
  if (!content) return null;

  // Regex to match code blocks: ```lang ... ```
  const codeBlockRegex =
    /```(html|svg|jsx|tsx|markdown|md|xml|react)\s*([\s\S]*?)(?:```|$)/i;
  const match = content.match(codeBlockRegex);

  if (!match) return null;

  const rawLang = match[1].toLowerCase();
  const code = match[2].trim();

  if (!isArtifactCandidate(rawLang, code, userPrompt)) {
    return null;
  }

  const type = getArtifactType(rawLang, code);
  const title = extractArtifactTitle(code, type);
  const lineCount = code.split("\n").length;

  let normLang = rawLang;
  if (normLang === "react") normLang = "tsx";
  if (normLang === "md") normLang = "markdown";

  return {
    title,
    language: normLang,
    type,
    code,
    lineCount,
    rawLang,
  };
}
