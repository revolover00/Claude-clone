export interface DetectedArtifact {
  title: string;
  language: string;
  type: string;
  code: string;
  lineCount: number;
}

export function detectArtifact(
  content: string,
  userPrompt = ""
): DetectedArtifact | null {
  if (!content) return null;

  // Regex to match code blocks: ```lang ... ```
  const codeBlockRegex = /```(html|svg|jsx|tsx|markdown|xml|javascript|typescript|react)\s*([\s\S]*?)```/i;
  const match = content.match(codeBlockRegex);

  if (!match) return null;

  const rawLang = match[1].toLowerCase();
  const code = match[2].trim();
  const lines = code.split("\n");
  const lineCount = lines.length;

  const promptLower = userPrompt.toLowerCase();
  const hasCreationIntent =
    promptLower.includes("create") ||
    promptLower.includes("make") ||
    promptLower.includes("build") ||
    promptLower.includes("generate") ||
    promptLower.includes("component") ||
    promptLower.includes("html") ||
    promptLower.includes("svg") ||
    promptLower.includes("كود") ||
    promptLower.includes("انشئ") ||
    promptLower.includes("صمم") ||
    promptLower.includes("اعمل");

  // Must be >= 12 lines OR explicit creation intent with at least 5 lines
  if (lineCount < 12 && (!hasCreationIntent || lineCount < 5)) {
    return null;
  }

  // Determine type
  let type = "Code";
  let lang = rawLang;
  if (rawLang === "html" || rawLang === "xml") {
    type = "HTML";
    lang = "html";
  } else if (rawLang === "svg" || code.includes("<svg")) {
    type = "SVG";
    lang = "svg";
  } else if (rawLang === "jsx" || rawLang === "tsx" || rawLang === "react") {
    type = "React";
    lang = "tsx";
  } else if (rawLang === "markdown") {
    type = "Markdown";
    lang = "markdown";
  }

  // Extract or synthesize title
  let title = "";
  // Check for comment title: // Title: ... or <!-- Title: ... -->
  const titleCommentMatch = code.match(/(?:\/\/|<!--|\/\*)\s*(?:Title:|Artifact:)?\s*([^\n*>-]+)/i);
  if (titleCommentMatch && titleCommentMatch[1].trim().length > 3) {
    title = titleCommentMatch[1].trim();
  }

  if (!title) {
    // Look for first heading in markdown or component name in react
    if (type === "React") {
      const compMatch = code.match(/(?:function|const|class)\s+([A-Z][a-zA-Z0-9]+)/);
      if (compMatch) title = compMatch[1] + " Component";
    } else if (type === "HTML") {
      const titleTagMatch = code.match(/<title>([^<]+)<\/title>/i);
      if (titleTagMatch) title = titleTagMatch[1].trim();
      else title = "Interactive HTML Prototype";
    } else if (type === "SVG") {
      title = "Vector SVG Graphic";
    }
  }

  if (!title) {
    title = type === "SVG" ? "Vector Graphic" : `${type} Document`;
  }

  return {
    title,
    language: lang,
    type,
    code,
    lineCount,
  };
}
