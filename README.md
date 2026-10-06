# @mejazbese21/react-window-sticky-grid

Virtualized React grid with a sticky header and pinned (frozen) left columns.
Only the visible rows and columns are rendered, so it stays smooth with
10,000 × 10,000 cells.

## Install

```sh
npm install @mejazbese21/react-window-sticky-grid
```

Needs React 18 or 19.

## Use

```jsx
import { VirtualGrid } from "@mejazbese21/react-window-sticky-grid";
import "@mejazbese21/react-window-sticky-grid/style.css";

const columns = [
  { key: "id", header: "ID", width: 70, pinned: true },
  { key: "name", header: "Name", pinned: true },
  { key: "email", header: "Email", width: 220 },
  { key: "total", header: "Total", render: (row) => `$${row.total.toFixed(2)}` }
];

<VirtualGrid rows={users} columns={columns} height={600} />;
```

## Columns

| Field          | Meaning                                              |
| -------------- | ---------------------------------------------------- |
| `key`          | Unique id. Also the field read from each row.        |
| `header`       | Header label. Defaults to `key`.                     |
| `width`        | Width in px, or `"auto"` to fit the content. Default `150`. |
| `minWidth`, `maxWidth` | Limits for `width: "auto"`, in px.           |
| `pinned`       | Stick to the left while scrolling sideways. Pinned columns are always shown first. |
| `hidden`       | Start hidden (users can show it in the column manager). |
| `hideable`     | `false` stops users hiding it in the column manager.  |
| `render`       | `(row, rowIndex) => content`. Default: `row[key]`.   |
| `renderHeader` | `() => content`. Default: `header`.                  |
| `align`        | `"right"` right-aligns header and cells (numbers).   |
| `testId`       | `data-testid` on the column's cells; header cells get `"<testId>-header"`. |

### Fit to content

`width: "auto"` sizes a column to its widest value across **all** rows (not
just the ones on screen) and its header:

```jsx
{ key: "email", header: "Email", width: "auto", maxWidth: 320 }
```

- Text values (`row[key]`, or a `render` returning a string/number) are
  measured for every row, in the column's own font (per-column CSS counts)
  and padding.
- JSX made of plain elements (`<span className="bold">{text}</span>`): the
  text is read from it for every row and measured in the font the rendered
  cells use, plus the extra width (padding, icons) seen on screen.
- JSX with your own components inside (`<Badge>`) can't be read without
  rendering, so only the rows on screen count. Give those a `minWidth`, or a
  fixed `width`.
- Re-measured when rows, columns, the theme or web fonts change. Never while
  scrolling, so widths don't jump. About 15 ms for 2 columns × 10,000 rows.

## Props

| Prop               | Default  | Meaning                                    |
| ------------------ | -------- | ------------------------------------------ |
| `rows`             | —        | Array of row objects.                      |
| `columns`          | —        | Column definitions (above).                |
| `height`           | —        | Any CSS height. Omit it to size the grid to its rows. |
| `maxHeight`        | —        | Cap for the auto height (e.g. `"calc(100dvh - 16rem)"`). |
| `onRowClick`       | —        | `(row, rowIndex, event) => void`. Rows get a pointer cursor. |
| `rowProps`         | —        | `(row, rowIndex) => attributes` merged onto each row: `className`, `onClick`, `data-*`, `style`. |
| `renderEmpty`      | —        | `() => content` shown under the header when `rows` is empty. |
| `width`            | `"100%"` | Any CSS width.                             |
| `rowHeight`        | `30`     | Row height in px.                          |
| `headerHeight`     | `30`     | Header height in px.                       |
| `overscanRowCount` | `1`      | Extra rows rendered above/below the view.  |
| `columnManager`    | `false`  | `true`: built-in "Columns" button. An id: open it from your own button (see below). |
| `initialColumnState` | —      | Restore a saved column layout.             |
| `onColumnStateChange` | —     | Called with the new layout on every change. |
| `persistKey`       | —        | Save the layout in this browser under this key. |
| `className`, `style`, other div props | | Passed to the outer element. |

## Accessibility

The grid is announced like a table: `role="grid"` with `aria-rowcount` /
`aria-colcount`, `role="row"` + `aria-rowindex` on the header and every row
(virtualized rows keep their real index), `role="columnheader"` and
`role="gridcell"` with `aria-colindex` on cells.

## Column manager

`columnManager` adds a "Columns" button that opens a panel to:

