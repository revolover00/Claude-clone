import { Router } from "express";
import { createGeminiClient } from "../lib/gemini";
import { geminiKeyFor } from "../lib/userAiKey";
import { getModelsFromDB } from "../lib/modelsStore";

const router = Router();

/** Canned follow-ups used when the user has no key yet or the model fails. */
function fallbackSuggestions(language: string): string[] {
  return [
    language === "ar" ? "هل يمكنك توضيح المزيد؟" : "Can you explain further?",
    language === "ar" ? "ما هي أمثلة ذلك؟" : "What are some examples?",
    language === "ar" ? "كيف يمكنني تطبيق هذا؟" : "How can I apply this?",
  ];
}

router.post("/", async (req, res) => {
  const userKey = await geminiKeyFor((req as any).user?.id);

  const { content, language = "en" } = req.body;
  if (!content) {
    res.status(400).json({ error: "Missing content for suggestion generation", code: 400 });
    return;
  }

  try {
    const enabledModels = await getModelsFromDB(false);
    const lightModel = enabledModels.find(m => m.kind === "light") || enabledModels.find(m => m.is_default) || enabledModels[0];
    if (!lightModel) {
      res.status(500).json({ error: "No enabled models available." });
      return;
    }

    if (!userKey) {
      res.json({ suggestions: fallbackSuggestions(language) });
      return;
    }

    const prompt = `Based on the following AI response, generate exactly 3 short, relevant, engaging follow-up questions that the user might want to ask next. Keep each question short (max 12 words).
The conversation language is ${language === "ar" ? "Arabic" : "English"}. Respond ONLY with a valid JSON array of 3 strings, e.g. ["Question 1", "Question 2", "Question 3"]. No markdown formatting, no code block backticks.

AI Response:
${content}`;

    const response = await createGeminiClient(userKey).models.generateContent({
      model: lightModel.api_model_id,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "[]";
    try {
      const suggestions = JSON.parse(text);
      res.json({ suggestions });
    } catch {
      const matches = text.match(/"([^"\\]|\\.)*"/g);
      if (matches && matches.length >= 3) {
        const parsed = matches.slice(0, 3).map(m => m.replace(/^"|"$/g, ""));
        res.json({ suggestions: parsed });
      } else {
        res.json({ suggestions: fallbackSuggestions(language)});
      }
    }
  } catch {
    res.json({
      suggestions: fallbackSuggestions(language)
    });
  }
});

export default router;
