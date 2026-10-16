import type { UnifiedModel } from "./types";

/**
 * Row -> UnifiedModel adapters and provider label helpers shared by the
 * composer model picker (extracted to keep useComposerModels lean).
 */

export const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Google AI Studio",
  google: "Google AI Studio",
  groq: "Groq",
  openrouter: "OpenRouter",
  app: "App models",
};

export function getProviderLabel(providerId?: string): string {
  if (!providerId) return "App models";
  const lower = providerId.toLowerCase();
  return PROVIDER_LABELS[lower] || providerId;
}

export function labelFor(labels: Record<string, string>, providerId: string): string {
  return labels[providerId] || getProviderLabel(providerId);
}

export function pushUnique(list: UnifiedModel[], seen: Set<string>, model: UnifiedModel) {
  if (seen.has(model.uniqueKey)) return;
  seen.add(model.uniqueKey);
  list.push(model);
}

/** Flat GET /api/catalog row -> UnifiedModel (connected flag drives requiresKey). */
export function fromCatalogRow(m: any, labels: Record<string, string>): UnifiedModel {
  const provider = String(m.provider || "unknown");
  return {
    id: m.model_id,
    uniqueKey: `${provider}:${m.model_id}`,
    provider,
    providerLabel: labelFor(labels, provider),
    displayName: m.alias || m.display_name || m.name || m.model_id,
    alias: m.alias || null,
    description: m.description || null,
    contextLength: m.context_length ?? null,
    family: m.family ?? null,
    vendor: m.vendor ?? null,
    status: m.status || "active",
    recommended: Boolean(m.recommended),
    releasedAt: m.released_at ?? null,
    firstSeenAt: m.first_seen_at ?? null,
    isFree: Boolean(m.is_free),
    supportsThinking: Boolean(m.supports_reasoning),
    supportsTools: Boolean(m.supports_tools),
    supportsVision: Boolean(m.supports_vision),
    supportsSearch: provider === "gemini" || provider === "google",
    pricing: m.pricing || null,
    isEnabled: m.enabled !== false,
    isPinned: Boolean(m.pinned),
    kind: m.kind || "chat",
    requiresKey: m.connected === false,
  };
}

/** Legacy grouped /api/catalog payload row -> UnifiedModel. */
export function fromLegacyRow(providerId: string, label: string, m: any, requiresKey: boolean): UnifiedModel {
  return {
    id: m.id,
    uniqueKey: `${providerId}:${m.id}`,
    provider: providerId,
    providerLabel: label,
    displayName: m.displayName || m.name || m.id,
    alias: m.alias || null,
    description: m.description || null,
    contextLength: m.contextLength ?? null,
    family: m.family ?? null,
    vendor: m.vendor ?? null,
    status: m.status || "active",
    recommended: Boolean(m.recommended),
    supportsThinking: Boolean(m.supportsReasoning || m.supports_thinking),
    supportsTools: Boolean(m.supportsTools || m.supports_tools),
    supportsVision: Boolean(m.supportsVision || m.supports_vision),
    supportsSearch: Boolean(m.supportsSearch || m.supports_search),
    pricing: m.pricing || null,
    isEnabled: m.isEnabled !== false,
    isPinned: Boolean(m.isPinned),
    kind: m.kind || "chat",
    requiresKey,
  };
}

/**
 * Composer model picker data: live catalogs for connected providers, the full
 * catalog (every provider, connected or not) and the app's own Gemini list.
 * Sections are ordered Recommended -> pinned -> provider/vendor groups.
 */
