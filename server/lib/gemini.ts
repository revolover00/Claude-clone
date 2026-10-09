import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

export const apiKey = process.env.GEMINI_API_KEY;

export const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Map Gemini errors to HTTP status codes & friendly messages
export function mapGeminiError(err: any, requestedModelId?: string): { status: number; error: string; technical: string; code?: string; details?: any } {
  const errMsg = err?.message || String(err) || "";
  const errStatus = err?.status || err?.statusCode || (typeof err?.code === "number" ? err.code : undefined);

  let status = 500;
  let friendly = "An unexpected error occurred while communicating with the AI model.";
  let code: string | undefined;
  let details: any;

  if (errStatus === 429 || /429|resource.*exhausted|rate.*limit/i.test(errMsg)) {
    status = 429;
    friendly = "Rate limit reached, try again in a minute";
  } else if (errStatus === 402 || /402|quota/i.test(errMsg)) {
    status = 402;
    friendly = "Model quota exceeded or API key invalid";
  } else if (errStatus === 403 || /403|api.?key.*invalid|permission_denied|unauthorized/i.test(errMsg)) {
    status = 403;
    friendly = "API key invalid or missing on the server";
  } else if (errStatus === 404) {
    status = 404;
    friendly = "Selected model is unavailable";
    code = "MODEL_NOT_FOUND";
    details = { requestedModelId };
  } else if (errStatus && errStatus >= 500 && errStatus < 600) {
    status = errStatus;
    friendly = "Upstream AI service temporarily unavailable";
  } else if (errStatus && errStatus >= 400 && errStatus < 500) {
    status = errStatus;
    friendly = errMsg || "Invalid request to AI service";
  }

  return {
    status,
    error: friendly,
    technical: errMsg,
    code,
    details,
  };
}

// Formats user/assistant messages, resolving images to base64 and txt/md/csv/json files to text
export function formatMessage(msg: any) {
  const parts: any[] = [];

  if (msg.content) {
    parts.push({ text: msg.content });
  }

  if (msg.attachments && msg.attachments.length > 0) {
    for (const att of msg.attachments) {
      if (att.isImage || (att.type && att.type.startsWith("image/"))) {
        try {
          const base64Data = att.url.split(",")[1];
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: att.type || "image/png",
            },
          });
        } catch (err) {
          console.error("Error parsing base64 image:", err);
        }
      } else {
        // Text files: send extracted text
        try {
          if (att.url && att.url.includes("base64,")) {
            const base64Data = att.url.split(",")[1];
            const textContent = Buffer.from(base64Data, "base64").toString("utf-8");
            parts.push({
              text: `\n[Attached File: ${att.name}]\n${textContent}\n`,
            });
          } else if (att.url) {
            parts.push({
              text: `\n[Attached File: ${att.name}]\n${att.url}\n`,
            });
          }
        } catch (err) {
          console.error("Error extracting text file:", err);
          parts.push({
            text: `\n[Attached File: ${att.name}]\n`,
          });
        }
      }
    }
  }

  // Ensure parts is never empty
  if (parts.length === 0) {
    parts.push({ text: "" });
  }

  return {
    role: msg.role === "assistant" ? "model" : "user",
    parts,
  };
}

export const APP_NAME = process.env.APP_NAME || "Claude Clone";

export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export function getBaseSystemPrompt(appName = process.env.APP_NAME || "Claude Clone", date = getTodayDateString()): string {
  return `You are ${appName}, an AI assistant. You are not made by Anthropic and you are not Claude; if asked which model you are, say you are ${appName}, powered by a Google Gemini model. Today's date is ${date}.

Character: warm, direct, curious and intellectually honest. Treat the user as a capable adult. Never open with praise or filler ("Great question", "Certainly!", "Of course"). Do not over-apologize or lecture. Disagree politely when you have good reason.

Language: reply in the language and dialect the user writes in (Egyptian, Saudi, Gulf, Levantine or Modern Standard Arabic; English; etc.) and keep that language unless asked to switch. Keep code, identifiers, API names and product names in English. For Arabic, write natural, idiomatic text, not literal translation.

Format: conversation is prose. Use short paragraphs, not headers or bullet lists, for ordinary answers, explanations and advice. Use lists only when the content is truly a list or the user asks; headers only for long documents; tables only to compare several items across several attributes; bold sparingly; emojis only if the user uses them. Put all code in fenced blocks with a language tag. Never use nested bullet hierarchies for simple answers.

Length: match the question. A simple question gets a short, direct answer first. Complex questions get a thorough but tight answer, with no restating the question and no closing recap. Ask at most one clarifying question, and only when you truly cannot proceed; otherwise state a brief assumption and answer.

Honesty: say when you are unsure or when information may be outdated. Never invent facts, quotes, citations, statistics or URLs. If you used web search, ground claims in the results. If the user is wrong, say so kindly and explain.

Safety: if you must decline, do it briefly and without moralizing, and offer a safe alternative when possible.

Memory: use remembered facts about the user only when they clearly improve the answer. Never say "according to my memory" or list what you remember; if the user asks you to ignore or forget something, comply.`;
}

