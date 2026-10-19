import type { UnifiedModel } from "./types";

interface SectionLike {
  id: string;
  title: string;
  models: any[];
}

/** Flattened composer list rows: section headers and models, with heights. */
export type PickerRow =
  | { type: "section"; key: string; title: string; height: number }
  | { type: "model"; key: string; model: UnifiedModel; height: number };

export const SECTION_H = 26;
export const MODEL_H = 66;

/** Sections flattened into a virtualizable row array (keeps section order). */
export function buildPickerRows(sections: SectionLike[]): PickerRow[] {
  const rows: PickerRow[] = [];
  for (const section of sections) {
    rows.push({ type: "section", key: `s:${section.id}`, title: section.title, height: SECTION_H });
    for (const model of section.models) {
      const key = (model as any).uniqueKey || `${model.provider}:${(model as any).id || (model as any).model_id}`;
      rows.push({ type: "model", key: `m:${key}`, model, height: MODEL_H });
    }
  }
  return rows;
}

export function rowHeights(rows: PickerRow[]): number[] {
  return rows.map((row) => row.height);
}

/** Keyboard navigation: next focusable (model) row index from `current`. */
export function nextActiveIndex(rows: PickerRow[], current: number, delta: number): number {
  const modelIndices = rows.map((row, index) => (row.type === "model" ? index : -1)).filter((i) => i >= 0);
  if (modelIndices.length === 0) return -1;
  const position = modelIndices.indexOf(current);
  if (position === -1) return delta > 0 ? modelIndices[0] : modelIndices[modelIndices.length - 1];
  const next = Math.min(modelIndices.length - 1, Math.max(0, position + delta));
  return modelIndices[next];
}

/** All model rows in display order (for rendering highlights and selection). */
export function activeModelAt(rows: PickerRow[], activeIndex: number): UnifiedModel | null {
  const row = rows[activeIndex];
  return row && row.type === "model" ? row.model : null;
}

/** Scroll offset that keeps the active row visible inside the viewport. */
export function activeScrollTop(rows: PickerRow[], activeIndex: number, viewportHeight: number): number {
  if (activeIndex < 0) return 0;
  let offset = 0;
  for (let i = 0; i < rows.length; i++) {
    if (i === activeIndex) {
      const rowBottom = offset + rows[i].height;
      const rowTop = offset;
      if (rowBottom > viewportHeight) return rowBottom - viewportHeight + 8;
      if (rowTop < 0) return Math.max(0, rowTop - 8);
      return -1; // already visible
    }
    offset += rows[i].height;
  }
  return -1;
}
