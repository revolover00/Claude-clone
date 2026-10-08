import { Router } from "express";
import { ai, apiKey, mapGeminiError, formatMessage, buildSystemInstruction } from "../lib/gemini";

const router = Router();

router.post("/", async (req, res) => {
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

      // Extract and forward finishReason if present
      const finishReason = candidate?.finishReason;
      if (finishReason) {
        res.write(`data: ${JSON.stringify({ finish: finishReason })}\n\n`);
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

export default router;
