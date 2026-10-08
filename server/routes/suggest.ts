import { Router } from "express";
import { ai, apiKey } from "../lib/gemini";

const router = Router();

router.post("/suggest", async (req, res) => {
  if (!apiKey) {
    res.status(403).json({ error: "API key invalid or missing on the server", code: 403 });
    return;
  }
  
  const { content, language = "en" } = req.body;
  if (!content) {
    res.status(400).json({ error: "Missing content for suggestion generation", code: 400 });
    return;
  }

  try {
    const prompt = `Based on the following AI response, generate exactly 3 short, relevant, engaging follow-up questions that the user might want to ask next. Keep each question short (max 12 words).
The conversation language is ${language === "ar" ? "Arabic" : "English"}. Respond ONLY with a valid JSON array of 3 strings, e.g. ["Question 1", "Question 2", "Question 3"]. No markdown formatting, no code block backticks.

AI Response:
${content}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
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
        res.json({ suggestions: [
          language === "ar" ? "هل يمكنك توضيح المزيد؟" : "Can you explain further?",
          language === "ar" ? "ما هي أمثلة ذلك؟" : "What are some examples?",
          language === "ar" ? "كيف يمكنني تطبيق هذا؟" : "How can I apply this?"
        ]});
      }
    }
  } catch (err: any) {
    res.json({
      suggestions: [
        language === "ar" ? "هل يمكنك توضيح المزيد؟" : "Can you explain further?",
        language === "ar" ? "ما هي أمثلة ذلك؟" : "What are some examples?",
        language === "ar" ? "كيف يمكنني تطبيق هذا؟" : "How can I apply this?"
      ]
    });
  }
});

export default router;
