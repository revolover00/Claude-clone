import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, Check, Search, Key, AlertTriangle, ThumbsUp } from "lucide-react";
import { cn } from "../../utils/cn";
import { useChat } from "../../context/ChatContext";
import { useComposerModels } from "./modelPicker/useComposerModels";
import { ModelPickerItem } from "./modelPicker/ModelPickerItem";
import {
  activeModelAt,
  activeScrollTop,
  buildPickerRows,
  nextActiveIndex,
  rowHeights,
} from "./modelPicker/pickerRows";
import { computeVirtualWindow } from "../../utils/virtualWindow";
import { closestRecommendedModel } from "../../shared/catalog/grouping";
import { requestSettingsTab } from "../../utils/settingsTab";
import { useProviderConnectAutoSelect } from "./modelPicker/useProviderConnectAutoSelect";
import { VendorFilterChips } from "./modelPicker/VendorFilterChips";

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

export default function ModelMenu({ model, onSelectModel, effort, onSelectEffort, onOpenStateChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { setSettingsModalOpen } = useChat();

  const {
    allModels, sections, activeModelObj, pillLabel, searchQuery, setSearchQuery,
    vendorFilter, setVendorFilter, freeOnly, setFreeOnly, availableVendors, loading, refresh,
  } = useComposerModels(model);


  useProviderConnectAutoSelect({
    allModels,
    loading,
    activeUniqueKey: activeModelObj?.uniqueKey,
    refresh,
    onSelectModel,
  });

  const rows = useMemo(() => buildPickerRows(sections), [sections]);
  const heights = useMemo(() => rowHeights(rows), [rows]);
  const viewport = listRef.current?.clientHeight || 420;
  const win = computeVirtualWindow(heights, scrollTop, viewport, 5);
  const visible = rows.slice(win.start, win.end);

  // Sync the initial selection once every source has loaded.
  useEffect(() => {
    if (loading) return;
    if (activeModelObj && model !== activeModelObj.uniqueKey && model !== activeModelObj.id) {
      const saved = localStorage.getItem("claude_clone_last_model");
      if (!saved) onSelectModel(activeModelObj.uniqueKey);
    }
  }, [activeModelObj, model, onSelectModel, loading]);

  useEffect(() => setActiveIndex(-1), [sections]);


  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      onOpenStateChange?.(next);
      if (next) setScrollTop(0);
      return next;
    });
  };

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onOpenStateChange?.(false);
  }, [onOpenStateChange]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeMenu]);

  const openProviderSettings = useCallback(() => {
    closeMenu();
    requestSettingsTab("providers");
    setSettingsModalOpen(true);
  }, [closeMenu, setSettingsModalOpen]);

  const handleSelectModelLocal = (selectedKey: string) => {
    const target = allModels.find((m) => m.uniqueKey === selectedKey);
    // Unconnected models stay visible: selecting one opens provider setup.
    if (target?.requiresKey) {
      openProviderSettings();
      return;
    }
    localStorage.setItem("claude_clone_last_model", selectedKey);
    onSelectModel(selectedKey);
    closeMenu();
  };

  const moveActive = (delta: number) => {
    setActiveIndex((current) => {
      const next = nextActiveIndex(rows, current, delta);
      const target = activeScrollTop(rows, next, viewport);
      if (target >= 0 && listRef.current) {
        listRef.current.scrollTop = target;
        setScrollTop(target);
      }
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter") {
      const target = activeModelAt(rows, activeIndex);
      if (target) {
        e.preventDefault();
        handleSelectModelLocal(target.uniqueKey);
      }
    }
  };

  const currentSelectedKey = activeModelObj?.uniqueKey || model;
  const status = activeModelObj?.status || "active";
  const unavailable = status === "deprecated" || status === "removed";
  const replacement = useMemo(() => {
    if (!unavailable || !activeModelObj) return null;
    return closestRecommendedModel(activeModelObj, allModels.filter((m) => !m.requiresKey && m.isEnabled));
  }, [unavailable, activeModelObj, allModels]);

  return (
    <div className="relative flex items-center gap-1 font-sans" ref={menuRef}>
      {unavailable && replacement && (
        <div className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-300">
          <AlertTriangle size={11} />
          <span>{status === "removed" ? "Removed" : "Deprecated"}</span>
          <button
            type="button"
            onClick={() => handleSelectModelLocal(replacement.uniqueKey)}
            className="inline-flex items-center gap-0.5 font-semibold underline cursor-pointer hover:text-amber-200"
          >
            <ThumbsUp size={10} /> Switch to {replacement.alias || replacement.displayName}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex h-8 items-center gap-1 rounded-md pe-1 ps-2 transition-colors duration-150 hover:bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
      >
        <span className="text-[14px] font-medium text-ink-soft">{pillLabel}</span>
        <span className="text-[14px] text-ink-muted">· {effort}</span>
      </button>

      <button
        type="button"
        aria-label="Model options"
        onClick={toggleOpen}
        className="-ms-1 flex h-8 w-6 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
      >
        <ChevronDown size={14} strokeWidth={2} />
      </button>

      {isOpen && (
        <div
          role="menu"
          onKeyDown={handleKeyDown}
          className="anim-popover-in absolute bottom-full right-0 z-45 mb-2 w-80 max-h-[min(520px,calc(100vh-140px))] flex flex-col rounded-xl border border-line bg-elev-1 shadow-[0_16px_36px_rgba(0,0,0,0.5)] overflow-hidden"
        >
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
            <p className="pt-1 text-[9.5px] text-ink-faint">↑↓ to navigate · Enter to select</p>
          </div>

          <div className="px-2 pt-2">
            <VendorFilterChips vendors={availableVendors} active={vendorFilter} onChange={setVendorFilter} freeOnly={freeOnly} onFreeOnlyChange={setFreeOnly} />
          </div>

          <div
            ref={listRef}
            onScroll={(e) => setScrollTop((e.target as HTMLElement).scrollTop)}
            className="flex-1 overflow-y-auto scroll-slim p-1.5 min-h-0"
          >
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
            ) : rows.length === 0 ? (
              <div className="p-4 text-center text-xs text-ink-muted">No models match "{searchQuery}"</div>
            ) : (
              <>
                <div style={{ height: win.topPad }} />
                {visible.map((row, i) => {
                  const index = win.start + i;
                  if (row.type === "section") {
                    return (
                      <p
                        key={row.key}
                        style={{ minHeight: row.height }}
                        className="px-2 pt-1 pb-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint"
                      >
                        {row.title}
                      </p>
                    );
                  }
                  return (
                    <div
                      key={row.key}
                      style={{ minHeight: row.height }}
                      className={cn(index === activeIndex && "rounded-md ring-1 ring-accent/60")}
                    >
                      <ModelPickerItem
                        model={row.model}
                        isSelected={currentSelectedKey === row.model.uniqueKey}
                        onSelect={handleSelectModelLocal}
                      />
                    </div>
                  );
                })}
                <div style={{ height: win.bottomPad }} />
              </>
            )}
          </div>

          {allModels.some((m) => m.requiresKey) && (
            <p className="px-2 py-1 border-t border-line text-[10.5px] text-ink-faint leading-tight">
              Dimmed models belong to providers you have not connected yet — selecting one opens Settings › Providers.
            </p>
          )}

          <div className="shrink-0 border-t border-line bg-elev-1 p-2">
            <p className="px-2 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">Effort</p>
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
                    effort === e ? "text-ink font-medium bg-elev-3 border border-line" : "text-ink-soft hover:bg-elev-2"
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
