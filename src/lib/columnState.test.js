import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyColumnState,
  defaultColumnState,
  moveColumn,
  showAllColumns,
  syncColumnState,
  toggleHidden,
  togglePinned
} from "./columnState.js";

const columns = [
  { key: "a" },
  { key: "b", pinned: true },
  { key: "c", hidden: true },
  { key: "d" },
  { key: "e", pinned: true }
];

test("defaults: pinned first, hidden from flags", () => {
  assert.deepEqual(defaultColumnState(columns), {
    order: ["b", "e", "a", "c", "d"],
    hidden: ["c"],
    pinned: ["b", "e"]
  });
});

test("apply: hides, orders, overrides pinned without copying unchanged columns", () => {
  let state = togglePinned(defaultColumnState(columns), "a"); // pin a
  state = togglePinned(state, "b"); // unpin b
  const shown = applyColumnState(columns, state);
  assert.deepEqual(shown.map((c) => [c.key, !!c.pinned]), [
    ["e", true],
    ["a", true],
    ["b", false],
    ["d", false]
  ]);
  assert.equal(shown.find((c) => c.key === "e"), columns[4]); // same object
});

test("move within, into and out of the pinned group", () => {
  const s = defaultColumnState(columns); // [b e | a c d]
  const within = moveColumn(s, 3, 4); // c after d, stays unpinned
  assert.deepEqual(within.order, ["b", "e", "a", "d", "c"]);
  assert.deepEqual(within.pinned, ["b", "e"]);

  const into = moveColumn(s, 4, 0); // d to the top -> pinned
  assert.deepEqual(into.order, ["d", "b", "e", "a", "c"]);
  assert.deepEqual(into.pinned, ["d", "b", "e"]);

  const outOf = moveColumn(s, 0, 4); // b to the bottom -> unpinned
  assert.deepEqual(outOf.order, ["e", "a", "c", "d", "b"]);
  assert.deepEqual(outOf.pinned, ["e"]);

  // exactly on the boundary keeps the current pin
  assert.deepEqual(moveColumn(s, 4, 2).pinned, ["b", "e"]); // d stays unpinned
  assert.deepEqual(moveColumn(s, 0, 1).pinned, ["e", "b"]); // b stays pinned
});

test("pin goes to end of pinned group, unpin to start of the rest", () => {
  const s = defaultColumnState(columns);
  assert.deepEqual(togglePinned(s, "d").order, ["b", "e", "d", "a", "c"]);
  assert.deepEqual(togglePinned(s, "b").order, ["e", "b", "a", "c", "d"]);
});

test("hide, show all", () => {
  const s = toggleHidden(defaultColumnState(columns), "a");
  assert.deepEqual(s.hidden, ["c", "a"]);
  assert.deepEqual(toggleHidden(s, "c").hidden, ["a"]);
  assert.deepEqual(showAllColumns(s).hidden, []);
});

test("sync a saved state with changed columns", () => {
  const saved = { order: ["x", "d", "a", "b"], hidden: ["x", "a"], pinned: ["d", "x"] };
  const now = [{ key: "a" }, { key: "b" }, { key: "d" }, { key: "f", pinned: true }];
  assert.deepEqual(syncColumnState(saved, now), {
    order: ["d", "f", "a", "b"],
    hidden: ["a"],
    pinned: ["d", "f"]
  });
});
