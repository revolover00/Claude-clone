import { describe, expect, it } from "vitest";
import { createAuthStorage, type AuthStorageBackend } from "../src/utils/authStorage";

type Values = Map<string, string>;

function webStorage(values: Values) {
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function durableStorage(values: Values): AuthStorageBackend {
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
}

const blockedStorage = {
  getItem: () => { throw new Error("Storage access denied"); },
  setItem: () => { throw new Error("Storage access denied"); },
  removeItem: () => { throw new Error("Storage access denied"); },
};

describe("Supabase auth storage persistence", () => {
  it("uses localStorage as primary storage and keeps an IndexedDB backup", async () => {
    const localValues = new Map<string, string>();
    const databaseValues = new Map<string, string>();
    const storage = createAuthStorage({
      localStorage: webStorage(localValues),
      sessionStorage: null,
      indexedDBStorage: durableStorage(databaseValues),
    });

    await storage.setItem("sb-project-auth-token", "persisted-session");

    expect(await storage.getItem("sb-project-auth-token")).toBe("persisted-session");
    expect(localValues.get("sb-project-auth-token")).toBe("persisted-session");
    expect(databaseValues.get("sb-project-auth-token")).toBe("persisted-session");
  });

  it("persists sessions in IndexedDB when localStorage is blocked, across client instances", async () => {
    const databaseValues = new Map<string, string>();
    const database = durableStorage(databaseValues);
    const options = {
      localStorage: blockedStorage,
      sessionStorage: blockedStorage,
      indexedDBStorage: database,
    };
    const writer = createAuthStorage(options);

    await writer.setItem("sb-project-auth-token", "persistent-session");

    const reader = createAuthStorage(options);
    await expect(reader.getItem("sb-project-auth-token")).resolves.toBe("persistent-session");
    await reader.removeItem("sb-project-auth-token");
    await expect(createAuthStorage(options).getItem("sb-project-auth-token")).resolves.toBeNull();
  });

  it("falls back to sessionStorage if IndexedDB is unavailable", async () => {
    const sessionValues = new Map<string, string>();
    const unavailableDatabase: AuthStorageBackend = {
      getItem: async () => { throw new Error("IndexedDB disabled"); },
      setItem: async () => { throw new Error("IndexedDB disabled"); },
      removeItem: async () => { throw new Error("IndexedDB disabled"); },
    };
    const options = {
      localStorage: blockedStorage,
      sessionStorage: webStorage(sessionValues),
      indexedDBStorage: unavailableDatabase,
    };
    const storage = createAuthStorage(options);

    await storage.setItem("sb-project-auth-token", "tab-session");

    expect(sessionValues.get("sb-project-auth-token")).toBe("tab-session");
    await expect(createAuthStorage(options).getItem("sb-project-auth-token")).resolves.toBe("tab-session");
  });
});
