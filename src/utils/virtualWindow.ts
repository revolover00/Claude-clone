/**
 * Row-window calculation for virtualized lists with per-row heights.
 * Pure and unit-tested (tests/catalogGrouping.test.ts).
 */
export interface VirtualWindow {
  start: number;
  end: number;
  topPad: number;
  bottomPad: number;
}

/**
 * Returns the half-open [start, end) range of visible rows plus pixel padding.
 * `heights[i]` is the pixel height of row i.
 */
export function computeVirtualWindow(
  heights: number[],
  scrollTop: number,
  viewportHeight: number,
  overscan = 3
): VirtualWindow {
  const total = heights.length;
  if (total === 0) return { start: 0, end: 0, topPad: 0, bottomPad: 0 };

  const top = Math.max(0, scrollTop);
  const bottom = top + viewportHeight;

  // First row that intersects the viewport top edge.
  let start = 0;
  let cumulative = 0;
  while (start < total && cumulative + heights[start] <= top) {
    cumulative += heights[start];
    start++;
  }
  const topPad = cumulative;

  // First row entirely below the viewport bottom edge.
  let end = start;
  let cursor = topPad;
  while (end < total && cursor < bottom) {
    cursor += heights[end];
    end++;
  }

  const withOverscanStart = Math.max(0, start - overscan);
  const withOverscanEnd = Math.min(total, end + overscan);

  let renderedHeight = 0;
  for (let i = withOverscanStart; i < withOverscanEnd; i++) renderedHeight += heights[i];
  const totalHeight = heights.reduce((sum, h) => sum + h, 0);

  return {
    start: withOverscanStart,
    end: withOverscanEnd,
    topPad: sumRange(heights, 0, withOverscanStart),
    bottomPad: Math.max(0, totalHeight - sumRange(heights, 0, withOverscanStart) - renderedHeight),
  };
}

function sumRange(heights: number[], from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += heights[i];
  return sum;
}
