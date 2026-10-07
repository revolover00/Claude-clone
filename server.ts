import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini SDK securely on the server
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Formats user/assistant messages, resolving images to base64 and txt/md/csv/json files to text
function formatMessage(msg: any) {
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
function buildSystemInstruction(
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

When the user asks you to build, create, design, draw, or write a page, web application, UI component, SVG illustration, game, or document, you MUST output EXACTLY ONE fenced code block containing the complete, self-contained, and working implementation.
Supported fenced code block languages are:
- html (for complete HTML files with Tailwind CSS scripts embedded, etc.)
- svg (for raw SVG icons, drawings, and vector illustrations)
- jsx or tsx (for complete React / TypeScript components)
- markdown (for complete articles or formatted documents)

CRITICAL RULES for generating artifacts/code blocks:
1. Output only ONE fenced code block. Never output multiple blocks.
2. The code block must be fully self-contained and ready to run.
3. You MUST precede the fenced code block with EXACTLY ONE short, clear sentence describing what you built or introducing the code block. Do NOT write extensive explanations or preambles.
   Example: Here is the responsive interactive dashboard you requested:
   \`\`\`html
   ...
   \`\`\`
`;
}

// Chat stream SSE endpoint
app.post("/api/chat", async (req, res) => {
  const {
    messages,
    style,
    profileInstructions,
    projectInstructions,
    projectKnowledge,
    model,
    effort,
    webSearch,
    extendedThinking,
    language,
  } = req.body;

  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY environment variable is not configured." });
    return;
  }

  // Set SSE response headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // Map model selectors to valid Gemini models
    let modelId = "gemini-3.8-flash"; // Default
    if (model === "opus-5") {
      modelId = "gemini-3.1-pro-preview";
    } else if (model === "haiku-4-5") {
      modelId = "gemini-3.1-flash-lite";
    }

    // Format all messages to the standard SDK format
    const formattedMessages = messages.map(formatMessage);

    // Build model configuration
    const config: any = {
      systemInstruction: buildSystemInstruction(
        style,
        profileInstructions,
        projectInstructions,
        projectKnowledge,
        language
      ),
    };

    // Configure search grounding tool
    if (webSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    // Configure extended thinking for models that support it
    const supportsThinking = modelId === "gemini-3.8-flash" || modelId === "gemini-3.1-pro-preview";
    if (extendedThinking && supportsThinking) {
      let thinkingBudget = 4096; // Medium default
      if (effort === "Low") {
        thinkingBudget = 1024;
      } else if (effort === "High") {
        thinkingBudget = 16384;
      }
      config.thinkingConfig = {
        thinkingBudget,
      };
    }

    // Start Gemini streaming call
    const stream = await ai.models.generateContentStream({
      model: modelId,
      contents: formattedMessages,
      config,
    });

    for await (const chunk of stream) {
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.thought) {
          // Streaming thoughts/reasoning
          res.write(`data: ${JSON.stringify({ thinking: part.text })}\n\n`);
        } else if (part.text) {
          // Streaming response content
          res.write(`data: ${JSON.stringify({ token: part.text })}\n\n`);
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("Gemini API stream error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message || "An error occurred while streaming response." })}\n\n`);
    res.end();
  }
});

// Auto-title generator endpoint (fast, cheap call)
app.post("/api/title", async (req, res) => {
  const { firstUserMsg, firstReply } = req.body;

  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
    return;
  }

  try {
    const prompt = `Generate a 3-6 word title for a chat conversation based on the user's first message: "${firstUserMsg}" and the assistant's reply: "${firstReply}". The title MUST be in the same language as the chat conversation. Return ONLY the plain title text, with no quotation marks, no markdown, and no preamble.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite", // Extremely cheap & fast model for titles
      contents: prompt,
    });

    const title = response.text?.trim().replace(/['"“”]/g, "") || "New conversation";
    res.json({ title });
  } catch (err) {
    console.error("Auto-title generation error:", err);
    res.status(500).json({ error: "Failed to generate title" });
  }
});

// Serve frontend with Vite middlewares in dev or static files in production
const isProd = process.env.NODE_ENV === "production";
if (!isProd) {
  const vite = await createViteServer({
    server: { middlewareMode: true, host: "0.0.0.0", port: 3000 },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running at http://0.0.0.0:${port}`);
});
