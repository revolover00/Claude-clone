import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Search, ThumbsUp } from "lucide-react";
import { GroupedCatalogList } from "../shared/GroupedCatalogList";
import { ModelBadges } from "../shared/ModelBadges";
import { SyncPanel } from "./catalog/SyncPanel";
import { formatContext } from "../providers/ModelRow";
import { PricingBadge } from "../shared/PricingBadge";
import { hasFreeTier } from "../../shared/catalog/freeTier";
import { SettingsErrorCard } from "../shared/SettingsErrorCard";
import { safeFetchJson, authFetch } from "../../utils/safeFetch";
import { cn } from "../../utils/cn";
import type { GroupableModel } from "../../shared/catalog/grouping";

interface OverrideRow {
  provider: string;
  model_id: string;
  hidden: boolean;
  force_recommended: boolean;
  alias: string | null;
}

/**
 * Settings > Models is now the read-only "Model Catalog": the synced catalog
 * with admin curation through catalog_overrides (hide, force-recommend, alias)
 * and a per-provider "Sync now" button with the catalog_sync_runs history.
 */
export default function ModelsTab() {
  const [models, setModels] = useState<GroupableModel[]>([]);
  const [providers, setProviders] = useState<Array<{ id: string; label: string; modelCount: number }>>([]);
  const [syncable, setSyncable] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [source, setSource] = useState("catalog");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await safeFetchJson<any>("/api/catalog?all=1");
      setModels(Array.isArray(data.models) ? data.models : []);
      setProviders(Array.isArray(data.providers) ? data.providers : []);
      setSyncable(Array.isArray(data.syncable) ? data.syncable : []);
      setSource(data.source || "catalog");
      const admin = Boolean(data.is_admin);
      setIsAdmin(admin);
      if (admin) {
        try {
          const res = await authFetch("/api/catalog/overrides");
          if (res.ok) {
            const body = await res.json();
            setOverrides(Array.isArray(body.overrides) ? body.overrides : []);
          }
        } catch {
          /* curation list is best-effort */
        }
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overrideMap = useMemo(
    () => new Map(overrides.map((o) => [`${o.provider}:${o.model_id}`, o])),
    [overrides]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m: any) =>
      `${m.name} ${m.model_id} ${m.vendor} ${m.family} ${m.alias || ""}`.toLowerCase().includes(q)
    );
  }, [models, search]);

  const saveOverride = useCallback(
    async (model: GroupableModel, patch: Record<string, unknown>) => {
      const res = await authFetch("/api/catalog/overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: model.provider, model_id: model.model_id || model.id, ...patch }),
      });
      if (!res.ok) return;
      const body = await res.json().catch(() => null);
      if (body?.override) {
        setOverrides((prev) => {
          const key = `${body.override.provider}:${body.override.model_id}`;
          const next = prev.filter((o) => `${o.provider}:${o.model_id}` !== key);
          next.push(body.override);
          return next;
        });
      }
    },
    []
  );

  const renderRow = (model: GroupableModel) => {
    const row = model as any;
    const override = overrideMap.get(`${model.provider}:${row.model_id || model.id}`);
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-elev-1 px-2.5 py-2 hover:border-line-hover transition-colors">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[13px] font-semibold text-ink truncate">{model.alias || row.name}</span>
          <span className="text-[10.5px] font-mono text-ink-faint truncate max-w-[220px]">{row.model_id || model.id}</span>
          <span className="text-[10px] uppercase font-mono rounded border border-line bg-elev-2 px-1.5 py-0.2 text-ink-muted">{model.provider}</span>
          <span className="text-[10.5px] text-ink-muted">{model.vendor}</span>
          <span className="text-[10.5px] text-ink-muted">· {model.family}</span>
          <ModelBadges model={model} hidden={override?.hidden} />
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-ink-muted font-mono">
          <span>{formatContext(row.context_length)} ctx</span>
          <span>·</span>
          <PricingBadge pricing={row.pricing} isFree={row.is_free} freeTier={hasFreeTier(model.provider)} />
          <span>·</span>
          <span className="capitalize">{row.kind}</span>
          {isAdmin && (
            <span className="ml-auto flex items-center gap-1.5 font-sans">
              <button
                type="button"
                onClick={() => void saveOverride(model, { hidden: !override?.hidden })}
                title={override?.hidden ? "Unhide from everyone" : "Hide from non-admins"}
                className={cn(
                  "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] cursor-pointer transition-colors",
                  override?.hidden ? "border-danger/40 bg-danger-bg text-danger" : "border-line bg-elev-2 text-ink-muted hover:text-ink"
                )}
              >
                {override?.hidden ? <EyeOff size={11} /> : <Eye size={11} />} Hide
              </button>
              <button
                type="button"
                onClick={() => void saveOverride(model, { force_recommended: !override?.force_recommended })}
                title="Force this model to be recommended"
                className={cn(
                  "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] cursor-pointer transition-colors",
                  override?.force_recommended ? "border-accent/40 bg-accent/10 text-accent" : "border-line bg-elev-2 text-ink-muted hover:text-ink"
                )}
              >
                <ThumbsUp size={11} /> Force recommend
              </button>
              <AliasEditor initial={override?.alias || ""} onSave={(alias) => void saveOverride(model, { alias })} />
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-ink text-[13.5px]">
      <div>
        <h3 className="text-[16px] font-medium text-ink">Model Catalog</h3>
        <p className="text-[11.5px] text-ink-muted">
          Read-only {source === "bundled" ? "bundled snapshot (the synced catalog is still empty)" : "synced catalog"} —
          models are discovered automatically, never added by hand.
          {isAdmin ? " Curation below writes catalog_overrides." : " Admins can curate and sync here."}
        </p>
      </div>

      {isAdmin && <SyncPanel providers={providers} syncable={syncable} onChanged={() => void load()} />}

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models, vendors, families..."
          className="w-full rounded-lg border border-line bg-elev-2 pl-8 pr-3 py-1.5 text-[12.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
        />
      </div>

      {error && <SettingsErrorCard onRetry={() => void load()} error={error} />}

      <GroupedCatalogList
        models={filtered as GroupableModel[]}
        renderRow={(m) => renderRow(m)}
        loading={loading}
        emptyMessage="No models match your search."
        viewportHeight={420}
      />
    </div>
  );
}

function AliasEditor({ initial, onSave }: { initial: string; onSave: (alias: string) => void }) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  useEffect(() => setValue(initial), [initial]);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={initial ? `Alias: ${initial}` : "Set a display alias"}
        className={cn(
          "rounded border px-1.5 py-0.5 text-[10.5px] cursor-pointer",
          initial ? "border-accent/40 bg-accent/10 text-accent" : "border-line bg-elev-2 text-ink-muted hover:text-ink"
        )}
      >
        {initial ? `Alias: ${initial}` : "Alias"}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <input
        type="text"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(value.trim());
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="Display alias"
        className="w-28 rounded border border-line bg-shell px-1.5 py-0.5 text-[10.5px] text-ink focus:outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={() => {
          onSave(value.trim());
          setEditing(false);
        }}
        className="text-accent text-[10.5px] cursor-pointer"
      >
        Save
      </button>
    </span>
  );
}
