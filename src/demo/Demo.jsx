import { useMemo, useState } from "react";
import { VirtualGrid } from "../lib";

const ROW_COUNT = 10000;
const EXTRA_COLUMN_COUNT = 10000;

// Small row objects; the 10k extra columns compute their text when shown
// (100M pre-built cell strings would need GBs).
const rows = Array.from({ length: ROW_COUNT }, (_, id) => ({
  id,
  name: `User ${id}`,
  email: `user${id}@example.com`
}));

const dataColumns = [
  { key: "id", header: "ID", width: 70, pinned: true },
  { key: "name", header: "Name", width: 130, pinned: true },
  { key: "email", header: "Email", width: 220 },
  ...Array.from({ length: EXTRA_COLUMN_COUNT }, (_, j) => ({
    key: `col${j}`,
    header: `Column ${j}`,
    width: 120 + (j % 3) * 40, // mixed widths
    render: (row) => `Row ${row.id}, Col ${j}`
  }))
];

// Carbon data table sizes (row and header height in px)
const SIZES = { xs: 24, sm: 32, md: 40, lg: 48 };

// column layout survives reloads (the grid ignores stale or unknown keys)
const LAYOUT_KEY = "vgrid-demo-columns";
const loadLayout = () => {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_KEY)) ?? undefined;
  } catch {
    return undefined;
  }
};
const saveLayout = (state) => {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: layout just won't persist
  }
};

const Demo = () => {
  const [theme, setTheme] = useState("vgrid--carbon");
  const [size, setSize] = useState("xs");
  const [manager, setManager] = useState(true);
  const [savedLayout] = useState(loadLayout);
  const [checkedRows, setCheckedRows] = useState({});
  // derived, not stored: avoids a second render after every click
  const checkedCount = Object.keys(checkedRows).length;
  const allChecked = checkedCount === ROW_COUNT;
  const someChecked = checkedCount > 0 && !allChecked;

  // only the checkbox column depends on state; the 10k others stay the same
  // objects, so the grid skips them on a click
  const columns = useMemo(
    () => [
      {
        key: "select",
        header: "Select",
        width: 40,
        pinned: true,
        hideable: false,
        renderHeader: () => (
          <input
            type="checkbox"
            aria-label="Select all rows"
            checked={allChecked}
            // indeterminate is a DOM property only, React can't set it as a prop
            ref={(el) => el && (el.indeterminate = someChecked)}
            onChange={() =>
              setCheckedRows(
                allChecked ? {} : Object.fromEntries(rows.map((r) => [r.id, true]))
              )
            }
          />
        ),
        render: (row) => (
          <input
            type="checkbox"
            aria-label={`Select row ${row.id}`}
            checked={!!checkedRows[row.id]}
            onChange={() =>
              setCheckedRows((prev) => {
                const next = { ...prev };
                if (next[row.id]) delete next[row.id];
                else next[row.id] = true;
                return next;
              })
            }
          />
        )
      },
      ...dataColumns
    ],
    [checkedRows, allChecked, someChecked]
  );

  return (
    <>
      <h1>VirtualGrid demo</h1>
      <p>
        {ROW_COUNT.toLocaleString()} rows × {columns.length.toLocaleString()} columns
        · {checkedCount} selected ·{" "}
        <label>
          Theme{" "}
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="vgrid--carbon">Carbon</option>
            <option value="">None (unstyled)</option>
          </select>
        </label>{" "}
        <label>
          Size{" "}
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            {Object.entries(SIZES).map(([name, px]) => (
              <option key={name} value={name}>
                {name} ({px}px)
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={manager}
            onChange={(e) => setManager(e.target.checked)}
          />{" "}
          Column manager
        </label>
      </p>
      <VirtualGrid
        rows={rows}
        columns={columns}
        className={theme || undefined}
        rowHeight={SIZES[size]}
        headerHeight={SIZES[size]}
        columnManager={manager}
        initialColumnState={savedLayout}
        onColumnStateChange={saveLayout}
        height="calc(100vh - 140px)"
      />
    </>
  );
};

export default Demo;
