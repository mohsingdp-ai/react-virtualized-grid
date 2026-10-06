// Column math for horizontal virtualization. Pure functions, no React.

// offsets[i] = left edge of scrolling column i; offsets[n] = their total width.
export const columnOffsets = (widths) => {
  const offsets = new Float64Array(widths.length + 1);
  for (let i = 0; i < widths.length; i++) offsets[i + 1] = offsets[i] + widths[i];
  return offsets;
};

// Most columns a viewport can show at once, plus overscan on both sides.
// Every row renders exactly this many cells, so a cell can be recycled
// slot-for-slot (`columnIndex % slots`) as columns scroll in and out.
export const columnSlotCount = (offsets, viewportWidth, overscan) => {
  const count = offsets.length - 1;
  if (count === 0) return 0;
  let minWidth = Infinity;
  for (let i = 0; i < count; i++) minWidth = Math.min(minWidth, offsets[i + 1] - offsets[i]);
  const visible = Math.ceil(Math.max(0, viewportWidth) / minWidth) + 1;
  return Math.min(count, visible + 2 * overscan);
};

// [first, last] window of exactly `slots` columns covering what is visible at
// `scrollLeft` plus overscan.
export const columnWindow = (offsets, scrollLeft, slots, overscan) => {
  const count = offsets.length - 1;
  if (slots === 0) return [0, -1];
  // first column whose right edge is past scrollLeft
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid + 1] > scrollLeft) hi = mid;
    else lo = mid + 1;
  }
  const first = Math.max(0, Math.min(lo - overscan, count - slots));
  return [first, first + slots - 1];
};
