import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check, Search, Key } from "lucide-react";
import { cn } from "../../utils/cn";
import { useChat } from "../../context/ChatContext";
import { useComposerModels } from "./modelPicker/useComposerModels";
import { ModelPickerItem } from "./modelPicker/ModelPickerItem";

export const EFFORTS = ["Low", "Medium", "High"] as const;
export type Effort = (typeof EFFORTS)[number];
export type ModelId = string;

interface Props {
  model: string;
  onSelectModel: (m: string) => void;
  effort: Effort;
  onSelectEffort: (e: Effort) => void;
  onOpenStateChange?: (open: boolean) => void;
}

export default function ModelMenu({
  model,
  onSelectModel,
  effort,
  onSelectEffort,
  onOpenStateChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setSettingsModalOpen } = useChat();

  const {
    allModels,
    groupedProviders,
    activeModelObj,
    pillLabel,
    searchQuery,
    setSearchQuery,
    loading,
  } = useComposerModels(model);

  // Sync the initial selection once every source (bundled catalog, live catalogs,
  // app models) has loaded, so the default never overrides a still-loading pick.
  useEffect(() => {
    if (loading) return;
    if (activeModelObj && model !== activeModelObj.uniqueKey && model !== activeModelObj.id) {
      const saved = localStorage.getItem("claude_clone_last_model");
      if (!saved) {
        onSelectModel(activeModelObj.uniqueKey);
      }
    }
  }, [activeModelObj, model, onSelectModel, loading]);

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      onOpenStateChange?.(next);
      return next;
    });
  };

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onOpenStateChange?.(false);
  }, [onOpenStateChange]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeMenu]);

  const openProviderSettings = () => {
    closeMenu();
    localStorage.setItem("claude_clone_settings_tab", "providers");
    setSettingsModalOpen(true);
  };

  const handleSelectModelLocal = (selectedKey: string) => {
    const target = allModels.find((m) => m.uniqueKey === selectedKey);
    // Bundled catalog models stay visible before a key is connected: selecting one
    // takes the user straight to the provider setup instead of failing in chat.
    if (target?.requiresKey) {
      openProviderSettings();
      return;
    }
    localStorage.setItem("claude_clone_last_model", selectedKey);
    onSelectModel(selectedKey);
    closeMenu();
  };

  const currentSelectedKey = activeModelObj?.uniqueKey || model;

  return (
    <div className="relative flex items-center gap-1 font-sans" ref={menuRef}>
      {/* Trigger Button with display name · provider label + effort */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex h-8 items-center gap-1.5 rounded-md px-2 transition-colors duration-150 hover:bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
      >
        <span className="text-[13.5px] font-medium text-ink-soft">
          {pillLabel}
        </span>
        <span className="text-[13.5px] text-ink-muted">· {effort}</span>
      </button>

      <button
        type="button"
        aria-label="Model options"
        onClick={toggleOpen}
        className="flex h-8 w-7 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
      >
        <ChevronDown size={15} strokeWidth={2} />
      </button>

      {/* Dropdown Menu - capped to viewport, internal scroll, pinned effort */}
      {isOpen && (
        <div
          role="menu"
          className="anim-popover-in absolute bottom-full right-0 z-45 mb-2 w-80 max-h-[min(520px,calc(100vh-140px))] flex flex-col rounded-xl border border-line bg-elev-1 shadow-[0_16px_36px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          {/* Pinned search box */}
          <div className="p-2 border-b border-line shrink-0 bg-elev-1">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-line bg-elev-2 pl-8 pr-3 py-1 text-[12.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
                autoFocus
              />
            </div>
          </div>

          {/* Internally scrollable models list */}
          <div className="flex-1 overflow-y-auto scroll-slim p-1.5 min-h-0 space-y-2">
            {allModels.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-ink-muted mb-2.5">No connected models available.</p>
                <button
                  type="button"
                  onClick={openProviderSettings}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Key size={13} />
                  <span>Connect an API key</span>
                </button>
              </div>
            ) : groupedProviders.length === 0 ? (
              <div className="p-4 text-center text-xs text-ink-muted">
                No models match "{searchQuery}"
              </div>
            ) : (
              groupedProviders.map((group) => (
                <div key={group.providerLabel} className="space-y-0.5">
                  <p className="px-2 pt-1 pb-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">
                    {group.providerLabel}
                  </p>
                  {group.models.map((m) => (
                    <ModelPickerItem
                      key={m.uniqueKey}
                      model={m}
                      isSelected={currentSelectedKey === m.uniqueKey}
                      onSelect={handleSelectModelLocal}
                    />
                  ))}
                </div>
              ))
            )}

            {allModels.some((m) => m.requiresKey) && (
              <p className="px-2 py-1 text-[10.5px] text-ink-faint leading-tight">
                Models marked “Key required” come from the bundled catalog. Connect the provider key in
                Settings → Providers to run them.
              </p>
            )}
          </div>

          {/* Pinned Effort section at bottom */}
          <div className="shrink-0 border-t border-line bg-elev-1 p-2">
            <p className="px-2 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">
              Effort
            </p>
            <div className="flex gap-1">
              {EFFORTS.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="menuitemradio"
                  aria-checked={effort === e}
                  onClick={() => {
                    onSelectEffort(e);
                    closeMenu();
                  }}
                  className={cn(
                    "flex-1 h-7 flex items-center justify-center gap-1 rounded-md text-[12px] transition-colors cursor-pointer",
                    effort === e
                      ? "text-ink font-medium bg-elev-3 border border-line"
                      : "text-ink-soft hover:bg-elev-2"
                  )}
                >
                  <span>{e}</span>
                  {effort === e && <Check size={12} className="text-accent" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
