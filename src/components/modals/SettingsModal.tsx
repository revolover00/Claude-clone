import { useState, useEffect, useRef } from "react";
import { X, Sun, Moon, Download, Trash2, Check } from "lucide-react";
import { useChat } from "../../context/ChatContext";
import { useFocusTrap } from "../../utils/useFocusTrap";

export default function SettingsModal() {
  const {
    settingsModalOpen,
    setSettingsModalOpen,
    preferences,
    updatePreferences,
    conversations,
    clearAllData,
  } = useChat();

  const [activeTab, setActiveTab] = useState<"general" | "appearance" | "data">(
    "general"
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, settingsModalOpen, () => setSettingsModalOpen(false));

  useEffect(() => {
    if (settingsModalOpen) {
      setConfirmClear(false);
    }
  }, [settingsModalOpen]);

  if (!settingsModalOpen) return null;

  const handleExportData = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(conversations, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `claude-chats-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm font-sans"
      onClick={() => setSettingsModalOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-heading"
        className="anim-modal-in flex h-[500px] w-full max-w-[620px] overflow-hidden rounded-xl border border-line bg-elev-1 shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left tabs column */}
        <div className="w-48 shrink-0 border-r border-line bg-panel p-3">
          <h2 id="settings-heading" className="mb-3 px-2 text-[14.5px] font-semibold text-ink">
            Settings
          </h2>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition-colors ${
                activeTab === "general"
                  ? "bg-elev-3 text-ink"
                  : "text-ink-muted hover:bg-elev-2 hover:text-ink"
              }`}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("appearance")}
              className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition-colors ${
                activeTab === "appearance"
                  ? "bg-elev-3 text-ink"
                  : "text-ink-muted hover:bg-elev-2 hover:text-ink"
              }`}
            >
              Appearance
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("data")}
              className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition-colors ${
                activeTab === "data"
                  ? "bg-elev-3 text-ink"
                  : "text-ink-muted hover:bg-elev-2 hover:text-ink"
              }`}
            >
              Data
            </button>
          </nav>
        </div>

        {/* Right content column */}
        <div className="relative flex flex-1 flex-col overflow-y-auto p-6">
          <button
            type="button"
            onClick={() => setSettingsModalOpen(false)}
            className="absolute right-4 top-4 text-ink-muted hover:text-ink"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>

          {/* GENERAL TAB */}
          {activeTab === "general" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-[16px] font-medium text-ink">Account</h3>
                <p className="text-[13px] text-ink-muted">
                  Personal profile and workspace details
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[12.5px] font-medium text-ink-muted">
                    Display Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Nolen"
                    className="mt-1 w-full rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[14px] text-ink"
                  />
                </div>
                <div>
                  <label className="text-[12.5px] font-medium text-ink-muted">
                    Email
                  </label>
                  <input
                    type="text"
                    disabled
                    value="francesco.store.ss@gmail.com"
                    className="mt-1 w-full rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[14px] text-ink"
                  />
                </div>
                <div>
                  <label className="text-[12.5px] font-medium text-ink-muted">
                    Current Plan
                  </label>
                  <div className="mt-1 flex items-center justify-between rounded-lg border border-line bg-elev-2 px-3 py-2 text-[13.5px]">
                    <span className="font-medium text-ink">Free Plan</span>
                    <span className="text-[12px] text-accent font-medium">Standard quota</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-[16px] font-medium text-ink">Theme</h3>
                <p className="text-[13px] text-ink-muted">
                  Choose the visual appearance of Claude
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Dark Theme Card */}
                <button
                  type="button"
                  onClick={() => updatePreferences({ theme: "dark" })}
                  className={`flex flex-col items-start rounded-xl border p-4 text-start transition-all ${
                    preferences.theme === "dark"
                      ? "border-accent bg-elev-2 ring-1 ring-accent"
                      : "border-line bg-elev-1 hover:border-line-soft"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#211f1d] text-accent mb-3 border border-line">
                    <Moon size={20} />
                  </div>
                  <div className="flex items-center gap-1.5 font-medium text-ink text-[14px]">
                    <span>Dark</span>
                    {preferences.theme === "dark" && (
                      <Check size={14} className="text-accent" />
                    )}
                  </div>
                  <span className="text-[12px] text-ink-muted mt-0.5">
                    Warm dark obsidian
                  </span>
                </button>

                {/* Light Theme Card */}
                <button
                  type="button"
                  onClick={() => updatePreferences({ theme: "light" })}
                  className={`flex flex-col items-start rounded-xl border p-4 text-start transition-all ${
                    preferences.theme === "light"
                      ? "border-accent bg-elev-2 ring-1 ring-accent"
                      : "border-line bg-elev-1 hover:border-line-soft"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#faf9f5] text-[#d97757] mb-3 border border-[#e3dfd6]">
                    <Sun size={20} />
                  </div>
                  <div className="flex items-center gap-1.5 font-medium text-ink text-[14px]">
                    <span>Light</span>
                    {preferences.theme === "light" && (
                      <Check size={14} className="text-accent" />
                    )}
                  </div>
                  <span className="text-[12px] text-ink-muted mt-0.5">
                    Claude warm cream (#faf9f5)
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* DATA TAB */}
          {activeTab === "data" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-[16px] font-medium text-ink">Data Controls</h3>
                <p className="text-[13px] text-ink-muted">
                  Manage your chats and saved data
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-line bg-elev-2 p-3.5">
                  <div>
                    <h4 className="text-[14px] font-medium text-ink">Export Chats</h4>
                    <p className="text-[12.5px] text-ink-muted">
                      Download your conversations as a JSON file
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-elev-3 px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-elev-4"
                  >
                    <Download size={14} />
                    <span>Export</span>
                  </button>
                </div>

                <div className="rounded-xl border border-[#7d2d24]/50 bg-[#3a1a17]/20 p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[14px] font-medium text-[#f08578]">
                        Clear All Data
                      </h4>
                      <p className="text-[12.5px] text-ink-muted">
                        Permanently delete all chats, projects, and artifacts
                      </p>
                    </div>
                    {!confirmClear ? (
                      <button
                        type="button"
                        onClick={() => setConfirmClear(true)}
                        className="flex items-center gap-1.5 rounded-lg bg-[#68241d] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#852f26]"
                      >
                        <Trash2 size={14} />
                        <span>Clear Data</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmClear(false)}
                          className="rounded px-2.5 py-1 text-[12.5px] text-ink-muted hover:text-ink"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            clearAllData();
                            setSettingsModalOpen(false);
                          }}
                          className="rounded bg-[#a83428] px-3 py-1 text-[12.5px] font-medium text-white hover:bg-[#bd3d30]"
                        >
                          Confirm Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
