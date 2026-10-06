# react-window-sticky-grid

Virtualized React grid with a sticky header and pinned (frozen) left columns.
Only the visible rows and columns are rendered, so it stays smooth with
10,000 × 10,000 cells.

## Install

```sh
npm install react-window-sticky-grid
```

Needs React 18 or 19.

## Use

```jsx
import { VirtualGrid } from "react-window-sticky-grid";
import "react-window-sticky-grid/style.css";

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
| `width`        | Width in px. Default `150`.                          |
| `pinned`       | Stick to the left while scrolling sideways. Pinned columns are always shown first. |
| `render`       | `(row, rowIndex) => content`. Default: `row[key]`.   |
| `renderHeader` | `() => content`. Default: `header`.                  |

## Props

| Prop               | Default  | Meaning                                    |
| ------------------ | -------- | ------------------------------------------ |
| `rows`             | —        | Array of row objects.                      |
| `columns`          | —        | Column definitions (above).                |
| `height`           | —        | Any CSS height. Required.                  |
| `width`            | `"100%"` | Any CSS width.                             |
| `rowHeight`        | `30`     | Row height in px.                          |
| `headerHeight`     | `30`     | Header height in px.                       |
| `overscanRowCount` | `1`      | Extra rows rendered above/below the view.  |
| `className`, `style`, other div props | | Passed to the scroll container. |

## Performance tips

- Keep `rows` and `columns` the same arrays between renders (`useMemo` or
  module-level). A new `columns` array re-renders every visible cell.
- If only one column depends on state (e.g. a checkbox column), rebuild just
  that column object and reuse the others: unchanged columns are skipped.
- Huge or computed data: keep rows small and compute cell text in `render`
  instead of storing it.

## Theme

Override these CSS variables on `.vgrid` or your own `className`:

```css
.my-grid {
  --vgrid-border: 1px solid #ddd;
  --vgrid-header-bg: #f5f5f5;
  --vgrid-pinned-bg: #fafafa;
  --vgrid-pinned-header-bg: #eee;
  --vgrid-cell-padding: 0 8px;
}
```

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
