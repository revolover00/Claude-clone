// AUTO-GENERATED — do not edit by hand.
// Provider: Mistral (mistral) · models.dev key: mistral
// Source: models.dev (MIT) · snapshot 2026-10-16 · 20 models
// Regenerate with: npm run catalog:sync
import type { CatalogEntry } from "../types";

export const ROWS: CatalogEntry[] = [
  { id: "mistral-large-4", name: "Mistral Large 4", family: "mistral-large", kind: "chat", ctx: 1048576, out: 262144, caps: "trsT", in: "text,image", outMod: "text", price: [0.68, 2.09, 0.07], release: "2026-10-06", updated: "2026-10-06", knowledge: "", status: "preview" },
  { id: "zai-glm-5-3", name: "GLM-5.3", family: "glm", kind: "chat", ctx: 1048576, out: 131072, caps: "trsTw", in: "text", outMod: "text", price: [1.4, 4.4, 0.14], release: "2026-08-14", updated: "2026-08-14", knowledge: "" },
  { id: "mistral-medium-2604", name: "Mistral Medium 3.5", family: "mistral-medium", kind: "chat", ctx: 262144, out: 262144, caps: "trsTw", in: "text,image", outMod: "text", price: [1.5, 7.5, 0.15], release: "2026-04-29", updated: "2026-04-29", knowledge: "" },
  { id: "mistral-medium-latest", name: "Mistral Medium (latest)", family: "mistral-medium", kind: "chat", ctx: 262144, out: 262144, caps: "trsTw", in: "text,image", outMod: "text", price: [1.5, 7.5, 0.15], release: "2026-04-29", updated: "2026-04-29", knowledge: "" },
  { id: "mistral-small-2603", name: "Mistral Small 4", family: "mistral-small", kind: "chat", ctx: 262144, out: 256000, caps: "trTw", in: "text,image", outMod: "text", price: [0.15, 0.6, 0.015], release: "2026-03-16", updated: "2026-03-16", knowledge: "2025-06" },
  { id: "mistral-small-latest", name: "Mistral Small (latest)", family: "mistral-small", kind: "chat", ctx: 262144, out: 256000, caps: "trTw", in: "text,image", outMod: "text", price: [0.15, 0.6, 0.015], release: "2026-03-16", updated: "2026-03-16", knowledge: "2025-06" },
  { id: "voxtral-mini-tts-latest", name: "Voxtral Mini TTS (latest)", family: "voxtral", kind: "audio", ctx: 0, out: 0, caps: "", in: "text", outMod: "audio", price: null, release: "2026-03-01", updated: "2026-03-01", knowledge: "" },
  { id: "voxtral-mini-latest", name: "Voxtral Mini (latest)", family: "voxtral", kind: "chat", ctx: 0, out: 0, caps: "", in: "audio", outMod: "text", price: null, release: "2026-02-01", updated: "2026-02-01", knowledge: "" },
  { id: "ministral-14b-2512", name: "Ministral 3 14B", family: "ministral", kind: "chat", ctx: 262144, out: 262144, caps: "tsTw", in: "text,image", outMod: "text", price: [0.2, 0.2, 0.02], release: "2025-12-02", updated: "2025-12-02", knowledge: "" },
  { id: "ministral-3b-2512", name: "Ministral 3 3B", family: "ministral", kind: "chat", ctx: 131072, out: 262144, caps: "tsTw", in: "text,image", outMod: "text", price: [0.1, 0.1, 0.01], release: "2025-12-02", updated: "2025-12-02", knowledge: "" },
  { id: "ministral-8b-2512", name: "Ministral 3 8B", family: "ministral", kind: "chat", ctx: 262144, out: 262144, caps: "tsTw", in: "text,image", outMod: "text", price: [0.15, 0.15, 0.015], release: "2025-12-02", updated: "2025-12-02", knowledge: "" },
  { id: "codestral-2508", name: "Codestral 25.08", family: "codestral", kind: "chat", ctx: 256000, out: 8192, caps: "tsT", in: "text", outMod: "text", price: [0.3, 0.9, 0.03], release: "2025-07-30", updated: "2025-07-30", knowledge: "" },
  { id: "voxtral-small-2507", name: "Voxtral Small", family: "voxtral", kind: "chat", ctx: 32768, out: 32000, caps: "tTw", in: "text,audio", outMod: "text", price: [0.1, 0.4, 0], release: "2025-07-15", updated: "2025-07-15", knowledge: "" },
  { id: "voxtral-small-latest", name: "Voxtral Small (latest)", family: "voxtral", kind: "chat", ctx: 32768, out: 32000, caps: "tTw", in: "text,audio", outMod: "text", price: [0.1, 0.3, 0], release: "2025-07-15", updated: "2025-07-15", knowledge: "" },
  { id: "mistral-large-2512", name: "Mistral Large 3", family: "mistral-large", kind: "chat", ctx: 262144, out: 262144, caps: "tTw", in: "text,image", outMod: "text", price: [0.5, 1.5, 0.05], release: "2024-11-01", updated: "2025-12-02", knowledge: "2024-11" },
  { id: "mistral-large-latest", name: "Mistral Large (latest)", family: "mistral-large", kind: "chat", ctx: 262144, out: 262144, caps: "tTw", in: "text,image", outMod: "text", price: [0.5, 1.5, 0.05], release: "2024-11-01", updated: "2025-12-02", knowledge: "2024-11" },
  { id: "ministral-3b-latest", name: "Ministral 3B (latest)", family: "ministral", kind: "chat", ctx: 131072, out: 128000, caps: "tTw", in: "text,image", outMod: "text", price: [0.04, 0.04, 0], release: "2024-10-01", updated: "2024-10-04", knowledge: "2024-10" },
  { id: "ministral-8b-latest", name: "Ministral 8B (latest)", family: "ministral", kind: "chat", ctx: 262144, out: 128000, caps: "tTw", in: "text,image", outMod: "text", price: [0.1, 0.1, 0], release: "2024-10-01", updated: "2024-10-04", knowledge: "2024-10" },
  { id: "codestral-latest", name: "Codestral (latest)", family: "codestral", kind: "chat", ctx: 256000, out: 4096, caps: "tTw", in: "text", outMod: "text", price: [0.3, 0.9, 0.03], release: "2024-05-29", updated: "2025-01-04", knowledge: "2024-10" },
  { id: "mistral-embed", name: "Mistral Embed", family: "mistral-embed", kind: "embedding", ctx: 8000, out: 3072, caps: "", in: "text", outMod: "text", price: [0.1, 0, 0], release: "2023-12-11", updated: "2023-12-11", knowledge: "" },
];