export interface ThinkingConfigResult {
  includeThoughts: boolean;
  thinkingLevel?: string;
  thinkingBudget?: number;
}

export function buildThinkingConfig(modelId: string, effort?: string): ThinkingConfigResult {
  const isGemini3 = /gemini-3/i.test(modelId);

  if (isGemini3) {
    let thinkingLevel = "medium";
    if (effort === "Low") thinkingLevel = "low";
    else if (effort === "High") thinkingLevel = "high";
    return {
      includeThoughts: true,
      thinkingLevel,
    };
  }

  // Gemini 2.5 or other models supporting thinkingBudget
  let thinkingBudget = 4096;
  if (effort === "Low") thinkingBudget = 1024;
  else if (effort === "High") thinkingBudget = 16384;

  return {
    includeThoughts: true,
    thinkingBudget,
  };
}

export async function startGeminiStream(modelId: string, formattedMessages: any[], config: any) {
  if (!config?.thinkingConfig) {
    return await ai.models.generateContentStream({ model: modelId, contents: formattedMessages, config });
  }

  try {
    return await ai.models.generateContentStream({ model: modelId, contents: formattedMessages, config });
  } catch (err: any) {
    console.warn("Gemini API call failed with thinkingConfig, retrying once...", err?.message || err);
    const retryConfig = { ...config };
    if (retryConfig.thinkingConfig?.thinkingLevel || retryConfig.thinkingConfig?.thinkingBudget) {
      retryConfig.thinkingConfig = { includeThoughts: true };
      try {
        return await ai.models.generateContentStream({ model: modelId, contents: formattedMessages, config: retryConfig });
      } catch (err2: any) {
        console.warn("Retry with includeThoughts failed, falling back without thinkingConfig...", err2?.message || err2);
        delete retryConfig.thinkingConfig;
        return await ai.models.generateContentStream({ model: modelId, contents: formattedMessages, config: retryConfig });
      }
    } else {
      delete retryConfig.thinkingConfig;
      return await ai.models.generateContentStream({ model: modelId, contents: formattedMessages, config: retryConfig });
    }
  }
}

// Builds systemic prompting instructions adapted to response styles, profile settings, and project context
export function buildSystemInstruction(
  style: string,
  profileInstructions: string,
  projectInstructions?: string,
  projectKnowledge?: Array<{ title: string; content: string }>,
  language?: string
) {
  let styleInstruction = "";
  if (style === "Concise") {
    styleInstruction = "Provide extremely concise answers. Avoid fluff, keep paragraphs short, and get straight to the point.";
  } else if (style === "Explanatory") {
    styleInstruction = "Provide clear, detailed, educational explanations with step-by-step reasoning and deep-dive conceptual insights.";
  } else if (style === "Formal") {
    styleInstruction = "Maintain a highly professional, formal, polite, and authoritative tone.";
  }

  let knowledgeSection = "";
  if (projectKnowledge && projectKnowledge.length > 0) {
    knowledgeSection = `\n--- PROJECT KNOWLEDGE BASE ---\n` +
      projectKnowledge.map((k) => `[Document: ${k.title}]\n${k.content}`).join("\n\n") +
      `\n-------------------------------\n`;
  }

  const basePrompt = getBaseSystemPrompt();

  return `${basePrompt}

${styleInstruction ? `${styleInstruction}\n` : ""}${profileInstructions ? `Here are some user profile instructions to tailor your responses:\n${profileInstructions}\n` : ""}${projectInstructions ? `Here are the specific project instructions for this workspace:\n${projectInstructions}\n` : ""}${knowledgeSection}${language === "ar" ? "Reply primarily in Arabic." : ""}

When the user asks you to build, create, design, draw, or write a page, web application, UI component, SVG illustration, game, or document, or when you are modifying/editing an existing one, you MUST output the complete updated file in EXACTLY ONE fenced code block with the same title in the code's comment, header, or title tag. Do not output partial code, snippets, placeholders, or diffs. Always output the complete file so it is correctly recognized as a new version of the same artifact.
Supported fenced code block languages are:
- html (for complete HTML files with Tailwind CSS scripts embedded, etc.)
- svg (for raw SVG icons, drawings, and vector illustrations)
- jsx or tsx (for complete React / TypeScript components)
- markdown (for complete articles or formatted documents)

CRITICAL RULES for generating/updating artifacts/code blocks:
1. Output only ONE fenced code block. Never output multiple blocks.
2. The code block must be fully self-contained, complete, and ready to run. NEVER output placeholders or comment-out unmodified parts of the code. Always output the full updated content.
3. If modifying an existing artifact, you MUST output the complete updated file in ONE fenced block with the same title.
4. You MUST precede the fenced code block with EXACTLY ONE short, clear sentence describing what you built or introducing the code block. Do NOT write extensive explanations or preambles.
   Example: Here is the responsive interactive dashboard you requested:
   \`\`\`html
   ...
   \`\`\`
`;
}
