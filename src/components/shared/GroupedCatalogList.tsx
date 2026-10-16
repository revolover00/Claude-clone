import React, { useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../utils/cn";
import { computeVirtualWindow } from "../../utils/virtualWindow";
import {
  flattenHierarchy,
  groupHierarchy,
  type GroupableModel,
} from "../../shared/catalog/grouping";

const HEADER_H = 34;
const DEFAULT_ROW_H = 96;
const VIEWPORT_H = 440;

interface Props {
  models: GroupableModel[];
  renderRow: (model: GroupableModel, depth: number) => React.ReactNode;
  rowHeight?: number;
  headerHeight?: number;
  viewportHeight?: number;
  emptyMessage?: string;
  loading?: boolean;
}

/**
 * Virtualized Provider -> Vendor -> Family grouped list with collapsible
 * headers and counts. Used by the Model Catalog settings tab and by the
 * Providers > Models browser.
 */
export function GroupedCatalogList({
  models,
  renderRow,
  rowHeight = DEFAULT_ROW_H,
  headerHeight = HEADER_H,
  viewportHeight = VIEWPORT_H,
  emptyMessage = "No models match the selected filters.",
  loading = false,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const tree = groupHierarchy(models);
    const flat = flattenHierarchy(tree, collapsed);
    const heights = flat.map((row) => (row.type === "header" ? headerHeight : rowHeight));
    return { flat, heights };
  }, [models, collapsed, headerHeight, rowHeight]);

  const win = computeVirtualWindow(rows.heights, scrollTop, viewportHeight);
  const visible = rows.flat.slice(win.start, win.end);

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setScrollTop(containerRef.current?.scrollTop || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center text-xs text-ink-muted animate-pulse" style={{ height: viewportHeight }}>
        Loading the model catalog...
      </div>
    );
  }
  if (rows.flat.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-ink-muted" style={{ height: viewportHeight }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={(e) => setScrollTop((e.target as HTMLElement).scrollTop)}
      style={{ height: viewportHeight }}
      className="overflow-y-auto scroll-slim rounded-xl border border-line bg-panel p-2"
      data-testid="grouped-catalog-list"
    >
      <div style={{ height: win.topPad }} />
      {visible.map((row) =>
        row.type === "header" ? (
          <button
            key={row.key}
            type="button"
            onClick={() => toggle(row.key)}
            style={{ height: headerHeight }}
            className="flex w-full items-center gap-1.5 rounded-md px-2 text-start hover:bg-elev-2 transition-colors cursor-pointer"
            data-level={row.level}
          >
            <ChevronRight size={13} className={cn("shrink-0 text-ink-muted transition-transform", !collapsed.has(row.key) && "rotate-90")} />
            <span className={cn("truncate font-semibold text-ink", row.level === "provider" ? "text-[12.5px] uppercase tracking-wide" : "text-[12px]")}>
              {row.title}
            </span>
            <span className="text-[10.5px] font-mono text-ink-faint">{row.count}</span>
          </button>
        ) : (
          <div key={row.key} style={{ minHeight: rowHeight }}>
            {renderRow(row.model!, row.depth)}
          </div>
        )
      )}
      <div style={{ height: win.bottomPad }} />
    </div>
  );
}
