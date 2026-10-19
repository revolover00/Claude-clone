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
import { getCachedModels, getUserModelPrefs } from "../lib/providers/modelsCache";
import { mergeCatalogAndLive, providerCatalogInfo, catalogTotalsFromBundle } from "../lib/providers/catalogBridge";
import { CATALOG_SNAPSHOT, CATALOG_PROVIDERS } from "../../src/shared/catalog";
import { runProviderSync, catalogSyncEnabled } from "../lib/catalog/scheduler";
import type { ModelInfo } from "../lib/providers/types";
import { testProviderConnection } from "../lib/providers/connectionTest";

const router = Router();

// GET /api/providers - List connected credentials & registry info
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const credentials = await listUserCredentials(userId);
  const connected = new Set(
    credentials.filter((c) => !c.status || c.status === "active").map((c) => c.provider)
  );
  // Every bundled provider is listed, connected or not, with its catalog size.
  const registry = Object.values(providers).map((p) => ({
    ...providerCatalogInfo(p),
    connected: connected.has(p.id),
    credentialCount: credentials.filter((c) => c.provider === p.id).length,
  }));

  res.json({
    providers: registry,
    credentials,
    catalog: { ...catalogTotalsFromBundle(), snapshot: CATALOG_SNAPSHOT },
  });
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
    const bundled = CATALOG_PROVIDERS.find((p) => p.id === providerId)?.models.length || 0;
    // Fresh models: kick a catalog sync for this provider in the background so
    // its newest models land in the catalog right after the key is saved.
    if (catalogSyncEnabled()) {
      void runProviderSync(providerId, "credential").catch((err: any) =>
        console.warn(`[Providers] background sync for ${providerId} failed:`, err?.message || err)
      );
    }
    res.status(200).json({ ...saved, modelCount: bundled });
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

// POST /api/providers/:provider/test-connection — tiny, non-streaming live chat probe.
router.post("/:provider/test-connection", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const providerId = req.params.provider;
  if (!getProvider(providerId)) {
    res.status(404).json({ error: `Provider '${providerId}' not found` });
    return;
  }
  try {
    const suppliedKey = typeof req.body?.key === "string" ? req.body.key.trim() : "";
    if (suppliedKey && (suppliedKey.length < 8 || suppliedKey.length > 512 || /\s/.test(suppliedKey))) {
      res.status(400).json({ error: "API key must be 8–512 characters with no whitespace" });
      return;
    }
    const apiKey = suppliedKey || await getUserDecryptedKey(userId, providerId);
    if (!apiKey) {
      res.status(400).json({ error: "Add an API key before testing this provider" });
      return;
    }
    const result = await testProviderConnection(providerId, apiKey);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(502).json({ error: redact(error?.message || String(error)) });
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
    let live: ModelInfo[] | null = null;
    let liveError: string | null = null;

    // Live catalogs need a key; the bundled catalog fills in everything else.
    if (userKey) {
      try {
        live = await getCachedModels(userId, providerId, () => provider.listModels(userKey), forceRefresh);
      } catch (err: any) {
        liveError = redact(err.message);
      }
    }

    const merged = mergeCatalogAndLive(providerId, live);
    const prefs = await getUserModelPrefs(userId, providerId);
    const models = merged.map((m) => ({
      ...m,
      isEnabled: prefs[m.id]?.enabled ?? true,
      isPinned: prefs[m.id]?.pinned ?? false,
      alias: prefs[m.id]?.alias || null,
    }));

    res.json({
      provider: providerId,
      source: live ? "live" : "bundled",
      liveError,
      liveModelCount: live?.length ?? 0,
      bundledModelCount: merged.filter((m) => m.source !== "live").length,
      catalogSnapshot: CATALOG_SNAPSHOT,
      models,
    });
  } catch (err: any) {
    res.status(502).json({ error: `Failed to build the catalog for ${providerId}: ${redact(err.message)}` });
  }
});


export default router;
