import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock `@supabase/supabase-js` at the top level to guarantee no external connections are attempted
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => null,
}));

import { getModelsFromDB, invalidateModelCache } from "../server/routes/models";

// Mock localStorage for server side node environment test support
if (typeof localStorage === "undefined") {
  const mockLocalStorage: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]); },
    length: 0,
    key: () => null,
  } as any;
}

describe("Data-driven Models and Fallback Behavior", () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateModelCache();
  });

  it("should retrieve the list of enabled models with default seed models", async () => {
    const models = await getModelsFromDB(false);
    expect(models.length).toBeGreaterThan(0);
    
    const defaultModel = models.find(m => m.is_default);
    expect(defaultModel).toBeDefined();
    expect(defaultModel?.enabled).toBe(true);
  });

  it("should fall back correctly when a model is disabled", async () => {
    // Seed standard models with one model disabled
    const mockSeed = [
      { id: "m1", slug: "active-model", display_name: "Active Model", api_model_id: "gemini-active", kind: "chat", enabled: true, is_default: true, sort_order: 1 },
      { id: "m2", slug: "disabled-model", display_name: "Disabled Model", api_model_id: "gemini-disabled", kind: "chat", enabled: false, is_default: false, sort_order: 2 }
    ];
    localStorage.setItem("claude_clone_mock_models", JSON.stringify(mockSeed));
    invalidateModelCache();

    const enabledModels = await getModelsFromDB(false);
    expect(enabledModels.length).toBe(1);
    expect(enabledModels[0].slug).toBe("active-model");

    // Test resolving behavior (replicating the logic used in server/routes/chat.ts)
    const selectedModelSlug = "disabled-model";
    let resolvedModel = enabledModels.find(m => m.slug === selectedModelSlug);
    if (!resolvedModel) {
      resolvedModel = enabledModels.find(m => m.is_default) || enabledModels[0];
    }

    expect(resolvedModel).toBeDefined();
    expect(resolvedModel.slug).toBe("active-model"); // Fell back to default because selected was disabled
  });

  it("should handle cache invalidation correctly", async () => {
    const firstCall = await getModelsFromDB(false);
    expect(firstCall.length).toBeGreaterThan(0);
    
    // Modify models list in localStorage directly
    const modifiedSeed = [
      { id: "m1", slug: "cached-model", display_name: "Cached Model", api_model_id: "gemini-cached", kind: "chat", enabled: true, is_default: true, sort_order: 1 }
    ];
    localStorage.setItem("claude_clone_mock_models", JSON.stringify(modifiedSeed));

    // Call again immediately - should still return cached list
    const secondCall = await getModelsFromDB(false);
    expect(secondCall[0].slug).not.toBe("cached-model");

    // Invalidate the cache
    invalidateModelCache();

    // Call again - should now fetch the modified list
    const thirdCall = await getModelsFromDB(false);
    expect(thirdCall[0].slug).toBe("cached-model");
  });
});
