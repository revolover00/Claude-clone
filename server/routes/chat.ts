import { Router } from "express";
import { ai, apiKey, mapGeminiError, formatMessage, buildSystemInstruction } from "../lib/gemini";
import { getModelsFromDB } from "./models";
import { generateEmbedding, cosineSimilarity } from "../lib/memoryHelpers";
import { createClient } from "@supabase/supabase-js";

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
  if (!messages || !Array.isArray(messages) || messages.length > 100) {
    res.status(400).json({ error: "Invalid request: messages error.", code: 400 });
    return;
  }
  for (const m of messages) {
    if (typeof m?.content === "string" && m.content.length > 100000) {
      res.status(400).json({ error: "Message too long.", code: 400 });
      return;
    }
  }

  // Validate total attachment size <= 20MB
  let totalAttachmentBytes = 0;
  for (const m of messages) {
    if (Array.isArray(m?.attachments)) {
      for (const a of m.attachments) {
        totalAttachmentBytes += typeof a?.size === "number" ? a.size : (typeof a?.url === "string" ? Math.round(a.url.length * 0.75) : 0);
      }
    }
  }
  if (totalAttachmentBytes > 20 * 1024 * 1024) {
    res.status(400).json({ error: "Attachments exceed 20MB limit.", code: 400 });
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
    // Resolve model from DB/mock
    const enabledModels = await getModelsFromDB(false);
    let resolvedModel = enabledModels.find(m => m.slug === model || m.id === model);
    if (!resolvedModel) {
      resolvedModel = enabledModels.find(m => m.is_default) || enabledModels[0];
    }

    if (!resolvedModel) {
      res.status(500).json({ error: "No enabled models available on the server." });
      return;
    }

    const modelId = resolvedModel.api_model_id;

    // Format all messages to the standard SDK format
    let formattedMessages = messages.map(formatMessage);
    if (!resolvedModel.supports_vision) {
      // Strip out inlineData image parts for non-vision models
      formattedMessages = formattedMessages.map(msg => ({
        ...msg,
        parts: msg.parts.filter((p: any) => !p.inlineData)
      }));
    }

    // Setup Supabase variables for memory fetching
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const isRealSupabaseConfigured = Boolean(
      supabaseUrl && 
      supabaseServiceKey && 
      !supabaseUrl.includes("YOUR_") && 
      !supabaseServiceKey.includes("YOUR_")
    );
    const supabaseServer = isRealSupabaseConfigured ? createClient(supabaseUrl, supabaseServiceKey) : null;

    let memoryPromptSection = "";
    try {
      let memoryEnabled = true;
      const uId = (req as any).user?.id;
      if (uId) {
        if (isRealSupabaseConfigured && supabaseServer) {
          const { data } = await supabaseServer.from("user_preferences").select("*").eq("user_id", uId).single();
          if (data && data.memory_enabled === false) memoryEnabled = false;
        }

        if (memoryEnabled) {
          let activeMemories: any[] = [];
          if (isRealSupabaseConfigured && supabaseServer) {
            const { data } = await supabaseServer.from("memories").select("*").eq("user_id", uId).eq("status", "active");
            if (data) activeMemories = data;
          } else {
            try {
              const saved = localStorage.getItem("claude_clone_mock_memories");
              const parsed = saved ? JSON.parse(saved) : [];
              activeMemories = parsed.filter((m: any) => m.status === "active" && m.user_id === uId);
            } catch {}
          }

          if (activeMemories.length > 0) {
            const latestUserMsg = messages[messages.length - 1]?.content || "";
            const promptEmbedding = await generateEmbedding(latestUserMsg);

            const pinnedMemories = activeMemories.filter(m => m.pinned);
            const unpinnedMemories = activeMemories.filter(m => !m.pinned);

            const scored = unpinnedMemories.map(m => {
              let sim = 0;
              if (m.embedding && Array.isArray(m.embedding)) {
                sim = cosineSimilarity(promptEmbedding, m.embedding);
              }
              return { ...m, sim };
            });
            scored.sort((a, b) => b.sim - a.sim);
            const top8Unpinned = scored.slice(0, 8);

            const projectId = req.body.projectId || null;
            let projectMemories: any[] = [];
            if (projectId) {
              projectMemories = activeMemories.filter(m => m.project_id === projectId);
            }

            const combinedList = [...pinnedMemories, ...top8Unpinned, ...projectMemories];
            const uniqueRetrieved = Array.from(new Map(combinedList.map(m => [m.id, m])).values());

            if (uniqueRetrieved.length > 0) {
              memoryPromptSection = `\n--- USER MEMORIES BASE ---\n` +
                `You recall the following facts about the user across chats:\n` +
                uniqueRetrieved.map(m => `- [Category: ${m.category}] ${m.content}`).join("\n") +
                `\nCRITICAL USE INSTRUCTIONS:\n` +
                `- Adapt and reference these facts only when they make your answer more helpful and personalized.\n` +
                `- NEVER state "I remember" or list these facts explicitly in conversation.\n` +
                `- If the user tells you to ignore or contradict this context, prioritize their direct prompt instructions.\n` +
                `---------------------------\n`;
            }
          }
        }
      }
    } catch (memErr) {
      console.warn("Memory retrieval failed, skipping:", memErr);
    }

    // Build model configuration
    const config: any = {
      systemInstruction: buildSystemInstruction(
        style,
        profileInstructions,
        projectInstructions,
        projectKnowledge,
        language
      ) + memoryPromptSection,
      abortSignal: abortCtrl.signal,
    };

    // Configure search grounding tool
    if (webSearch && resolvedModel.supports_search) {
      config.tools = [{ googleSearch: {} }];
    }

    // Configure extended thinking for models that support it
    const supportsThinking = resolvedModel.supports_thinking;
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
