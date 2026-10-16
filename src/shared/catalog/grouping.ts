/**
 * Pure grouping / ordering helpers shared by the settings Model Catalog,
 * the Providers > Models browser and the composer model picker.
 *
 * Hierarchy: Provider -> Vendor -> Family, with collapsible groups, counts and
 * deterministic composer ordering (Recommended, then pinned, then provider /
 * vendor groups). Unit-tested in tests/catalogGrouping.test.ts.
 */

export interface GroupableModel {
  provider: string;
  vendor?: string | null;
  family?: string | null;
  kind?: string;
  status?: string | null;
  recommended?: boolean;
  pinned?: boolean;
  released_at?: string | null;
  first_seen_at?: string | null;
  [key: string]: any;
}

export type GroupLevel = "provider" | "vendor" | "family";

export interface ModelGroupNode {
  key: string;
  title: string;
  level: GroupLevel;
  count: number;
  children: ModelGroupNode[];
  models: GroupableModel[];
}

function bucket(models: GroupableModel[], keyOf: (m: GroupableModel) => string): Map<string, GroupableModel[]> {
  const map = new Map<string, GroupableModel[]>();
  for (const model of models) {
    const key = keyOf(model);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(model);
  }
  return map;
}

/** Provider -> vendor -> family tree with counts at every level. */
export function groupHierarchy(models: GroupableModel[]): ModelGroupNode[] {
  const providers = bucket(models, (m) => m.provider);
  return [...providers.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
    .map(([provider, providerModels]) => {
      const vendorBuckets = bucket(providerModels, (m) => m.vendor || provider);
      const children = [...vendorBuckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([vendor, vendorModels]) => {
          const familyBuckets = bucket(vendorModels, (m) => m.family || m.vendor || vendor);
          const familyChildren = [...familyBuckets.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([family, familyModels]) => ({
              key: `${provider}/${vendor}/${family}`,
              title: family,
              level: "family" as GroupLevel,
              count: familyModels.length,
              children: [],
              models: [...familyModels].sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id))),
            }));
          return {
            key: `${provider}/${vendor}`,
            title: vendor,
            level: "vendor" as GroupLevel,
            count: vendorModels.length,
            children: familyChildren,
            models: [],
          };
        });
      return {
        key: provider,
        title: provider,
        level: "provider" as GroupLevel,
        count: providerModels.length,
        children,
        models: [],
      };
    });
}

export interface FlatRow {
  type: "header" | "model";
  level?: GroupLevel;
  key: string;
  title?: string;
  count?: number;
  depth: number;
  model?: GroupableModel;
}

/** Flattens the tree honoring collapsed keys (headers + model rows). */
export function flattenHierarchy(nodes: ModelGroupNode[], collapsed: Set<string>): FlatRow[] {
  const rows: FlatRow[] = [];
  const walk = (node: ModelGroupNode, depth: number) => {
    rows.push({ type: "header", level: node.level, key: node.key, title: node.title, count: node.count, depth });
    if (collapsed.has(node.key)) return;
    node.models.forEach((model, index) => {
      rows.push({ type: "model", key: `${node.key}#${model.provider}:${model.id || index}`, depth: depth + 1, model });
    });
    node.children.forEach((child) => walk(child, depth + 1));
  };
  nodes.forEach((node) => walk(node, 0));
  return rows;
}

export interface PickerSection {
  id: string;
  title: string;
  models: GroupableModel[];
}

/**
 * Composer order: Recommended first, then pinned, then provider/vendor groups.
 * `labelOf` maps a provider id to its display label; `order` keeps groups in
 * registry order.
 */
export function composerSections(
  models: GroupableModel[],
  labelOf: (provider: string) => string = (p) => p,
  order: string[] = []
): PickerSection[] {
  const byRegistry = (a: string, b: string) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia >= 0 ? ia : 900 + order.length) - (ib >= 0 ? ib : 900 + order.length) || a.localeCompare(b);
  };

  const sections: PickerSection[] = [];
  const recommended = models.filter((m) => m.recommended);
  if (recommended.length > 0) sections.push({ id: "recommended", title: "Recommended", models: recommended });
  const pinned = models.filter((m) => m.pinned && !m.recommended);
  if (pinned.length > 0) sections.push({ id: "pinned", title: "Pinned", models: pinned });

  const rest = models.filter((m) => !m.recommended && !m.pinned);
  const providers = [...new Set(rest.map((m) => m.provider))].sort(byRegistry);
  for (const provider of providers) {
    const providerModels = rest.filter((m) => m.provider === provider);
    const vendors = [...new Set(providerModels.map((m) => m.vendor || provider))].sort();
    for (const vendor of vendors) {
      const vendorModels = providerModels.filter((m) => (m.vendor || provider) === vendor);
      sections.push({
        id: `${provider}/${vendor}`,
        title: vendors.length > 1 ? `${labelOf(provider)} · ${vendor}` : labelOf(provider),
        models: [...vendorModels].sort((a, b) => {
          const kindRank = (m: GroupableModel) => (m.kind && m.kind !== "chat" ? 1 : 0);
          if (kindRank(a) !== kindRank(b)) return kindRank(a) - kindRank(b);
          return String(a.name || a.id).localeCompare(String(b.name || b.id));
        }),
      });
    }
  }
  return sections;
}

/** "New" badge: first seen in the last 14 days. */
export function isNewModel(firstSeenAt?: string | null, now = Date.now()): boolean {
  if (!firstSeenAt) return false;
  const at = Date.parse(firstSeenAt);
  return Number.isFinite(at) && now - at <= 14 * 24 * 60 * 60 * 1000;
}

export function modelStatus(model: GroupableModel): string {
  return model.status || "active";
}

export function isUnavailableStatus(model: GroupableModel): boolean {
  return model.status === "deprecated" || model.status === "removed";
}

/**
 * The closest recommended model to `target`: same family first, then the same
 * provider, then any recommended chat model (newest release wins). Used for
 * the one-click switch offered when a chat uses a deprecated/removed model.
 */
export function closestRecommendedModel<T extends GroupableModel>(target: T | null | undefined, candidates: T[]): T | null {
  const recommended = candidates.filter((c) => c.recommended && !isUnavailableStatus(c)) as T[];
  if (recommended.length === 0) return null;
  const pick = (pool: T[]): T | null =>
    [...pool].sort((a, b) => String(b.released_at || "").localeCompare(String(a.released_at || "")))[0] || null;
  if (target) {
    const family = recommended.filter((c) => c.provider === target.provider && c.family === target.family);
    if (family.length > 0) return pick(family);
    const sameProvider = recommended.filter((c) => c.provider === target.provider);
    if (sameProvider.length > 0) return pick(sameProvider);
  }
  return pick(recommended.filter((c) => !c.kind || c.kind === "chat")) || pick(recommended);
}
