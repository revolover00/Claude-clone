import { Router } from "express";
import { createGeminiClient, mapGeminiError } from "../lib/gemini";
import { geminiKeyFor } from "../lib/userAiKey";
import { getModelsFromDB } from "../lib/modelsStore";

const router = Router();

router.post("/", async (req, res) => {
  const { firstUserMsg, firstReply } = req.body;

  const userKey = await geminiKeyFor((req as any).user?.id);

  // Escape & limit to 500 chars each
  let safeUserMsg = typeof firstUserMsg === "string" ? firstUserMsg.slice(0, 500) : "";
  let safeReply = typeof firstReply === "string" ? firstReply.slice(0, 500) : "";
  safeUserMsg = safeUserMsg.replace(/[\\"\n\r]/g, " ").trim();
  safeReply = safeReply.replace(/[\\"\n\r]/g, " ").trim();

  try {
    const enabledModels = await getModelsFromDB(false);
    const lightModel = enabledModels.find(m => m.kind === "light") || enabledModels.find(m => m.is_default) || enabledModels[0];
    if (!lightModel) {
      res.status(500).json({ error: "No enabled models available." });
      return;
    }

    const prompt = `Generate a 3-6 word title for a chat conversation based on the user's first message: "${safeUserMsg}" and the assistant's reply: "${safeReply}". The title MUST be in the same language as the chat conversation. Return ONLY the plain title text, with no quotation marks, no markdown, and no preamble.`;

    // No key yet: derive a plain title locally so chat naming still works.
    if (!userKey) {
      const words = safeUserMsg.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
      res.json({ title: words || "New conversation" });
      return;
    }

    const response = await createGeminiClient(userKey).models.generateContent({
      model: lightModel.api_model_id,
      contents: prompt,
    });

    const title = response.text?.trim().replace(/['"“”]/g, "") || "New conversation";
    res.json({ title });
  } catch (err: any) {
    console.error("Auto-title generation error:", err);
    const errInfo = mapGeminiError(err, lightModel?.api_model_id);
    res.status(errInfo.status).json({
      error: errInfo.error,
      details: errInfo.details || errInfo.technical,
      code: errInfo.code || errInfo.status,
    });
  }
});

export default router;
