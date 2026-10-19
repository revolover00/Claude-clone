/**
 * Supabase sessions are persisted in localStorage by default. Embedded previews
 * can expose localStorage but reject writes, which makes Supabase fall back to
 * memory-only auth. Keep IndexedDB and sessionStorage fallbacks for those cases.
 */

const DATABASE_NAME = "claude-auth-storage";
const DATABASE_VERSION = 1;
const STORE_NAME = "sessions";

type WebStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface AuthStorageBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface AuthStorageOptions {
  localStorage?: WebStorage | null;
  sessionStorage?: WebStorage | null;
  indexedDBStorage?: AuthStorageBackend | null;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openAuthDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }
        settled = true;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => fail(request.error || new Error("Could not open auth storage"));
      request.onblocked = () => fail(new Error("Auth storage upgrade is blocked"));
    } catch (error) {
      reject(error);
    }
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });
  databasePromise = opening;
  return opening;
}

async function readDatabase(key: string): Promise<string | null> {
  const database = await openAuthDatabase();
  return new Promise((resolve, reject) => {
    try {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
      request.onerror = () => reject(request.error || new Error("Could not read auth storage"));
    } catch (error) {
      reject(error);
    }
  });
}

async function writeDatabase(key: string, value: string | null): Promise<void> {
  const database = await openAuthDatabase();
  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      if (value === null) store.delete(key);
      else store.put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not write auth storage"));
      transaction.onabort = () => reject(transaction.error || new Error("Auth storage write was aborted"));
    } catch (error) {
      reject(error);
    }
  });
}

const indexedDBBackend: AuthStorageBackend = {
  getItem: readDatabase,
  setItem: (key, value) => writeDatabase(key, value),
  removeItem: (key) => writeDatabase(key, null),
};

function browserStorage(name: "localStorage" | "sessionStorage"): WebStorage | null {
  try {
    return typeof window === "undefined" ? null : window[name];
  } catch {
    return null;
  }
}

function safeGet(storage: WebStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: WebStorage | null, key: string, value: string): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(storage: WebStorage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Continue clearing the other available stores.
  }
}

/** A Supabase-compatible storage adapter with durable browser fallbacks. */
export function createAuthStorage(options: AuthStorageOptions = {}) {
  const local = options.localStorage === undefined ? browserStorage("localStorage") : options.localStorage;
  const session = options.sessionStorage === undefined ? browserStorage("sessionStorage") : options.sessionStorage;
  const durable = options.indexedDBStorage === undefined ? indexedDBBackend : options.indexedDBStorage;
  const memory = new Map<string, string>();

  return {
    async getItem(key: string): Promise<string | null> {
      const localValue = safeGet(local, key);
      if (localValue !== null) return localValue;
      try {
        const durableValue = await durable?.getItem(key);
        if (durableValue !== null && durableValue !== undefined) return durableValue;
      } catch {
        // IndexedDB can be disabled in private browsing or an embedded frame.
      }
      return safeGet(session, key) ?? memory.get(key) ?? null;
    },

    async setItem(key: string, value: string): Promise<void> {
      memory.set(key, value);
      if (safeSet(local, key, value)) {
        try {
          await durable?.setItem(key, value);
        } catch {
          // localStorage remains the primary store if the backup is unavailable.
        }
        return;
      }
      try {
        if (durable) {
          await durable.setItem(key, value);
          return;
        }
      } catch {
        // Try sessionStorage, then keep this page working with an in-memory copy.
      }
      safeSet(session, key, value);
    },

    async removeItem(key: string): Promise<void> {
      memory.delete(key);
      safeRemove(local, key);
      safeRemove(session, key);
      try {
        await durable?.removeItem(key);
      } catch {
        // Storage may be unavailable; Supabase can still clear the active client.
      }
    },
  };
}

export const authStorage = createAuthStorage();
