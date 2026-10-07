import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
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

// Restrict cors to ALLOWED_ORIGIN env var (default same-origin only)
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : { origin: false }));

// Body parser with 25mb limit
app.use(express.json({ limit: "25mb" }));

// Rate limiter for AI endpoints: 20 req/min per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Rate limit reached, try again in a minute", code: 429 });
  },
});

app.use("/api/chat", apiLimiter);
app.use("/api/title", apiLimiter);

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(apiKey),
    models: ["gemini-3.8-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite"],
  });
});

// Map Gemini errors to HTTP status codes & friendly messages
function mapGeminiError(err: any): { status: number; message: string; technical: string } {
  const errMsg = err?.message || String(err) || "";
  const errStatus = err?.status || err?.statusCode || (typeof err?.code === "number" ? err.code : undefined);

  let status = 500;
  let friendly = "An unexpected error occurred while communicating with the AI model.";

  if (errStatus === 429 || /429|resource.*exhausted|rate.*limit/i.test(errMsg)) {
    status = 429;
    friendly = "Rate limit reached, try again in a minute";
  } else if (errStatus === 402 || /402|quota/i.test(errMsg)) {
    status = 402;
    friendly = "Model quota exceeded or API key invalid";
  } else if (errStatus === 403 || /403|api.?key.*invalid|permission_denied|unauthorized/i.test(errMsg)) {
    status = 403;
    friendly = "API key invalid or missing on the server";
  } else if (errStatus === 404 || /404|not.*found|model.*not.*found/i.test(errMsg)) {
    status = 404;
    friendly = "Selected model is unavailable";
  } else if (errStatus && errStatus >= 500 && errStatus < 600) {
    status = errStatus;
    friendly = "Upstream AI service temporarily unavailable";
  } else if (errStatus && errStatus >= 400 && errStatus < 500) {
    status = errStatus;
    friendly = errMsg || "Invalid request to AI service";
  }

  return {
    status,
    message: friendly,
    technical: errMsg,
  };
}

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

  // Validate request body
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Invalid request: messages must be an array.", code: 400 });
    return;
  }

  if (messages.length > 100) {
    res.status(400).json({ error: "Invalid request: messages array exceeds maximum of 100 messages.", code: 400 });
    return;
  }

  for (const msg of messages) {
    if (typeof msg?.content === "string" && msg.content.length > 100000) {
      res.status(400).json({
        error: "Invalid request: individual message content cannot exceed 100,000 characters.",
        code: 400,
      });
      return;
    }
  }

  // Validate total attachment size <= 20MB
  let totalAttachmentBytes = 0;
  for (const msg of messages) {
    if (Array.isArray(msg?.attachments)) {
      for (const att of msg.attachments) {
        if (typeof att?.size === "number") {
          totalAttachmentBytes += att.size;
        } else if (typeof att?.url === "string") {
          totalAttachmentBytes += Math.round(att.url.length * 0.75);
        }
      }
    }
  }

  if (totalAttachmentBytes > 20 * 1024 * 1024) {
    res.status(400).json({
      error: "Invalid request: total attachment size exceeds 20MB limit.",
      code: 400,
    });
    return;
  }

  if (!apiKey) {
    res.status(403).json({ error: "API key invalid or missing on the server", code: 403 });
    return;
  }

  // Setup abort controller on client disconnect to abort stream
  const abortCtrl = new AbortController();
  req.on("close", () => {
    abortCtrl.abort();
  });

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
      abortSignal: abortCtrl.signal,
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

    // Initiate Gemini streaming call before opening SSE headers
    let stream;
    try {
      stream = await ai.models.generateContentStream({
        model: modelId,
        contents: formattedMessages,
        config,
      });
    } catch (err: any) {
      const errInfo = mapGeminiError(err);
      res.status(errInfo.status).json({
        error: errInfo.message,
        details: errInfo.technical,
        code: errInfo.status,
      });
      return;
    }

    // Set SSE response headers now that connection is established
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const collectedSources: Array<{ title: string; url: string }> = [];
    const seenUrls = new Set<string>();

    for await (const chunk of stream) {
      if (abortCtrl.signal.aborted) {
        break;
      }

      // Extract search grounding sources from Gemini metadata
      const candidate = chunk.candidates?.[0];
      const groundingMeta = (candidate as any)?.groundingMetadata;
      if (groundingMeta?.groundingChunks && Array.isArray(groundingMeta.groundingChunks)) {
        let newSourceAdded = false;
        for (const gc of groundingMeta.groundingChunks) {
          const web = gc?.web;
          if (web?.uri && !seenUrls.has(web.uri)) {
            seenUrls.add(web.uri);
            let title = web.title?.trim();
            if (!title) {
              try {
                title = new URL(web.uri).hostname.replace(/^www\./, "");
              } catch {
                title = "Source";
              }
            }
            collectedSources.push({ title, url: web.uri });
            newSourceAdded = true;
          }
        }
        if (newSourceAdded) {
          res.write(`data: ${JSON.stringify({ sources: collectedSources })}\n\n`);
        }
      }

      const parts = candidate?.content?.parts || [];
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

    if (!abortCtrl.signal.aborted) {
      res.write("data: [DONE]\n\n");
    }
    res.end();
  } catch (err: any) {
    if (abortCtrl.signal.aborted) {
      res.end();
      return;
    }
    console.error("Gemini API stream error:", err);
    const errInfo = mapGeminiError(err);
    if (!res.headersSent) {
      res.status(errInfo.status).json({
        error: errInfo.message,
        details: errInfo.technical,
        code: errInfo.status,
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: errInfo.message, details: errInfo.technical, code: errInfo.status })}\n\n`);
      res.end();
    }
  }
});

// Auto-title generator endpoint (fast, cheap call)
app.post("/api/title", async (req, res) => {
  const { firstUserMsg, firstReply } = req.body;

  if (!apiKey) {
    res.status(403).json({ error: "API key invalid or missing on the server", code: 403 });
    return;
  }

  // Escape & limit to 500 chars each
  let safeUserMsg = typeof firstUserMsg === "string" ? firstUserMsg.slice(0, 500) : "";
  let safeReply = typeof firstReply === "string" ? firstReply.slice(0, 500) : "";
  safeUserMsg = safeUserMsg.replace(/[\\"\n\r]/g, " ").trim();
  safeReply = safeReply.replace(/[\\"\n\r]/g, " ").trim();

  try {
    const prompt = `Generate a 3-6 word title for a chat conversation based on the user's first message: "${safeUserMsg}" and the assistant's reply: "${safeReply}". The title MUST be in the same language as the chat conversation. Return ONLY the plain title text, with no quotation marks, no markdown, and no preamble.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite", // Extremely cheap & fast model for titles
      contents: prompt,
    });

    const title = response.text?.trim().replace(/['"“”]/g, "") || "New conversation";
    res.json({ title });
  } catch (err: any) {
    console.error("Auto-title generation error:", err);
    const errInfo = mapGeminiError(err);
    res.status(errInfo.status).json({ error: errInfo.message, details: errInfo.technical, code: errInfo.status });
  }
});

// Serve frontend with Vite middlewares in dev or static files in production
const isProd = process.env.NODE_ENV === "production";
if (!isProd) {
  // Dynamic import so vite is not loaded in production
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, host: "0.0.0.0", port: 3000 },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running at http://0.0.0.0:${port}`);
});
