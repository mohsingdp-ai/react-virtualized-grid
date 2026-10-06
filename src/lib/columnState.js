// Column layout state: { order, hidden, pinned }, each an array of column keys
// (JSON-friendly, so it can be saved and restored). `order` always lists
// pinned columns first, in the order they are shown.

export const columnLabel = (column) =>
  typeof column.header === "string" || typeof column.header === "number"
    ? String(column.header)
    : column.key;

const pinnedFirst = (order, pinnedSet) => [
  ...order.filter((key) => pinnedSet.has(key)),
  ...order.filter((key) => !pinnedSet.has(key))
];

// Layout from the column definitions (`pinned` / `hidden` flags).
export const defaultColumnState = (columns) => {
  const pinned = columns.filter((c) => c.pinned).map((c) => c.key);
  return {
    order: pinnedFirst(columns.map((c) => c.key), new Set(pinned)),
    hidden: columns.filter((c) => c.hidden).map((c) => c.key),
    pinned
  };
};

// Fit a saved state to the current columns: drop keys that no longer exist,
// add new columns at the end with their default flags.
export const syncColumnState = (state, columns) => {
  const known = new Set(columns.map((c) => c.key));
  const kept = state.order.filter((key) => known.has(key));
  const keptSet = new Set(kept);
  const added = columns.filter((c) => !keptSet.has(c.key));
  const pinnedSet = new Set([
    ...state.pinned.filter((key) => known.has(key)),
    ...added.filter((c) => c.pinned).map((c) => c.key)
  ]);
  const order = pinnedFirst([...kept, ...added.map((c) => c.key)], pinnedSet);
  return {
    order,
    hidden: [
      ...state.hidden.filter((key) => known.has(key)),
      ...added.filter((c) => c.hidden).map((c) => c.key)
    ],
    pinned: order.filter((key) => pinnedSet.has(key))
  };
};

// Columns to render: in state order, hidden ones removed, `pinned` from state.
export const applyColumnState = (columns, state) => {
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const hidden = new Set(state.hidden);
  const pinned = new Set(state.pinned);
  return state.order
    .filter((key) => !hidden.has(key))
    .map((key) => {
      const column = byKey.get(key);
      const isPinned = pinned.has(key);
      return !!column.pinned === isPinned ? column : { ...column, pinned: isPinned };
    });
};

// Move the column at `from` to `to` (indexes in state.order). Dropped among
// pinned columns it becomes pinned; among the others, unpinned; exactly on the
// boundary it keeps its current pin.
export const moveColumn = (state, from, to) => {
  if (from === to) return state;
  const order = [...state.order];
  const [key] = order.splice(from, 1);
  order.splice(to, 0, key);
  const others = state.pinned.filter((k) => k !== key);
  const pin = to < others.length ? true : to > others.length ? false : state.pinned.includes(key);
  const pinnedSet = new Set(pin ? [...others, key] : others);
  return { ...state, order, pinned: order.filter((k) => pinnedSet.has(k)) };
};

// Pinning moves a column to the end of the pinned group; unpinning moves it
// to the start of the other columns.
export const togglePinned = (state, key) => {
  const pin = !state.pinned.includes(key);
  const pinned = pin ? [...state.pinned, key] : state.pinned.filter((k) => k !== key);
  const pinnedSet = new Set(pinned);
  const rest = state.order.filter((k) => !pinnedSet.has(k) && k !== key);
  return { ...state, pinned, order: [...pinned, ...(pin ? rest : [key, ...rest])] };
};

export const toggleHidden = (state, key) => ({
  ...state,
  hidden: state.hidden.includes(key)
    ? state.hidden.filter((k) => k !== key)
    : [...state.hidden, key]
});

export const showAllColumns = (state) => ({ ...state, hidden: [] });

// Shape check for state from storage or a server: arrays of string keys.
const isKeyList = (value) =>
  Array.isArray(value) && value.every((key) => typeof key === "string");

export const isColumnState = (value) =>
  value !== null &&
  typeof value === "object" &&
  isKeyList(value.order) &&
  isKeyList(value.hidden) &&
  isKeyList(value.pinned);
