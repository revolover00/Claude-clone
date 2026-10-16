import { Router } from "express";
import { mapGeminiError, formatMessage, buildSystemInstruction, startGeminiStream } from "../lib/gemini";
import { getAvailableSkillsSummary } from "../lib/skills/db";
import { executeSkillFunctionCall, runSkillToolStream } from "../lib/skills/toolLoop";
import { getThinkingPlanAndConfig, modelSupportsReasoning, type RegisteredProviderId } from "../lib/thinkingRouter";
import { getModelsFromDB } from "../lib/modelsStore";
import { normalizeSlug } from "../../src/shared/normalizeSlug";
import { retrieveUserMemoryPrompt } from "../lib/chatMemory";
import { createClient } from "@supabase/supabase-js";
import { validateChatMessages, DEFAULT_CHAT_TOOLS, pumpGeminiStream } from "../lib/chatStreamHelpers";
import { getProvider, isKnownProvider } from "../lib/providers";
import { getUserDecryptedKey, markCredentialInvalid } from "../lib/providers/credentialsStore";
import { geminiKeyFor } from "../lib/userAiKey";

const router = Router();

router.post("/", async (req, res) => {
  const {
    messages, style, profileInstructions, projectInstructions,
    projectKnowledge, model, effort, webSearch, extendedThinking, language,
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
    let provider: RegisteredProviderId = "gemini";
    let targetModelId = "";

    if (model && model.includes(":")) {
      const parts = model.split(":");
      const p = parts[0].toLowerCase();
      // Every provider in the registry is addressable as "<provider>:<model id>".
      if (isKnownProvider(p)) {
        provider = p;
        targetModelId = parts.slice(1).join(":");
      }
    }

    const requestedSlug = model ? normalizeSlug(model) : model;
    const enabledModels = await getModelsFromDB(false);
    let resolvedModel = enabledModels.find((m) => {
      const normSlug = normalizeSlug(m.slug);
      return normSlug === requestedSlug || m.slug === model || m.id === model;
    });
    if (!resolvedModel && targetModelId) {
      // Canonical "provider:modelId" references resolve through the API id.
      resolvedModel = enabledModels.find(
        (m) => m.api_model_id === targetModelId || m.slug === targetModelId
      );
    }
    if (!resolvedModel && provider === "gemini") {
      resolvedModel = enabledModels.find((m) => m.is_default) || enabledModels[0];
    }

    if (!targetModelId) {
      if (!resolvedModel) {
        res.status(500).json({ error: "No enabled models available on the server." });
        return;
      }
      targetModelId = resolvedModel.api_model_id;
      const rowProvider = String((resolvedModel as any).provider || "").toLowerCase();
      if (rowProvider && isKnownProvider(rowProvider)) {
        provider = rowProvider;
      }
    }
    modelId = targetModelId;

    // Every AI call uses the user's own saved key — the server ships none.
    const userId: string | undefined = (req as any).user?.id;
    const userKey = await getUserDecryptedKey(userId || "", provider);
    if (!userKey) {
      const providerLabel = getProvider(provider)?.label || provider;
      res.status(400).json({
        error: `No API key configured for ${providerLabel}. Add one in Settings > Providers to use ${providerLabel} models.`,
        code: "KEY_MISSING",
      });
      return;
    }
    // Embeddings for the memory feature always run on the user's Gemini key.
    const memoryKey = provider === "gemini" ? userKey : await geminiKeyFor(userId);

    let formattedMessages = messages.map(formatMessage);
    if (resolvedModel && !resolvedModel.supports_vision) {
      formattedMessages = formattedMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.filter((p: any) => !p.inlineData),
      }));
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const isRealSupabaseConfigured = Boolean(
      supabaseUrl && supabaseServiceKey && !supabaseUrl.includes("YOUR_") && !supabaseServiceKey.includes("YOUR_")
    );
    const supabaseServer = isRealSupabaseConfigured ? createClient(supabaseUrl, supabaseServiceKey) : null;

    const memoryPromptSection = await retrieveUserMemoryPrompt(
      userId, messages, req.body.projectId, supabaseServer, isRealSupabaseConfigured, memoryKey
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

    const config: any = {
      systemInstruction: buildSystemInstruction(
        style, profileInstructions, projectInstructions, projectKnowledge, language,
        resolvedModel?.display_name || modelId
      ) + memoryPromptSection + skillsPromptSection,
      abortSignal: abortCtrl.signal,
      tools: DEFAULT_CHAT_TOOLS,
    };

    let searchGroundingDisabledNotice = false;
    if (webSearch && resolvedModel?.supports_search) {
      searchGroundingDisabledNotice = true;
    }

    const supportsThinking = modelSupportsReasoning(provider, modelId, resolvedModel);
    let thinkingDecision: any = null;
    if (supportsThinking) {
      const latestUserMsg = messages[messages.length - 1];
      const latestText = typeof latestUserMsg?.content === "string" ? latestUserMsg.content : "";
      const attachmentsCount = latestUserMsg?.attachments?.length || 0;
      thinkingDecision = getThinkingPlanAndConfig(
        provider,
        modelId,
        { content: latestText, attachmentsCount },
        { extendedThinking: Boolean(extendedThinking), effort },
        resolvedModel
      );
      if (thinkingDecision?.config) {
        config.thinkingConfig = thinkingDecision.config;
      }
    }

    // Stream through the provider adapter for every non-Gemini provider
    if (provider !== "gemini") {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      if (thinkingDecision) {
        res.write(`data: ${JSON.stringify({ thinkingPlan: thinkingDecision.plan })}\n\n`);
      }

      const pAdapter = getProvider(provider);
      await pAdapter?.streamChat({
        modelId,
        apiKey: userKey,
        messages,
        config,
        res,
        abortSignal: abortCtrl.signal,
        thinkingPlan: thinkingDecision?.plan,
        onInvalidKey: async () => {
          await markCredentialInvalid(userId, provider);
        },
      });
      return;
    }

    // Default Gemini streaming path
    let streamRes: any;
    try {
      streamRes = await startGeminiStream(userKey, modelId, formattedMessages, config);
    } catch (err: any) {
      const errInfo = mapGeminiError(err, modelId);
      res.status(errInfo.status).json({
        error: errInfo.error,
        details: errInfo.details || errInfo.technical,
        code: errInfo.code || errInfo.status,
      });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    if (thinkingDecision) {
      res.write(`data: ${JSON.stringify({ thinkingPlan: thinkingDecision.plan })}\n\n`);
    }
    if (extendedThinking && !supportsThinking) {
      res.write(`data: ${JSON.stringify({ warning: "This model doesn't support extended thinking" })}\n\n`);
    }
    if (streamRes.fallbackApplied) {
      res.write(`data: ${JSON.stringify({ warning: "Reasoning was disabled for this request because the model rejected the thinking settings" })}\n\n`);
    }
    if (searchGroundingDisabledNotice) {
      res.write(`data: ${JSON.stringify({ warning: "Web search grounding was disabled for this request to prioritize skill tool calling" })}\n\n`);
    }

    await pumpGeminiStream({
      res,
      stream: streamRes.stream,
      abortCtrl,
      userId: (req as any).user?.id,
      modelId,
      formattedMessages,
      config,
      executeSkillFunctionCall,
      runSkillToolStream: (mId: string, msgs: any[], cfg: any, call: any, result: string) =>
        runSkillToolStream(memoryKey || userKey, mId, msgs, cfg, call, result),
    });
  } catch (err: any) {
    if (abortCtrl.signal.aborted) {
      res.end();
      return;
    }
    console.error("Chat route stream error:", err);
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
