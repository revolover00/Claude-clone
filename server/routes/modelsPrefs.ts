import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { saveModelPrefs } from "../lib/providers/modelsCache";
import { redact } from "../lib/providers/credentialsStore";

const router = Router();

// PUT /api/models/prefs
router.put("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { items: prefs } = req.body;
  if (!Array.isArray(prefs)) {
    res.status(400).json({ error: "items must be an array" });
    return;
  }

  try {
    const count = await saveModelPrefs(userId, prefs);
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to save model preferences: ${redact(err.message)}` });
  }
});

export default router;
