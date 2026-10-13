import { Router, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { providers, getProvider } from "../lib/providers";
import {
  checkCreationRateLimit,
  saveCredential,
  listUserCredentials,
  deleteCredential,
  verifyCredential,
  getUserDecryptedKey,
  redact,
} from "../lib/providers/credentialsStore";
import { getCachedModels, getUserModelPrefs, saveModelPrefs } from "../lib/providers/modelsCache";

const router = Router();

// GET /api/providers - List connected credentials & registry info
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const credentials = await listUserCredentials(userId);
  const registry = Object.values(providers).map((p) => ({
    id: p.id,
    label: p.label,
    docsUrl: p.docsUrl,
    keyHelpUrl: p.keyHelpUrl,
  }));

  res.json({ providers: registry, credentials });
});

// POST /api/providers/:provider/credentials - Connect credential
router.post("/:provider/credentials", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // 1. Rate limiting: 5 per hour per user
  if (!checkCreationRateLimit(userId)) {
    res.status(429).json({ error: "Credential creation limit reached (maximum 5 per hour)", code: 429 });
    return;
  }

  const { provider: providerId } = req.params;
  const { key, label } = req.body;

  // 2. Validate input
  const provider = getProvider(providerId);
  if (!provider) {
    res.status(400).json({ error: `Provider '${providerId}' is not supported`, code: 400 });
    return;
  }

  if (typeof key !== "string") {
    res.status(400).json({ error: "API key is required", code: 400 });
    return;
  }

  const trimmedKey = key.trim();
  if (trimmedKey.length < 8 || trimmedKey.length > 512) {
    res.status(400).json({ error: "API key must be between 8 and 512 characters", code: 400 });
    return;
  }

  if (/\s/.test(trimmedKey)) {
    res.status(400).json({ error: "API key must not contain whitespace", code: 400 });
    return;
  }

  let finalLabel = "default";
  if (label !== undefined && label !== null) {
    if (typeof label !== "string" || label.trim().length < 1 || label.trim().length > 60) {
      res.status(400).json({ error: "Label must be between 1 and 60 characters", code: 400 });
      return;
    }
    finalLabel = label.trim();
  }

  // 3. Validate key against provider
  try {
    const valResult = await provider.validateKey(trimmedKey);
    if (!valResult.valid) {
      if (valResult.status === 400 || valResult.code === "KEY_INVALID") {
        res.status(400).json({ error: valResult.message || "Invalid API key", code: "KEY_INVALID" });
        return;
      }
      res.status(502).json({ error: valResult.message || "Provider unavailable", code: "PROVIDER_UNAVAILABLE" });
      return;
    }
  } catch (err: any) {
    res.status(502).json({ error: `Provider network error: ${redact(err.message)}`, code: "PROVIDER_UNAVAILABLE" });
    return;
  }

  // 4. Encrypt and save
  try {
    const saved = await saveCredential(userId, providerId, finalLabel, trimmedKey);
    res.status(200).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to save credential: ${redact(err.message)}`, code: 500 });
  }
});

// DELETE /api/providers/:provider/credentials/:id
router.delete("/:provider/credentials/:id", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { provider, id } = req.params;
  try {
    await deleteCredential(userId, provider, id);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to delete credential: ${redact(err.message)}` });
  }
});

// POST /api/providers/:provider/credentials/:id/verify
router.post("/:provider/credentials/:id/verify", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { provider, id } = req.params;
  try {
    const result = await verifyCredential(userId, provider, id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: `Verification failed: ${redact(err.message)}` });
  }
});

// GET /api/providers/:provider/models?refresh=1
router.get("/:provider/models", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { provider: providerId } = req.params;
  const provider = getProvider(providerId);
  if (!provider) {
    res.status(404).json({ error: `Provider '${providerId}' not found` });
    return;
  }

  const forceRefresh = req.query.refresh === "1";
  try {
    const userKey = (await getUserDecryptedKey(userId, providerId)) || "";
    const catalog = await getCachedModels(
      userId,
      providerId,
      () => provider.listModels(userKey),
      forceRefresh
    );

    const prefs = await getUserModelPrefs(userId, providerId);
    const merged = catalog.map((m) => ({
      ...m,
      isEnabled: prefs[m.id]?.enabled ?? true,
      isPinned: prefs[m.id]?.pinned ?? false,
      alias: prefs[m.id]?.alias || null,
    }));

    res.json({ models: merged });
  } catch (err: any) {
    res.status(502).json({ error: `Failed to fetch models from ${providerId}: ${redact(err.message)}` });
  }
});

// PUT /api/providers/prefs or /api/models/prefs
router.put("/prefs", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { prefs } = req.body;
  if (!Array.isArray(prefs)) {
    res.status(400).json({ error: "prefs must be an array" });
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