- **Reorder**: drag a handle ([Pragmatic drag and drop](https://github.com/atlassian/pragmatic-drag-and-drop)),
  or focus a handle and press ↑ / ↓. Dropping into the pinned group pins the column.
- **Show / hide**: checkbox per column; "Show all" at the bottom.
- **Pin / unpin**: pin button per column.
- **Reset**: back to the column definitions.

### Your own button

Put the Columns button anywhere (e.g. next to your filters): give
`columnManager` an id instead of `true`, and point any button at it:

```jsx
<Toolbar>
  <FiltersButton />
  <button popoverTarget="txn-columns">Columns</button>
</Toolbar>

<VirtualGrid columnManager="txn-columns" rows={rows} columns={columns} height={600} />
```

The grid then shows no button of its own. Clicking yours opens the panel
under it (where CSS anchor positioning is supported; elsewhere it opens
centered); clicking again, clicking outside or Esc closes it. Uses the native
`popover` API, so it works from plain HTML too (`popovertarget="txn-columns"`)
or from code: `document.getElementById("txn-columns").togglePopover()`.

The panel's code (and drag and drop) only loads when it's first opened.

### Saving the layout

**In this browser** — one prop. The grid saves to `localStorage` and restores
on load:

```jsx
<VirtualGrid columnManager persistKey="orders-table" rows={rows} columns={columns} height={600} />
```

Per browser and device only: Chrome and Firefox, or laptop and phone, each keep
their own layout. Cleared with the browser's site data. If storage is blocked
or full, changes still work, they just aren't remembered.

**For a user on any browser or device** — save it on your server:

```jsx
const [layout, setLayout] = useState();      // undefined = still loading
useEffect(() => { api.getLayout().then((l) => setLayout(l ?? null)); }, []);

if (layout === undefined) return <Spinner />; // initialColumnState is read once, on mount
<VirtualGrid
  columnManager
  initialColumnState={layout ?? undefined}
  onColumnStateChange={(state) => api.saveLayout(state)} // debounce if you like
  rows={rows}
  columns={columns}
  height={600}
/>;
```

The state is `{ order, hidden, pinned }`, each an array of column keys (JSON).
Saved keys for columns that no longer exist are ignored, new columns are
added at the end, and invalid data falls back to the defaults.

## Performance tips

- Keep `rows` and `columns` the same arrays between renders (`useMemo` or
  module-level). A new `columns` array re-renders every visible cell.
- If only one column depends on state (e.g. a checkbox column), rebuild just
  that column object and reuse the others: unchanged columns are skipped.
- Huge or computed data: keep rows small and compute cell text in `render`
  instead of storing it.

## Styling

Without a class the grid is unstyled: it only does layout, sticky header and
pinned columns. Style it yourself, or opt in to the built-in theme.

### Carbon theme

[Carbon Design System](https://carbondesignsystem.com) data table look (white
theme). Add the class and pick a Carbon row size:

```jsx
<VirtualGrid
  className="vgrid--carbon"
  rowHeight={24} // xs (thin). sm: 32, md: 40, lg: 48
  headerHeight={24}
  rows={rows}
  columns={columns}
  height={600}
/>
```

It uses IBM Plex Sans if your page loads it, else the system font.

**Gray 10** (white rows, for a `#f4f4f4` page): add `vgrid--g10` too.

```jsx
<VirtualGrid className="vgrid--carbon vgrid--g10" rowHeight={24} headerHeight={24} ... />
```

### Overriding

All built-in styles have zero specificity, so plain CSS wins, no `!important`:

```css
.vgrid__cell { padding: 0 8px; }
```

Two variables work with or without a theme (they default to none):

```css
.vgrid-root { --vgrid-cell-padding: 0 8px; --vgrid-row-border: 1px solid #eee; }
```

Or change the theme variables, globally or on your own `className`:

```css
.my-grid {
  --vgrid-bg: #fff;            /* rows */
  --vgrid-header-bg: #f2f4f8;
  --vgrid-hover-bg: #e8e8e8;
  --vgrid-border-color: #e0e0e0;
  --vgrid-text: #525252;
  --vgrid-header-text: #161616;
  --vgrid-pinned-divider: transparent;
  --vgrid-cell-padding: 0 12px;
  --vgrid-font: Inter, sans-serif;
}
```

Elements you can target: `.vgrid-root` (outer element), `.vgrid` (scroll
container), `.vgrid__header`, `.vgrid__row`, `.vgrid__cell`, `.vgrid__pinned`
(pinned block), `.vgrid__pinned-cell`, `.vgrid__header-cell`. Column manager:
`.vgrid-toolbar`, `.vgrid-toolbar__button`, `.vgrid-manager` (panel),
`.vgrid-manager__item`, `.vgrid-manager__handle`, `.vgrid-manager__pin`,
`.vgrid-manager__footer`. Extra variables: `--vgrid-accent` (focus, drop
line), `--vgrid-icon`, `--vgrid-panel-bg`, `--vgrid-panel-shadow`.

## Develop

```sh
npm start             # demo with hot reload
npm test              # column-math tests
npm run build         # library -> dist/
npm run build:demo    # demo app -> demo-dist/
```

## Releasing

Every merge to `main` that changes the library (`src/lib/`, `index.d.ts`,
`package.json`, `vite.config.js`) publishes to npm automatically and tags the
commit (`vX.Y.Z`).

- Default: patch bump of the latest npm version (1.0.4 -> 1.0.5).
- Minor/major: set the new version in `package.json` in your PR (e.g. `1.1.0`).
- Demo or docs-only changes don't publish.
