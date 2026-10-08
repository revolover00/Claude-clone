import { useState, useEffect } from "react";
import { Trash2, Play, Plus, ArrowUp, ArrowDown } from "lucide-react";
import AddModelForm from "./AddModelForm";

interface Model {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  provider: string;
  api_model_id: string;
  kind: "chat" | "light" | "embedding";
  supports_thinking: boolean;
  supports_search: boolean;
  supports_vision: boolean;
  max_output_tokens: number | null;
  enabled: boolean;
  is_default: boolean;
  sort_order: number;
}

interface DiscoverModel {
  name: string;
  displayName: string;
  description: string;
}

export default function ModelsTab() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [discoverList, setDiscoverList] = useState<DiscoverModel[]>([]);
  const [showDiscover, setShowDiscover] = useState(false);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { loading: boolean; text: string; ok: boolean }>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Model>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState<Partial<Model>>({
    slug: "", display_name: "", description: "", api_model_id: "", kind: "chat", provider: "google",
    supports_thinking: false, supports_search: false, supports_vision: false, enabled: true, is_default: false
  });

  const loadModels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/models?all=true");
      if (!res.ok) throw new Error("Failed to load models");
      const data = await res.json();
      setModels(data);
    } catch (err: any) {
      setError(err.message || "Error loading models");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadModels(); }, []);

  const handleToggleEnable = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      setModels(prev => prev.map(m => m.id === id ? { ...m, enabled } : m));
    } catch {
      setError("Failed to update status");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await fetch(`/api/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true })
      });
      setModels(prev => prev.map(m => m.id === id ? { ...m, is_default: true } : { ...m, is_default: false }));
      models.filter(m => m.id !== id && m.is_default).forEach(async (m) => {
        await fetch(`/api/models/${m.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_default: false })
        });
      });
    } catch { setError("Failed to set default"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await fetch(`/api/models/${id}`, { method: "DELETE" });
      setModels(prev => prev.filter(m => m.id !== id));
    } catch { setError("Failed to delete model"); }
  };

  const handleTestModel = async (id: string) => {
    setTestResults(prev => ({ ...prev, [id]: { loading: true, text: "Testing...", ok: false } }));
    try {
      const res = await fetch(`/api/models/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setTestResults(prev => ({ ...prev, [id]: { loading: false, text: `OK (${data.latencyMs}ms)`, ok: true } }));
      } else {
        setTestResults(prev => ({ ...prev, [id]: { loading: false, text: `Error: ${data.error}`, ok: false } }));
      }
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { loading: false, text: "Failed to connect", ok: false } }));
    }
  };

  const handleDiscover = async () => {
    setLoadingDiscover(true);
    setShowDiscover(true);
    try {
      const res = await fetch("/api/models/discover");
      if (!res.ok) throw new Error("Could not fetch models");
      const data = await res.json();
      setDiscoverList(data);
    } catch (err: any) {
      setError(err.message || "Failed to discover models");
    } finally {
      setLoadingDiscover(false);
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.slug || !newForm.display_name || !newForm.api_model_id) return;
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newForm, sort_order: models.length + 1 })
      });
      const added = await res.json();
      setModels(prev => [...prev, added]);
      setShowAdd(false);
      setNewForm({ slug: "", display_name: "", description: "", api_model_id: "", kind: "chat", provider: "google", supports_thinking: false, supports_search: false, supports_vision: false, enabled: true, is_default: false });
    } catch { setError("Failed to create model"); }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      const updated = await res.json();
      setModels(prev => prev.map(m => m.id === id ? updated : m));
      setEditingId(null);
    } catch { setError("Failed to update model"); }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= models.length) return;
    const newModels = [...models];
    const temp = newModels[index];
    newModels[index] = newModels[targetIdx];
    newModels[targetIdx] = temp;
    newModels.forEach((m, idx) => { m.sort_order = idx + 1; });
    setModels(newModels);
    newModels.forEach(async (m) => {
      await fetch(`/api/models/${m.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: m.sort_order })
      });
    });
  };

  if (loading) return <div className="p-8 text-center text-ink-muted">Loading models configurations...</div>;

  return (
    <div className="space-y-4 text-ink text-[13.5px]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-medium text-ink">Models Setup</h3>
          <p className="text-[11.5px] text-ink-muted">Manage system AI models and capability configurations</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-[12px] text-white hover:bg-accent/90 font-medium cursor-pointer">
          <Plus size={13} /> Add Model
        </button>
      </div>

      {error && <div className="rounded-lg bg-danger-bg border border-danger/25 text-danger p-2 text-[12px]">{error}</div>}

      {showAdd && (
        <AddModelForm
          newForm={newForm}
          onChange={(f, val) => setNewForm(prev => ({ ...prev, [f]: val }))}
          onSubmit={handleSaveAdd}
          onCancel={() => setShowAdd(false)}
          onDiscover={handleDiscover}
        />
      )}

      {showDiscover && (
        <div className="rounded-xl border border-line bg-elev-2 p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-ink-muted uppercase">
            <span>Available Google API Models</span>
            <button onClick={() => setShowDiscover(false)} className="hover:text-ink">Hide</button>
          </div>
          {loadingDiscover ? <div className="text-[11px] text-ink-muted animate-pulse">Querying list...</div> : (
            <div className="max-h-[120px] overflow-y-auto space-y-1 scroll-slim">
              {discoverList.map(m => (
                <button key={m.name} type="button" onClick={() => {
                  if (showAdd) setNewForm(f => ({ ...f, api_model_id: m.name, display_name: m.displayName || m.name }));
                  if (editingId) setEditForm(f => ({ ...f, api_model_id: m.name }));
                  setShowDiscover(false);
                }} className="flex w-full flex-col text-start p-1.5 hover:bg-elev-3 rounded text-[11px]">
                  <span className="font-semibold text-ink font-mono">{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {models.map((m, idx) => (
          <div key={m.id} className="p-3 bg-elev-1 hover:bg-elev-2 flex items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <button disabled={idx === 0} onClick={() => handleMove(idx, "up")} className="text-ink-muted hover:text-ink disabled:opacity-20 cursor-pointer"><ArrowUp size={12} /></button>
              <button disabled={idx === models.length - 1} onClick={() => handleMove(idx, "down")} className="text-ink-muted hover:text-ink disabled:opacity-20 cursor-pointer"><ArrowDown size={12} /></button>
            </div>

            <div className="flex-1 min-w-0">
              {editingId === m.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={editForm.display_name} onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} className="rounded border border-line bg-shell px-2 py-1 text-[12px] text-ink" placeholder="Name" />
                    <input type="text" value={editForm.api_model_id} onChange={e => setEditForm(f => ({ ...f, api_model_id: e.target.value }))} className="rounded border border-line bg-shell px-2 py-1 text-[12px] text-ink" placeholder="ID" />
                  </div>
                  <input type="text" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="w-full rounded border border-line bg-shell px-2 py-1 text-[12px] text-ink" placeholder="Description" />
                  <div className="flex gap-2 text-[11px]">
                    <button onClick={() => handleSaveEdit(m.id)} className="bg-accent text-white rounded px-2 py-0.5">Save</button>
                    <button onClick={() => setEditingId(null)} className="bg-elev-3 rounded px-2 py-0.5">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-ink">{m.display_name}</span>
                    <span className="text-[10px] font-mono text-ink-muted bg-shell px-1.5 py-0.2 rounded">{m.slug}</span>
                    <span className="text-[9px] uppercase font-bold text-accent border border-accent/20 px-1 rounded-full">{m.kind}</span>
                    {m.is_default && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-1.5 rounded-full font-semibold">default</span>}
                  </div>
                  <p className="text-[11.5px] text-ink-muted truncate mt-0.5">{m.description || "Conversational model."}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {testResults[m.id] && <span className={`text-[10.5px] font-mono font-medium ${testResults[m.id].ok ? "text-emerald-400" : "text-danger"}`}>{testResults[m.id].text}</span>}
              <button title="Test Model" onClick={() => handleTestModel(m.id)} className="p-1.5 rounded bg-shell border border-line hover:bg-elev-3 text-ink-muted hover:text-ink cursor-pointer"><Play size={12} /></button>
              {!m.is_default && m.enabled && <button onClick={() => handleSetDefault(m.id)} className="text-[11px] text-accent hover:underline cursor-pointer">Default</button>}
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" checked={m.enabled} onChange={e => handleToggleEnable(m.id, e.target.checked)} className="sr-only peer" />
                <div className="relative w-6 h-3.5 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-accent"></div>
              </label>
              <button onClick={() => { setEditingId(m.id); setEditForm(m); }} className="text-[11px] text-ink-muted hover:text-ink cursor-pointer">Edit</button>
              <button onClick={() => handleDelete(m.id)} className="p-1 text-danger hover:bg-danger-bg rounded cursor-pointer"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
