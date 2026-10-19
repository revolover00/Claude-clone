import { describe, it, expect } from "vitest";
import {
  closestRecommendedModel,
  composerSections,
  flattenHierarchy,
  groupHierarchy,
  isNewModel,
} from "../src/shared/catalog/grouping";

type M = {
  id: string;
  provider: string;
  name: string;
  vendor?: string;
  family?: string;
  kind?: string;
  status?: string;
  released_at?: string;
  recommended?: boolean;
  pinned?: boolean;
  enabled?: boolean;
  [k: string]: unknown;
};

function row(id: string, provider: string, name: string, over: Partial<M> = {}): M {
  return {
    id,
    provider,
    name,
    vendor: "Meta",
    family: name.split(" ")[0],
    status: "active",
    released_at: "2026-01-01",
    enabled: true,
    ...over,
  };
}

describe("groupHierarchy", () => {
  const models = [
    row("llama-4", "groq", "Llama 4 Scout", { vendor: "Meta", family: "Llama 4", recommended: true }),
    row("llama-3.3", "groq", "Llama 3.3 70B", { vendor: "Meta", family: "Llama 3.3" }),
    row("gemma-3", "groq", "Gemma 3n", { vendor: "Google", family: "Gemma 3" }),
    row("gemini-3.8-flash", "gemini", "Gemini 3.8 Flash", { vendor: "Google", family: "Gemini 3.8 Flash" }),
  ];

  it("builds a provider → vendor → family tree with counts", () => {
    const nodes = groupHierarchy(models);
    expect(nodes.map((n) => n.key)).toEqual(["gemini", "groq"]);
    expect(nodes.map((n) => n.count)).toEqual([1, 3]);

    const groq = nodes[1];
    expect(groq.children.map((c) => c.title)).toEqual(["Google", "Meta"]);
    const meta = groq.children[1];
    expect(meta.count).toBe(2);
    expect(meta.children.map((c) => c.title)).toEqual(["Llama 3.3", "Llama 4"]);
    const llama4 = meta.children[1];
    expect(llama4.count).toBe(1);
    expect(llama4.models[0].name).toBe("Llama 4 Scout");
    expect(meta.models).toHaveLength(0); // models live on family nodes
  });

  it("flattens headers and model rows honoring collapsed keys", () => {
    const nodes = groupHierarchy(models);
    const all = flattenHierarchy(nodes, new Set());
    const headers = all.filter((r) => r.type === "header").map((r) => r.key);
    expect(headers).toEqual([
      "gemini",
      "gemini/Google",
      "gemini/Google/Gemini 3.8 Flash",
      "groq",
      "groq/Google",
      "groq/Google/Gemma 3",
      "groq/Meta",
      "groq/Meta/Llama 3.3",
      "groq/Meta/Llama 4",
    ]);
    const modelRows = all.filter((r) => r.type === "model");
    expect(modelRows).toHaveLength(4);
    expect(modelRows.every((r) => r.model && r.depth > 0)).toBe(true);

    const collapsed = flattenHierarchy(nodes, new Set(["groq"]));
    const collapsedKeys = collapsed.map((r) => r.key);
    expect(collapsedKeys).toContain("groq"); // header stays
    expect(collapsedKeys.some((k) => k.startsWith("groq/"))).toBe(false); // children hidden
    expect(collapsedKeys.some((k) => k.includes("llama"))).toBe(false);
  });
});

describe("isNewModel", () => {
  it("is true only within 14 days of first seen", () => {
    const now = Date.now();
    const DAY = 86400000;
    expect(isNewModel(new Date(now - 2 * DAY).toISOString(), now)).toBe(true);
    expect(isNewModel(new Date(now - 14 * DAY).toISOString(), now)).toBe(true);
    expect(isNewModel(new Date(now - 15 * DAY).toISOString(), now)).toBe(false);
    expect(isNewModel(null, now)).toBe(false);
    expect(isNewModel(undefined, now)).toBe(false);
  });
});

