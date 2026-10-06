import { test } from "node:test";
import assert from "node:assert/strict";
import { columnOffsets, columnSlotCount, columnWindow } from "./columnWindow.js";

// For many scroll positions: the window has exactly `slots` columns, stays in
// bounds, and contains every column that is actually visible.
const checkCoverage = (widths, viewport, overscan) => {
  const offsets = columnOffsets(widths);
  const total = offsets[widths.length];
  const slots = columnSlotCount(offsets, viewport, overscan);
  for (let step = 0; step <= 500; step++) {
    const scrollLeft = (Math.max(0, total - viewport) * step) / 500;
    const [first, last] = columnWindow(offsets, scrollLeft, slots, overscan);
    assert.equal(last - first + 1, slots);
    assert.ok(first >= 0 && last < widths.length);
    for (let c = 0; c < widths.length; c++) {
      const visible = offsets[c + 1] > scrollLeft && offsets[c] < scrollLeft + viewport;
      if (visible) assert.ok(c >= first && c <= last, `column ${c} visible at ${scrollLeft} but outside [${first}, ${last}]`);
    }
  }
};

test("uniform widths", () => checkCoverage(Array(1000).fill(150), 1170, 1));

test("mixed widths", () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  checkCoverage(Array.from({ length: 800 }, () => 40 + Math.floor(rand() * 300)), 1000, 2);
});

test("fewer columns than fit on screen", () => checkCoverage([100, 200, 50], 2000, 1));

test("no columns", () => {
  const offsets = columnOffsets([]);
  assert.equal(columnSlotCount(offsets, 1000, 1), 0);
  assert.deepEqual(columnWindow(offsets, 0, 0, 1), [0, -1]);
});
