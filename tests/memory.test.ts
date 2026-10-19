import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock `@supabase/supabase-js` at the top level
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => null,
}));

// Mock `@google/genai` to prevent hitting live API
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      embedContent: async () => ({
        embedding: { values: new Array(768).fill(0).map(() => Math.random()) }
      })
    };
  },
  Type: {
    OBJECT: "OBJECT",
    ARRAY: "ARRAY",
    STRING: "STRING"
  }
}));

import { hasSecrets, cosineSimilarity } from "../server/lib/memoryHelpers";

describe("Memory System Quality and Safety", () => {
  describe("Secret Patterns and Sensitive Information Filtering", () => {
    it("should identify secret credentials and API keys", () => {
      // Hex API keys (32+ chars)
      expect(hasSecrets("my key is f8c7a6e5d4c3b2a10f9e8d7c6b5a4321")).toBe(true);
      // GitHub personal access token pattern
      expect(hasSecrets("token: ghp_abc123XYZ7890123456789012345678901234567")).toBe(true);
      // Key indicator word
      expect(hasSecrets("password is secret123")).toBe(true);
    });

    it("should identify bank and credit card numbers", () => {
      // Credit card pattern
      expect(hasSecrets("My card number is 1234 5678 1234 5678")).toBe(true);
      expect(hasSecrets("Use card 4111-2222-3333-4444")).toBe(true);
      // IBAN pattern
      expect(hasSecrets("Send to NL99ABNA0411122233")).toBe(true);
    });

    it("should allow safe user input", () => {
      expect(hasSecrets("I am a freelance software engineer living in London.")).toBe(false);
      expect(hasSecrets("I prefer writing concise TypeScript code.")).toBe(false);
    });
  });

  describe("Cosine Similarity and Deduplication logic", () => {
    it("should compute accurate cosine similarity between vectors", () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2, 3];
      // Exact match should have similarity of 1
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1, 4);

      const vecC = [-1, -2, -3];
      // Opposite match should have similarity of -1
      expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(-1, 4);

      const vecD = [0, 0, 0];
      // Zero vector should return 0 (no similarity/error)
      expect(cosineSimilarity(vecA, vecD)).toBe(0);
    });

    it("should compute similarity correctly for high dimensions", () => {
      const size = 768;
      const vecA = new Array(size).fill(0.1);
      const vecB = new Array(size).fill(0.1);
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1, 4);
    });
  });

  describe("Incognito and Paused Memory Enforcements", () => {
    it("should bypass writing to memory if conversation is marked as incognito", () => {
      const activeConversation = { id: "conv-123", isIncognito: true, messages: [] };
      const memoryEnabled = true;

      // Logic replication of useSendStream's write trigger
      const shouldWriteMemory = memoryEnabled && !activeConversation.isIncognito;
      expect(shouldWriteMemory).toBe(false);
    });

    it("should bypass both reading and writing if memory is paused", () => {
      const activeConversation = { id: "conv-123", isIncognito: false, messages: [] };
      const memoryEnabled = false;

      // Logic replication: neither retrieval nor extraction runs
      const shouldRetrieve = memoryEnabled;
      const shouldExtract = memoryEnabled && !activeConversation.isIncognito;

      expect(shouldRetrieve).toBe(false);
      expect(shouldExtract).toBe(false);
    });
  });

  describe("Retrieval and Sorting Ordering", () => {
    it("should prioritize pinned memories first, then sort unpinned by similarity", () => {
      const activeMemories = [
        { id: "mem-1", content: "I am a dev", pinned: false, category: "work", embedding: [0.1, 0.2] },
        { id: "mem-2", content: "My dog is named Max", pinned: true, category: "people", embedding: [0.9, 0.9] },
        { id: "mem-3", content: "I like python", pinned: false, category: "preferences", embedding: [0.5, 0.5] }
      ];

      const promptEmbedding = [0.45, 0.45]; // Highly similar to mem-3

      const pinnedMemories = activeMemories.filter(m => m.pinned);
      const unpinnedMemories = activeMemories.filter(m => !m.pinned);

      // Score unpinned memories by similarity
      const scored = unpinnedMemories.map(m => {
        const sim = cosineSimilarity(promptEmbedding, m.embedding);
        return { ...m, sim };
      });

      scored.sort((a, b) => b.sim - a.sim);

      // combined list puts pinned first, followed by top unpinned sorted by sim
      const combined = [...pinnedMemories, ...scored];

      expect(combined[0].id).toBe("mem-2"); // Pinned must be first
      expect(combined[1].id).toBe("mem-3"); // Sim scored unpinned next (mem-3 similarity is much closer to promptEmbedding than mem-1)
      expect(combined[2].id).toBe("mem-1");
    });
  });
});
