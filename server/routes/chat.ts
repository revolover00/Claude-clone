import { Router } from "express";
import { mapGeminiError, formatMessage, buildSystemInstruction, startGeminiStream } from "../lib/gemini";
import { getAvailableSkillsSummary } from "../lib/skills/db";
import { executeSkillFunctionCall, runSkillToolStream, type SkillExecutionState } from "../lib/skills/toolLoop";
import { getThinkingPlanAndConfig } from "../lib/thinkingRouter";
import { getModelsFromDB } from "./models";
import { normalizeSlug } from "../../src/hooks/useModels";
import { retrieveUserMemoryPrompt } from "../lib/chatMemory";
import { createClient } from "@supabase/supabase-js";
import { validateChatMessages, extractGroundingSources, DEFAULT_CHAT_TOOLS } from "../lib/chatStreamHelpers";

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

  const validation = validateChatMessages(messages);
  if (validation.error) {
    res.status(validation.status || 400).json({ error: validation.error, code: validation.status || 400 });
    return;
  }

  const abortCtrl = new AbortController();
  req.on("close", () => abortCtrl.abort());

  let modelId = "";
  try {
    // Resolve model from DB/mock, supporting both legacy and new slugs
    const requestedSlug = model ? normalizeSlug(model) : model;
    const enabledModels = await getModelsFromDB(false);
    let resolvedModel = enabledModels.find(m => {
      const normSlug = normalizeSlug(m.slug);
      return normSlug === requestedSlug || m.slug === model || m.id === model;
    });
    if (!resolvedModel) {
      resolvedModel = enabledModels.find(m => m.is_default) || enabledModels[0];
    }

    if (!resolvedModel) {
      res.status(500).json({ error: "No enabled models available on the server." });
      return;
    }
    modelId = resolvedModel.api_model_id;
    let formattedMessages = messages.map(formatMessage);
    if (!resolvedModel.supports_vision) {
      formattedMessages = formattedMessages.map(msg => ({
        ...msg,
        parts: msg.parts.filter((p: any) => !p.inlineData)
      }));
    }
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const isRealSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey && !supabaseUrl.includes("YOUR_") && !supabaseServiceKey.includes("YOUR_"));
    const supabaseServer = isRealSupabaseConfigured ? createClient(supabaseUrl, supabaseServiceKey) : null;

    const memoryPromptSection = await retrieveUserMemoryPrompt(
      (req as any).user?.id,
      messages,
      req.body.projectId,
      supabaseServer,
      isRealSupabaseConfigured
    );

    const availableSkills = await getAvailableSkillsSummary((req as any).user?.id);
    let skillsPromptSection = "";
    if (availableSkills.length > 0) {
      skillsPromptSection = `\n\n## Available skills\n` +
        availableSkills.map((s) => `- ${s.name}: ${s.description}`).join("\n") +
        `\n\nWhen a user request matches an available skill, call load_skill({ name }) to retrieve its complete instructions before responding. To read referenced files within the skill, call read_skill_file({ skill, path }).`;
    }
    if (req.body.forcedSkill) {
      skillsPromptSection += `\n\nCRITICAL: The user has explicitly selected the skill "${req.body.forcedSkill}". You MUST call load_skill({ name: "${req.body.forcedSkill}" }) immediately.`;
    }

    // Build model configuration
    const config: any = {
      systemInstruction: buildSystemInstruction(
        style,
        profileInstructions,
        projectInstructions,
        projectKnowledge,
        language,
        resolvedModel.display_name
      ) + memoryPromptSection + skillsPromptSection,
      abortSignal: abortCtrl.signal,
      tools: DEFAULT_CHAT_TOOLS
    };

    // Handle Google search conflict with tools
    let searchGroundingDisabledNotice = false;
    if (webSearch && resolvedModel.supports_search) {
      searchGroundingDisabledNotice = true;
    }

    // Configure thinking for models that support it
    const supportsThinking = Boolean(resolvedModel.supports_thinking);
    let thinkingDecision: any = null;
    if (supportsThinking) {
      const latestUserMsg = messages[messages.length - 1];
      thinkingDecision = getThinkingPlanAndConfig(modelId, latestUserMsg, {
        extendedThinking: Boolean(extendedThinking),
        effort,
      });
      config.thinkingConfig = thinkingDecision.config;
    }

    // Initiate Gemini streaming call before opening SSE headers
    let stream: any;
    let fallbackApplied = false;
    try {
      const streamRes = await startGeminiStream(modelId, formattedMessages, config);
      stream = streamRes.stream;
      fallbackApplied = streamRes.fallbackApplied;
    } catch (err: any) {
      const errInfo = mapGeminiError(err, modelId);
      res.status(errInfo.status).json({
        error: errInfo.error,
        details: errInfo.details || errInfo.technical,
        code: errInfo.code || errInfo.status,
      });
      return;
    }

    // Set SSE response headers now that connection is established
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // First SSE event: send thinkingPlan if model supports thinking
    if (thinkingDecision) {
      res.write(`data: ${JSON.stringify({ thinkingPlan: thinkingDecision.plan })}\n\n`);
    }

    if (extendedThinking && !supportsThinking) {
      res.write(`data: ${JSON.stringify({ warning: "This model doesn't support extended thinking" })}\n\n`);
    }

    if (fallbackApplied) {
      res.write(`data: ${JSON.stringify({ warning: "Reasoning was disabled for this request because the model rejected the thinking settings" })}\n\n`);
    }

    if (searchGroundingDisabledNotice) {
      res.write(`data: ${JSON.stringify({ warning: "Web search grounding was disabled for this request to prioritize skill tool calling" })}\n\n`);
    }

    const skillExecutionState: SkillExecutionState = { skillLoadsCount: 0, totalBytesLoaded: 0 };
    const collectedSources: Array<{ title: string; url: string }> = [];
    const seenUrls = new Set<string>();
    let thoughtParts = 0;
    let answerParts = 0;

    for await (const chunk of stream) {
      if (abortCtrl.signal.aborted) break;

      const candidate = chunk.candidates?.[0];

      // Check for tool calls
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if ((part as any).functionCall) {
            const call = (part as any).functionCall;
            const skillTarget = call.args?.name || call.args?.skill;
            res.write(`data: ${JSON.stringify({ tool: { name: call.name, skill: skillTarget, status: "executing" } })}\n\n`);

            const execRes = await executeSkillFunctionCall(
              (req as any).user?.id,
              call,
              skillExecutionState
            );

            if (execRes.document) {
              res.write(`data: ${JSON.stringify({ document: execRes.document })}\n\n`);
            }
            if (execRes.documentError) {
              res.write(`data: ${JSON.stringify({ documentError: execRes.documentError })}\n\n`);
            }

            const toolStatus = execRes.documentError ? "error" : "completed";
            res.write(`data: ${JSON.stringify({ tool: { name: call.name, skill: execRes.skillName || skillTarget, status: toolStatus } })}\n\n`);

            try {
              const contStream = await runSkillToolStream(modelId, formattedMessages, config, call, execRes.result);
              for await (const contChunk of contStream) {
                if (abortCtrl.signal.aborted) break;
                const contCandidate = contChunk.candidates?.[0];
                const contParts = contCandidate?.content?.parts || [];
                for (const cp of contParts) {
                  if ((cp as any).thought) {
                    thoughtParts++;
                    res.write(`data: ${JSON.stringify({ thinking: cp.text || "" })}\n\n`);
                  } else if (cp.text) {
                    answerParts++;
                    res.write(`data: ${JSON.stringify({ token: cp.text })}\n\n`);
                  }
                }
              }
            } catch (contErr) {
              console.error("Continuation stream error:", contErr);
            }
            continue;
          }
        }
      }

      // Extract search grounding sources from Gemini metadata
      if (extractGroundingSources(candidate, seenUrls, collectedSources)) {
        res.write(`data: ${JSON.stringify({ sources: collectedSources })}\n\n`);
      }

      // Forward usageMetadata.thoughtsTokenCount when present
      const thoughtsTokenCount = (chunk as any)?.usageMetadata?.thoughtsTokenCount ?? (candidate as any)?.usageMetadata?.thoughtsTokenCount;
      if (typeof thoughtsTokenCount === "number") {
        res.write(`data: ${JSON.stringify({ thoughtsTokenCount })}\n\n`);
      }

      // Extract and forward finishReason if present
      const finishReason = candidate?.finishReason;
      if (finishReason) {
        res.write(`data: ${JSON.stringify({ finish: finishReason })}\n\n`);
      }

      const parts = candidate?.content?.parts || [];
      for (const part of parts) {
        if ((part as any).thought) {
          thoughtParts++;
          res.write(`data: ${JSON.stringify({ thinking: part.text || "" })}\n\n`);
        } else if (part.text) {
          answerParts++;
          res.write(`data: ${JSON.stringify({ token: part.text })}\n\n`);
        }
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[Chat Stream] Model: ${modelId}, Thoughts: ${thoughtParts}, Answers: ${answerParts}`);
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
    const errInfo = mapGeminiError(err, modelId);
    if (!res.headersSent) {
      res.status(errInfo.status).json({
        error: errInfo.error,
        details: errInfo.details || errInfo.technical,
        code: errInfo.code || errInfo.status,
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: errInfo.error, details: errInfo.details || errInfo.technical, code: errInfo.code || errInfo.status })}\n\n`);
      res.end();
    }
  }
});

export default router;
