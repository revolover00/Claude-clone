import { Router } from "express";
import { ai, apiKey, mapGeminiError } from "../lib/gemini";

const router = Router();

router.post("/", async (req, res) => {
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

export default router;