describe("closestRecommendedModel", () => {
  const candidates = [
    row("llama-3.3", "groq", "Llama 3.3 70B", { family: "Llama 3.3", released_at: "2025-01-01" }),
    row("llama-3.1", "groq", "Llama 3.1 8B", { family: "Llama 3.1", released_at: "2024-08-01" }),
    row("llama-4", "groq", "Llama 4 Scout", { family: "Llama 4", recommended: true, released_at: "2025-04-01" }),
    row("gemma-3", "groq", "Gemma 3n", { family: "Gemma 3", recommended: true, released_at: "2025-03-01" }),
    row("gemini-3.8-flash", "gemini", "Gemini 3.8 Flash", { vendor: "Google", family: "Gemini 3.8 Flash", recommended: true, released_at: "2026-06-01" }),
    row("dead-model", "groq", "Dead Model", { family: "Dead", recommended: true, status: "removed", released_at: "2027-01-01" }),
  ] as any[];

  it("prefers exact family, then same provider, then any recommended chat model", () => {
    // Exact family + provider match wins.
    const exact = row("llama-4-turbo", "groq", "Llama 4 Turbo", { family: "Llama 4" }) as any;
    expect(closestRecommendedModel(exact, candidates)!.id).toBe("llama-4");

    // Same provider, newest recommended release wins (unavailable excluded).
    const sameProvider = row("llama-3.9", "groq", "Llama 3.9", { family: "Llama 3.9" }) as any;
    expect(closestRecommendedModel(sameProvider, candidates)!.id).toBe("llama-4");

    // No provider overlap -> newest recommended chat model overall.
    const stranger = row("mystery", "openrouter", "Mystery", { vendor: "Other", family: "Mystery" }) as any;
    expect(closestRecommendedModel(stranger, candidates)!.id).toBe("gemini-3.8-flash");

    expect(closestRecommendedModel(stranger, [])).toBeNull();
    const onlyUnavailable = candidates.filter((c) => c.status === "removed");
    expect(closestRecommendedModel(stranger, onlyUnavailable)).toBeNull();
  });
});

describe("composerSections", () => {
  const labelOf = (p: string) => (p === "gemini" ? "Gemini" : p === "groq" ? "Groq" : "OpenRouter");
  const models = [
    row("pinned-1", "groq", "Pinned Model", { pinned: true, recommended: false }),
    row("rec-1", "groq", "Recommended One", { recommended: true }),
    row("plain-1", "gemini", "Plain One", { vendor: "Google" }),
    row("plain-2", "openrouter", "Plain Two", { vendor: "Qwen" }),
  ] as any[];

  it("puts recommended first, then pinned, then provider/vendor groups", () => {
    const sections = composerSections(models, labelOf, []);
    expect(sections.map((s) => s.id)).toEqual(["recommended", "pinned", "gemini/Google", "openrouter/Qwen"]);
    expect(sections[0].title).toBe("Recommended");
    expect(sections[0].models.map((m) => m.id)).toEqual(["rec-1"]);
    expect(sections[1].models.map((m) => m.id)).toEqual(["pinned-1"]);
    // Single-vendor provider groups use the plain provider label.
    expect(sections[2].title).toBe("Gemini");
    expect(sections[3].title).toBe("OpenRouter");

    // A pinned+recommended model shows only under Recommended.
    const both = composerSections(
      [row("x", "groq", "Both", { pinned: true, recommended: true })] as any[],
      labelOf,
      []
    );
    expect(both.map((s) => s.id)).toEqual(["recommended"]);
    expect(both[0].models.map((m) => m.id)).toEqual(["x"]);
  });

  it("suffixes the group title with the vendor when a provider has several vendors", () => {
    const multi = composerSections([...models, row("plain-3", "openrouter", "Plain Three", { vendor: "Google" })] as any[], labelOf, []);
    const ids = multi.map((s) => s.id);
    expect(ids).toContain("openrouter/Qwen");
    expect(ids).toContain("openrouter/Google");
    const qwen = multi.find((s) => s.id === "openrouter/Qwen")!;
    expect(qwen.title).toBe("OpenRouter · Qwen");
  });

  it("honors a custom provider order", () => {
    const sections = composerSections(models, labelOf, ["openrouter", "groq", "gemini"]);
    expect(sections.slice(2).map((s) => s.id)).toEqual(["openrouter/Qwen", "gemini/Google"]);
  });
});
