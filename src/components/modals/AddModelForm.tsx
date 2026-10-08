import { Plus, Layers } from "lucide-react";

interface AddModelFormProps {
  newForm: any;
  onChange: (field: string, value: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onDiscover: () => void;
}

export default function AddModelForm({
  newForm,
  onChange,
  onSubmit,
  onCancel,
  onDiscover
}: AddModelFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-line bg-elev-2 p-3.5 space-y-3.5 font-sans">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink">Add New Model</span>
        <button type="button" onClick={onDiscover} className="flex items-center gap-1.5 rounded-lg border border-line bg-elev-3 px-2 py-0.5 text-[11px] hover:bg-elev-4">
          <Layers size={11} /> Auto Discover
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-ink-muted uppercase">Display Name</label>
          <input required type="text" value={newForm.display_name} onChange={e => onChange("display_name", e.target.value)} className="w-full rounded-lg bg-shell px-2.5 py-1.5 mt-1 border border-line text-ink text-[12.5px]" />
        </div>
        <div>
          <label className="text-[10px] text-ink-muted uppercase">Slug</label>
          <input required type="text" value={newForm.slug} onChange={e => onChange("slug", e.target.value)} className="w-full rounded-lg bg-shell px-2.5 py-1.5 mt-1 border border-line text-ink text-[12.5px]" />
        </div>
        <div>
          <label className="text-[10px] text-ink-muted uppercase">API Model ID</label>
          <input required type="text" value={newForm.api_model_id} onChange={e => onChange("api_model_id", e.target.value)} className="w-full rounded-lg bg-shell px-2.5 py-1.5 mt-1 border border-line text-ink text-[12.5px]" />
        </div>
        <div>
          <label className="text-[10px] text-ink-muted uppercase">Kind</label>
          <select value={newForm.kind} onChange={e => onChange("kind", e.target.value)} className="w-full rounded-lg bg-shell px-2.5 py-1.5 mt-1 border border-line text-ink text-[12.5px]">
            <option value="chat">Chat</option>
            <option value="light">Light</option>
            <option value="embedding">Embedding</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] text-ink-muted uppercase">Description</label>
        <input type="text" value={newForm.description} onChange={e => onChange("description", e.target.value)} className="w-full rounded-lg bg-shell px-2.5 py-1.5 mt-1 border border-line text-ink text-[12.5px]" />
      </div>
      <div className="flex flex-wrap gap-4 text-[11.5px]">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={newForm.supports_thinking} onChange={e => onChange("supports_thinking", e.target.checked)} /> Thinking
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={newForm.supports_search} onChange={e => onChange("supports_search", e.target.checked)} /> Search
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={newForm.supports_vision} onChange={e => onChange("supports_vision", e.target.checked)} /> Vision
        </label>
      </div>
      <div className="flex justify-end gap-2 text-[11.5px]">
        <button type="button" onClick={onCancel} className="rounded px-3 py-1 hover:bg-elev-3">Cancel</button>
        <button type="submit" className="rounded bg-accent text-white px-3 py-1 flex items-center gap-1"><Plus size={12} /> Save Model</button>
      </div>
    </form>
  );
}
