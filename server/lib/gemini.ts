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

// Builds systemic prompting instructions adapted to response styles, profile settings, and project context
export function buildSystemInstruction(
  style: string,
  profileInstructions: string,
  projectInstructions?: string,
  projectKnowledge?: Array<{ title: string; content: string }>,
  language?: string
) {
  let styleInstruction: string;
  if (style === "Concise") {
    styleInstruction = "Provide extremely concise answers. Avoid fluff, keep paragraphs short, and get straight to the point.";
  } else if (style === "Explanatory") {
    styleInstruction = "Provide clear, detailed, educational explanations with step-by-step reasoning and deep-dive conceptual insights.";
  } else if (style === "Formal") {
    styleInstruction = "Maintain a highly professional, formal, polite, and authoritative tone.";
  } else {
    styleInstruction = "Maintain a natural, helpful, balanced, and conversational tone (similar to Claude).";
  }

  let knowledgeSection = "";
  if (projectKnowledge && projectKnowledge.length > 0) {
    knowledgeSection = `\n--- PROJECT KNOWLEDGE BASE ---\n` +
      projectKnowledge
        .map((k) => `[Document: ${k.title}]\n${k.content}`)
        .join("\n\n") +
      `\n-------------------------------\n`;
  }

  return `You are a helpful, professional AI assistant (similar to Claude) with a reasoning capability.
${styleInstruction}

${profileInstructions ? `Here are some user profile instructions to tailor your responses:\n${profileInstructions}\n` : ""}
${projectInstructions ? `Here are the specific project instructions for this workspace:\n${projectInstructions}\n` : ""}
${knowledgeSection}
${language === "ar" ? "Reply primarily in Arabic." : "Reply in the user's language (e.g., Arabic if they ask in Arabic, English if in English, etc.)."}

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
