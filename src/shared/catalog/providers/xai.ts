// AUTO-GENERATED — do not edit by hand.
// Provider: xAI (xai) · models.dev key: xai
// Source: models.dev (MIT) · snapshot 2026-10-16 · 22 models
// Regenerate with: npm run catalog:sync
import type { CatalogEntry } from "../types";

export const ROWS: CatalogEntry[] = [
  { id: "grok-4-1-fast", name: "Grok 4.1 Fast", family: "grok", kind: "chat", ctx: 2000000, out: 30000, caps: "trT", in: "text,image", outMod: "text", price: [0.2, 0.5, 0.05], release: "2025-11-19", updated: "2025-11-19", knowledge: "2025-07" },
  { id: "grok-4-1-fast-non-reasoning", name: "Grok 4.1 Fast (Non-Reasoning)", family: "grok", kind: "chat", ctx: 2000000, out: 30000, caps: "tT", in: "text,image", outMod: "text", price: [0.2, 0.5, 0.05], release: "2025-11-19", updated: "2025-11-19", knowledge: "2025-07" },
  { id: "grok-4-fast", name: "Grok 4 Fast", family: "grok", kind: "chat", ctx: 2000000, out: 30000, caps: "trT", in: "text,image", outMod: "text", price: [0.2, 0.5, 0.05], release: "2025-09-19", updated: "2025-09-19", knowledge: "2025-07" },
  { id: "grok-4-fast-non-reasoning", name: "Grok 4 Fast (Non-Reasoning)", family: "grok", kind: "chat", ctx: 2000000, out: 30000, caps: "tT", in: "text,image", outMod: "text", price: [0.2, 0.5, 0.05], release: "2025-09-19", updated: "2025-09-19", knowledge: "2025-07" },
  { id: "grok-code-fast-1", name: "Grok Code Fast 1", family: "grok", kind: "chat", ctx: 256000, out: 10000, caps: "trT", in: "text", outMod: "text", price: [0.2, 1.5, 0.02], release: "2025-08-28", updated: "2025-08-28", knowledge: "2023-10" },
  { id: "grok-4", name: "Grok 4", family: "grok", kind: "chat", ctx: 256000, out: 64000, caps: "trT", in: "text", outMod: "text", price: [3, 15, 0.75], release: "2025-07-09", updated: "2025-07-09", knowledge: "2025-07" },
  { id: "grok-3", name: "Grok 3", family: "grok-3", kind: "chat", ctx: 131072, out: 8192, caps: "tT", in: "text", outMod: "text", price: [3, 15, 0.75], release: "2025-02-17", updated: "2025-02-17", knowledge: "2024-11" },
  { id: "grok-3-fast", name: "Grok 3 Fast", family: "grok-3", kind: "chat", ctx: 131072, out: 8192, caps: "tT", in: "text", outMod: "text", price: [5, 25, 1.25], release: "2025-02-17", updated: "2025-02-17", knowledge: "2024-11" },
  { id: "grok-3-fast-latest", name: "Grok 3 Fast Latest", family: "grok-3", kind: "chat", ctx: 131072, out: 8192, caps: "tT", in: "text", outMod: "text", price: [5, 25, 1.25], release: "2025-02-17", updated: "2025-02-17", knowledge: "2024-11" },
  { id: "grok-3-latest", name: "Grok 3 Latest", family: "grok-3", kind: "chat", ctx: 131072, out: 8192, caps: "tT", in: "text", outMod: "text", price: [3, 15, 0.75], release: "2025-02-17", updated: "2025-02-17", knowledge: "2024-11" },
  { id: "grok-3-mini", name: "Grok 3 Mini", family: "grok-3", kind: "chat", ctx: 131072, out: 8192, caps: "trT", in: "text", outMod: "text", price: [0.3, 0.5, 0.075], release: "2025-02-17", updated: "2025-02-17", knowledge: "2024-11" },
  { id: "grok-3-mini-fast", name: "Grok 3 Mini Fast", family: "grok-3", kind: "chat", ctx: 131072, out: 8192, caps: "trT", in: "text", outMod: "text", price: [0.6, 4, 0.15], release: "2025-02-17", updated: "2025-02-17", knowledge: "2024-11" },
  { id: "grok-3-mini-fast-latest", name: "Grok 3 Mini Fast Latest", family: "grok-3", kind: "chat", ctx: 131072, out: 8192, caps: "trT", in: "text", outMod: "text", price: [0.6, 4, 0.15], release: "2025-02-17", updated: "2025-02-17", knowledge: "2024-11" },
  { id: "grok-3-mini-latest", name: "Grok 3 Mini Latest", family: "grok-3", kind: "chat", ctx: 131072, out: 8192, caps: "trT", in: "text", outMod: "text", price: [0.3, 0.5, 0.075], release: "2025-02-17", updated: "2025-02-17", knowledge: "2024-11" },
  { id: "grok-2-1212", name: "Grok 2 (1212)", family: "grok-2", kind: "chat", ctx: 131072, out: 8192, caps: "tT", in: "text", outMod: "text", price: [2, 10, 2], release: "2024-12-12", updated: "2024-12-12", knowledge: "2024-08" },
  { id: "grok-beta", name: "Grok Beta", family: "grok-beta", kind: "chat", ctx: 131072, out: 4096, caps: "tT", in: "text", outMod: "text", price: [5, 15, 5], release: "2024-11-01", updated: "2024-11-01", knowledge: "2024-08" },
  { id: "grok-vision-beta", name: "Grok Vision Beta", family: "grok-vision", kind: "chat", ctx: 8192, out: 4096, caps: "tT", in: "text,image", outMod: "text", price: [5, 15, 5], release: "2024-11-01", updated: "2024-11-01", knowledge: "2024-08" },
  { id: "grok-2", name: "Grok 2", family: "grok-2", kind: "chat", ctx: 131072, out: 8192, caps: "tT", in: "text", outMod: "text", price: [2, 10, 2], release: "2024-08-20", updated: "2024-08-20", knowledge: "2024-08" },
  { id: "grok-2-latest", name: "Grok 2 Latest", family: "grok-2", kind: "chat", ctx: 131072, out: 8192, caps: "tT", in: "text", outMod: "text", price: [2, 10, 2], release: "2024-08-20", updated: "2024-12-12", knowledge: "2024-08" },
  { id: "grok-2-vision", name: "Grok 2 Vision", family: "grok-2", kind: "chat", ctx: 8192, out: 4096, caps: "tT", in: "text,image", outMod: "text", price: [2, 10, 2], release: "2024-08-20", updated: "2024-08-20", knowledge: "2024-08" },
  { id: "grok-2-vision-1212", name: "Grok 2 Vision (1212)", family: "grok-2", kind: "chat", ctx: 8192, out: 4096, caps: "tT", in: "text,image", outMod: "text", price: [2, 10, 2], release: "2024-08-20", updated: "2024-12-12", knowledge: "2024-08" },
  { id: "grok-2-vision-latest", name: "Grok 2 Vision Latest", family: "grok-2", kind: "chat", ctx: 8192, out: 4096, caps: "tT", in: "text,image", outMod: "text", price: [2, 10, 2], release: "2024-08-20", updated: "2024-12-12", knowledge: "2024-08" },
];
