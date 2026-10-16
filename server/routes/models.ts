import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { checkIsAdmin, getModelsFromDB } from "../lib/modelsStore";

export { checkIsAdmin, getModelsFromDB };

const router = Router();

/**
 * GET /api/models — the app's own Gemini model list, derived automatically
 * from provider_catalog (chat models that are active or preview and usable
 * with the server key). The list is read-only: admins can no longer create,
 * edit or delete models; curation happens through catalog_overrides in the
 * Model Catalog settings tab.
 */
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await checkIsAdmin(req.user?.id || "");
    const all = req.query.all === "true" && isAdmin;
    const list = await getModelsFromDB(all);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
