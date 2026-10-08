import { useState, useEffect, useRef } from "react";
import { X, Sun, Moon, Download, Trash2, Check } from "lucide-react";
import { useChat } from "../../context/ChatContext";
import { useFocusTrap } from "../../utils/useFocusTrap";
import ModelsTab from "./ModelsTab";
import MemoryTab from "./MemoryTab";

export default function SettingsModal() {
  const {
    settingsModalOpen, setSettingsModalOpen, preferences, updatePreferences, conversations, clearAllData,
  } = useChat();

  const [activeTab, setActiveTab] = useState<"general" | "appearance" | "data" | "models" | "memory">("general");
  const [confirmClear, setConfirmClear] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, settingsModalOpen, () => setSettingsModalOpen(false));

  useEffect(() => {
    if (settingsModalOpen) {
      setConfirmClear(false);
      const targetTab = localStorage.getItem("claude_clone_settings_tab");
      if (targetTab === "memory" || targetTab === "models" || targetTab === "general" || targetTab === "appearance" || targetTab === "data") {
        setActiveTab(targetTab as any);
        localStorage.removeItem("claude_clone_settings_tab");
      } else {
        setActiveTab("general");
      }
      fetch("/api/models?all=true")
        .then(res => setIsAdmin(res.ok))
        .catch(() => setIsAdmin(false));
    }
  }, [settingsModalOpen]);

  if (!settingsModalOpen) return null;

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(conversations, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `claude-chats-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const TabBtn = ({ id, label }: { id: typeof activeTab; label: string }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition-colors cursor-pointer ${
        activeTab === id ? "bg-elev-3 text-ink" : "text-ink-muted hover:bg-elev-2 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm font-sans" onClick={() => setSettingsModalOpen(false)}>
      <div ref={dialogRef} role="dialog" aria-modal="true" className="anim-modal-in flex h-[500px] w-full max-w-[620px] overflow-hidden rounded-xl border border-line bg-elev-1 shadow-[0_24px_64px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
        <div className="w-44 shrink-0 border-r border-line bg-panel p-3">
          <h2 className="mb-3 px-2 text-[14px] font-semibold text-ink">Settings</h2>
          <nav className="space-y-1">
            <TabBtn id="general" label="Profile" />
            <TabBtn id="appearance" label="Appearance" />
            <TabBtn id="data" label="Data" />
            <TabBtn id="memory" label="Memory" />
            {isAdmin && <TabBtn id="models" label="Models" />}
          </nav>
        </div>

        <div className="relative flex flex-1 flex-col overflow-y-auto p-6">
          <button type="button" onClick={() => setSettingsModalOpen(false)} className="absolute right-4 top-4 text-ink-muted hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>

          {activeTab === "general" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[15.5px] font-medium text-ink">Profile</h3>
                <p className="text-[12.5px] text-ink-muted">Personal profile details</p>
              </div>
              <div>
                <label className="text-[12px] font-medium text-ink-muted">Your Name</label>
                <input type="text" value={preferences.userName ?? "You"} onChange={e => updatePreferences({ userName: e.target.value })} placeholder="You" className="mt-1 w-full rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[13.5px] text-ink focus:outline-none focus:border-accent" />
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[15.5px] font-medium text-ink">Theme</h3>
                <p className="text-[12.5px] text-ink-muted">Choose the appearance of the interface</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: "dark", label: "Dark", desc: "Warm dark obsidian", bg: "bg-[#211f1d]", icon: <Moon size={18} /> },
                  { id: "light", label: "Light", desc: "Claude warm cream", bg: "bg-[#faf9f5]", icon: <Sun size={18} /> }
                ].map(t => (
                  <button key={t.id} type="button" onClick={() => updatePreferences({ theme: t.id as any })} className={`flex flex-col items-start rounded-xl border p-4 text-start transition-all ${preferences.theme === t.id ? "border-accent bg-elev-2 ring-1 ring-accent" : "border-line bg-elev-1 hover:border-line-soft"}`}>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.bg} text-accent mb-3 border border-line`}>{t.icon}</div>
                    <div className="flex items-center gap-1 font-medium text-ink text-[13.5px]">
                      <span>{t.label}</span>
                      {preferences.theme === t.id && <Check size={13} className="text-accent" />}
                    </div>
                    <span className="text-[11.5px] text-ink-muted mt-0.5">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "data" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[15.5px] font-medium text-ink">Data Controls</h3>
                <p className="text-[12.5px] text-ink-muted">Manage your chats and saved data</p>
              </div>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between rounded-xl border border-line bg-elev-2 p-3">
                  <div>
                    <h4 className="text-[13.5px] font-medium text-ink">Export Chats</h4>
                    <p className="text-[11.5px] text-ink-muted">Download as JSON</p>
                  </div>
                  <button type="button" onClick={handleExportData} className="flex items-center gap-1.5 rounded-lg border border-line bg-elev-3 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-elev-4">
                    <Download size={13} /> Export
                  </button>
                </div>

                <div className="rounded-xl border border-danger/30 bg-danger-bg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[13.5px] font-medium text-danger">Clear All Data</h4>
                      <p className="text-[11.5px] text-ink-muted">Permanently delete everything</p>
                    </div>
                    {!confirmClear ? (
                      <button type="button" onClick={() => setConfirmClear(true)} className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-[12px] font-medium text-white hover:bg-danger-hover">
                        <Trash2 size={13} /> Clear
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setConfirmClear(false)} className="rounded px-2 py-1 text-[12px] text-ink-muted hover:text-ink">Cancel</button>
                        <button type="button" onClick={() => { clearAllData(); setSettingsModalOpen(false); }} className="rounded bg-danger px-2.5 py-1 text-[12px] font-medium text-white hover:bg-danger-hover">Confirm</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "models" && <ModelsTab />}
          {activeTab === "memory" && <MemoryTab />}
        </div>
      </div>
    </div>
  );
}
