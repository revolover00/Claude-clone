import { useState, useEffect } from "react";
import { Trash2, Pin, PinOff, Edit2, Check, Download, Search } from "lucide-react";
import { useChat } from "../../context/ChatContext";

interface Memory {
  id: string;
  content: string;
  category: "profile" | "preferences" | "work" | "projects" | "people" | "other";
  pinned: boolean;
  status: "active" | "archived";
}

export default function MemoryTab() {
  const { preferences, updatePreferences } = useChat();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memory");
      if (res.ok) {
        const data = await res.json();
        setMemories(data.filter((m: any) => m.status === "active"));
      }
    } catch (err) {
      console.error("Error loading memories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMemories(); }, []);

  const handleUpdateMemory = async (id: string, partial: Partial<Memory>) => {
    try {
      const res = await fetch(`/api/memory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial)
      });
      if (res.ok) {
        setMemories(prev => prev.map(m => m.id === id ? { ...m, ...partial } : m));
        if (editingId === id) setEditingId(null);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMemories(prev => prev.filter(m => m.id !== id));
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteAll = async () => {
    try {
      const res = await fetch("/api/memory/clear", { method: "POST" });
      if (res.ok) {
        setMemories([]);
        setConfirmClear(false);
      }
    } catch (err) { console.error(err); }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(memories, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `my-memories-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleTogglePref = (key: "memory_enabled" | "sensitive_memory") => {
    const val = !preferences[key as keyof typeof preferences];
    updatePreferences({ [key]: val });
    // Also sync with server in background
    fetch("/api/models?all=true").then(async () => {
      // In a real app we'd PATCH preferences, the client mock automatically updates localStorage preferences state.
    });
  };

  const filteredMemories = memories.filter(m => 
    m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ["profile", "preferences", "work", "projects", "people", "other"] as const;

  return (
    <div className="space-y-4 text-ink text-[13.5px] font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-medium text-ink">Personal Memory</h3>
          <p className="text-[12px] text-ink-muted">Manage the facts Claude remembers about you</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 rounded-lg border border-line bg-elev-3 px-2.5 py-1 text-[12px] hover:bg-elev-4 font-medium cursor-pointer">
          <Download size={13} /> Export JSON
        </button>
      </div>

      {/* Control Toggles */}
      <div className="rounded-xl border border-line bg-elev-2 p-3 space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="font-semibold text-ink">Generate memory from chat history</span>
            <p className="text-[11.5px] text-ink-muted">Allows Claude to continuously extract facts from conversations</p>
          </div>
          <input type="checkbox" checked={preferences.memory_enabled !== false} onChange={() => handleTogglePref("memory_enabled")} className="sr-only peer" />
          <div className="relative w-7 h-4 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-accent"></div>
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="font-semibold text-ink">Include sensitive information</span>
            <p className="text-[11.5px] text-ink-muted">Allows saving fields like personal health, finances, religion, etc.</p>
          </div>
          <input type="checkbox" checked={preferences.sensitive_memory === true} onChange={() => handleTogglePref("sensitive_memory")} className="sr-only peer" />
          <div className="relative w-7 h-4 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-accent"></div>
        </label>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search memories..." className="w-full rounded-lg border border-line bg-elev-2 pl-9 pr-4 py-1.5 text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent" />
      </div>

      {loading ? <div className="p-6 text-center text-ink-muted animate-pulse">Loading memories...</div> : (
        <div className="space-y-4 max-h-[220px] overflow-y-auto scroll-slim pr-1">
          {categories.map(cat => {
            const catMemories = filteredMemories.filter(m => m.category === cat);
            if (catMemories.length === 0) return null;
            return (
              <div key={cat} className="space-y-1.5">
                <span className="text-[11px] font-bold text-accent uppercase tracking-wider">{cat}</span>
                <div className="divide-y divide-line rounded-lg border border-line bg-elev-1 overflow-hidden">
                  {catMemories.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2.5 hover:bg-elev-2 text-[12.5px]">
                      {editingId === m.id ? (
                        <div className="flex-1 flex gap-2 pr-2">
                          <input type="text" value={editText} onChange={e => setEditText(e.target.value)} className="flex-1 rounded border border-line bg-shell px-2 py-0.5 text-[12.5px] text-ink" />
                          <button onClick={() => handleUpdateMemory(m.id, { content: editText })} className="p-1 text-emerald-400"><Check size={14} /></button>
                        </div>
                      ) : (
                        <span className="flex-1 text-ink-soft truncate">{m.content}</span>
                      )}
                      
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button onClick={() => handleUpdateMemory(m.id, { pinned: !m.pinned })} className="p-1 text-ink-muted hover:text-ink cursor-pointer">
                          {m.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                        </button>
                        <button onClick={() => { setEditingId(m.id); setEditText(m.content); }} className="p-1 text-ink-muted hover:text-ink cursor-pointer"><Edit2 size={13} /></button>
                        <button onClick={() => handleDeleteMemory(m.id)} className="p-1 text-danger hover:bg-danger-bg rounded cursor-pointer"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {filteredMemories.length === 0 && (
            <div className="p-8 text-center text-ink-muted">No memories saved yet. Claude will build memories from your chat sessions.</div>
          )}
        </div>
      )}

      {/* Clear All Section */}
      {memories.length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-danger-bg p-3.5 flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-danger">Clear All Memories</h4>
            <p className="text-[11.5px] text-ink-muted">This deletes all of your personal details stored across chats</p>
          </div>
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} className="rounded-lg bg-danger px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-danger-hover cursor-pointer">
              Delete All
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setConfirmClear(false)} className="rounded px-2.5 py-1 text-[12px] hover:bg-elev-3">Cancel</button>
              <button onClick={handleDeleteAll} className="rounded bg-danger px-3 py-1 text-[12px] font-medium text-white hover:bg-danger-hover">Confirm</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
