import { createGeminiClient } from "../lib/gemini";

/**
 * Embedding helper. Runs on the USER's Gemini key — without one it returns
 * null so callers can skip similarity scoring instead of faking vectors.
 */
export async function generateEmbedding(text: string, apiKey?: string | null): Promise<number[] | null> {
  if (!apiKey) return null;
  try {
    const ai = createGeminiClient(apiKey);
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });
    const values = response?.embedding?.values;
    if (values && values.length > 0) return values as number[];
    return null;
  } catch (err) {
    console.warn("Embedding generation failed, skipping:", err);
    return null;
  }
}

export function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, idx) => sum + val * b[idx], 0);
}

export function magnitude(a: number[]): number {
  return Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

// Secret keys / cards filters
const SECRET_PATTERNS = [
  /[0-9a-f]{32,}/i,               // Generic api keys/tokens
  /(key|secret|token|password|passwd|pwd|auth)/i, // Words indicating secrets
  /\b[A-Za-z0-9_-]{40,}\b/,        // Long tokens (like GH tokens)
  /\b[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}\b/, // Cards numbers
  /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}\b/, // IBAN/bank numbers
];

export function hasSecrets(text: string): boolean {
  return SECRET_PATTERNS.some(p => p.test(text));
}
