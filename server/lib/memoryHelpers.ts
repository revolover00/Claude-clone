import { ai } from "../lib/gemini";

// In-memory or database embedding helper
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });
    if (response?.embedding?.values) {
      return response.embedding.values;
    }
    const fallback = (response as any).embedding?.values || [];
    if (fallback.length > 0) return fallback;
    return new Array(768).fill(0).map(() => Math.random() - 0.5);
  } catch (err) {
    console.warn("Embedding generation failed, using mock vector:", err);
    return new Array(768).fill(0).map(() => Math.random() - 0.5);
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
