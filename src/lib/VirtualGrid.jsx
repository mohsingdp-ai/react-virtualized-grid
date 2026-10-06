import {
  createContext,
  lazy,
  memo,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { List } from "react-window";
import {
  columnOffsets,
  columnSlotCount,
  columnWindow
} from "./columnWindow.js";
import {
  applyColumnState,
  defaultColumnState,
  isColumnState,
  syncColumnState
} from "./columnState.js";
import { measureAutoWidths, sameWidths } from "./autoWidth.js";
import "./VirtualGrid.css";

// useLayoutEffect warns during server rendering on React 18
const useClientLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

// persistKey storage: per browser, per device; never throws (private mode,
// blocked storage, quota) and ignores corrupt or foreign data
const readStoredState = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return isColumnState(value) ? value : null;
  } catch {
    return null;
  }
};
const writeStoredState = (key, state) => {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // storage unavailable or full: the layout just isn't remembered
  }
};

// height of a horizontal scrollbar (0 for overlay scrollbars), measured once
let measuredScrollbar;
const scrollbarSize = () => {
  if (measuredScrollbar === undefined) {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;visibility:hidden;width:100px;height:100px;overflow:scroll";
    document.body.appendChild(probe);
    measuredScrollbar = probe.offsetHeight - probe.clientHeight;
    probe.remove();
  }
  return measuredScrollbar;
};

// only loaded when the panel is first opened (it pulls in drag and drop)
const ColumnManager = lazy(() => import("./ColumnManager.jsx"));

const DEFAULT_COLUMN_WIDTH = 150;
const OVERSCAN_COLUMN_COUNT = 1;

// The visible column window goes through context, not rowProps: a rowProps
// change makes react-window drop its row-size cache on every column step.
const ColumnWindowContext = createContext([0, -1]);

const cellContent = (column, row, rowIndex) =>
  column.render ? column.render(row, rowIndex) : row[column.key];

const headerContent = (column) =>
  column.renderHeader ? column.renderHeader() : (column.header ?? column.key);

// memo: a column step re-renders every row, but only the recycled cell
// updates; pinned cells (e.g. checkboxes) are left untouched
// per-cell attributes: screen-reader role + 1-based column index, alignment,
// test id (header cells get "<testId>-header")
const cellAttrs = (column, colIndex, header) => ({
  role: header ? "columnheader" : "gridcell",
  "aria-colindex": colIndex,
  "data-align": column.align === "right" ? "right" : undefined,
  "data-testid":
    column.testId && (header ? `${column.testId}-header` : column.testId),
  // lets width: "auto" measure rendered custom (JSX) cells of this column
  "data-column": column.isAutoWidth ? column.key : undefined
});

const Cell = memo(({ row, rowIndex, column, colIndex, left }) => (
  <div
    className="vgrid__cell"
    style={{ left, width: column.width }}
    {...cellAttrs(column, colIndex)}
  >
    {cellContent(column, row, rowIndex)}
  </div>
));

const PinnedCells = memo(({ row, rowIndex, pinnedColumns, pinnedWidth }) => (
  <div className="vgrid__pinned" style={{ width: pinnedWidth }}>
    {pinnedColumns.map((column, i) => (
      <div
        key={column.key}
        className="vgrid__pinned-cell"
        style={{ width: column.width }}
        {...cellAttrs(column, i + 1)}
      >
        {cellContent(column, row, rowIndex)}
      </div>
    ))}
  </div>
));

// One absolutely positioned element per row (not per cell): the browser only
// re-places ~30 rows per scroll frame, and pinned cells stick inside each row
// with CSS position: sticky, so they never lag behind the scrolling cells.
const Row = ({
  index,
  style,
  rows,
  pinnedColumns,
  pinnedWidth,
  scrollColumns,
  offsets,
  rowWidth,
  headerHeight,
  slots,
  onRowClick,
  rowProps
}) => {
  const [first, last] = useContext(ColumnWindowContext);
  const row = rows[index];
  const extra = rowProps ? rowProps(row, index) : undefined;
  const clickable = !!(onRowClick || extra?.onClick);
  // indexed by slot, not column: DOM order stays fixed, so the cell leaving
  // view is updated in place for the one entering instead of re-created
  const cells = new Array(slots);
  for (let c = first; c <= last; c++) {
    cells[c % slots] = (
      <Cell
        key={c % slots}
        row={row}
        rowIndex={index}
        column={scrollColumns[c]}
        colIndex={pinnedColumns.length + c + 1}
        left={pinnedWidth + offsets[c]}
      />
    );
  }
  return (
    <div
      {...extra}
      role="row"
      aria-rowindex={index + 2} // the header is row 1
      className={
        "vgrid__row" +
        (clickable ? " vgrid__row--clickable" : "") +
        (extra?.className ? ` ${extra.className}` : "")
      }
      style={{ ...style, top: headerHeight, width: rowWidth, ...extra?.style }}
      onClick={(event) => {
        extra?.onClick?.(event);
        onRowClick?.(row, index, event);
      }}
    >
      {pinnedColumns.length > 0 && (
        <PinnedCells
          row={row}
          rowIndex={index}
          pinnedColumns={pinnedColumns}
          pinnedWidth={pinnedWidth}
        />
      )}
      {cells}
    </div>
  );
};

const Header = ({
  headerHeight,
  rowWidth,
  pinnedColumns,
  pinnedWidth,
  scrollColumns,
  offsets
}) => {
  const [first, last] = useContext(ColumnWindowContext);
  const cells = [];
  for (let c = first; c <= last; c++) {
    const column = scrollColumns[c];
    cells.push(
      <div
        key={column.key}
        className="vgrid__header-cell vgrid__header-cell--scroll"
        style={{ left: pinnedWidth + offsets[c], width: column.width }}
        {...cellAttrs(column, pinnedColumns.length + c + 1, true)}
      >
        {headerContent(column)}
      </div>
    );
  }
  return (
    <div
      className="vgrid__header"
      role="row"
      aria-rowindex={1}
      style={{ height: headerHeight, width: rowWidth }}
    >
      {pinnedColumns.length > 0 && (
        <div className="vgrid__pinned" style={{ width: pinnedWidth }}>
          {pinnedColumns.map((column, i) => (
            <div
              key={column.key}
              className="vgrid__header-cell"
              style={{ width: column.width }}
              {...cellAttrs(column, i + 1, true)}
            >
              {headerContent(column)}
            </div>
          ))}
        </div>
      )}
      {cells}
    </div>
  );
};

export const VirtualGrid = ({
  rows,
  columns,
  rowHeight = 30,
  headerHeight = 30,
  width = "100%",
  height,
  maxHeight,
  overscanRowCount = 1,
  onRowClick,
  rowProps,
  renderEmpty,
  columnManager = false,
  initialColumnState,
  onColumnStateChange,
  persistKey,
  className,
  style,
  ...rest
}) => {
  // column layout (order / hidden / pinned), fitted to the current columns
  const [savedState, setSavedState] = useState(() =>
    isColumnState(initialColumnState)
      ? initialColumnState
      : defaultColumnState(columns)
  );
  // restore after mount (not during render) so server-rendered HTML matches;
  // a layout effect still applies it before the first paint
  useClientLayoutEffect(() => {
    const stored = persistKey && readStoredState(persistKey);
    if (stored) setSavedState(stored);
  }, [persistKey]);
  const columnState = useMemo(
    () => syncColumnState(savedState, columns),
    [savedState, columns]
  );
  const changeColumnState = useCallback(
    (next) => {
      setSavedState(next);
      if (persistKey) writeStoredState(persistKey, next);
      onColumnStateChange?.(next);
    },
    [onColumnStateChange, persistKey]
  );
  const shownColumns = useMemo(
    () => applyColumnState(columns, columnState),
    [columns, columnState]
  );

  // width: "auto" columns: measured after render (see autoWidth.js); until
  // then, and if nothing measurable, they use minWidth or the default width
  const rootRef = useRef(null);
  const [autoWidths, setAutoWidths] = useState(null);
  const hasAutoWidth = shownColumns.some((column) => column.width === "auto");
  useClientLayoutEffect(() => {
    if (!hasAutoWidth) return;
    const measure = () =>
      setAutoWidths((prev) => {
        const next = measureAutoWidths(rootRef.current, rows, shownColumns);
        return sameWidths(prev, next) ? prev : next;
      });
    measure();
    // web fonts change text widths; measure again once they load
    document.fonts?.addEventListener("loadingdone", measure);
    return () => document.fonts?.removeEventListener("loadingdone", measure);
  }, [rows, shownColumns, hasAutoWidth, className]);

  const { pinnedColumns, scrollColumns, pinnedWidth, offsets } = useMemo(() => {
    const normalized = shownColumns.map((column) => {
      if (column.width === "auto") {
        const width =
          autoWidths?.get(column.key) ??
          column.minWidth ??
          DEFAULT_COLUMN_WIDTH;
        return { ...column, width, isAutoWidth: true };
      }
      return column.width ? column : { ...column, width: DEFAULT_COLUMN_WIDTH };
    });
    const pinned = normalized.filter((column) => column.pinned);
    const scrolling = normalized.filter((column) => !column.pinned);
    return {
      pinnedColumns: pinned,
      scrollColumns: scrolling,
      pinnedWidth: pinned.reduce((sum, column) => sum + column.width, 0),
      offsets: columnOffsets(scrolling.map((column) => column.width))
    };
  }, [shownColumns, autoWidths]);
  const rowWidth = pinnedWidth + offsets[offsets.length - 1];

  // measured, so `width` can be any CSS value
  const [viewportWidth, setViewportWidth] = useState(
    typeof width === "number" ? width : 0
  );
  const slots = columnSlotCount(
    offsets,
    viewportWidth - pinnedWidth,
    OVERSCAN_COLUMN_COUNT
  );
  const getWindow = useCallback(
    (scrollLeft) =>
      columnWindow(offsets, scrollLeft, slots, OVERSCAN_COLUMN_COUNT),
    [offsets, slots]
  );
  const scrollLeftRef = useRef(0);
  // The column window is stored with the getWindow it was computed for. When
  // columns or size change (hide, pin, reset, resize) it is re-fitted during
  // this render: React re-runs the component before rendering any rows, so a
  // row never reads a window that points past the current columns.
  const [fitted, setFitted] = useState(() => ({
    getWindow,
    window: getWindow(0)
  }));
  let visibleWindow = fitted.window;
  if (fitted.getWindow !== getWindow) {
    visibleWindow = getWindow(scrollLeftRef.current);
    setFitted({ getWindow, window: visibleWindow });
  }

  const onScroll = (event) => {
    scrollLeftRef.current = event.currentTarget.scrollLeft;
    const next = getWindow(scrollLeftRef.current);
    // same window: keep the state object, so scrolling within it re-renders nothing
    setFitted((prev) =>
      prev.getWindow === getWindow &&
      prev.window[0] === next[0] &&
      prev.window[1] === next[1]
        ? prev
        : { getWindow, window: next }
    );
  };

  // columnManager={true}: built-in Columns button. columnManager="some-id":
  // no built-in button; any <button popoverTarget="some-id"> on the page
  // opens the panel (native popover), positioned under whichever button did.
  const generatedId = `vgrid-columns-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const panelId =
    typeof columnManager === "string" ? columnManager : generatedId;
  const builtInButton = columnManager === true;

  // No `height`: the scroll area is as tall as its rows (capped by maxHeight
  // on the outer element); with no rows it sizes to the header + empty state.
  // Passed as a CSS variable: react-window treats a numeric style.height as
  // the viewport size (rendering every row) and stops measuring the width.
  const listHeight =
    height === undefined && rows.length > 0
      ? rows.length * rowHeight +
        headerHeight +
        (rowWidth > viewportWidth ? scrollbarSize() : 0)
      : undefined;
  const [managerOpen, setManagerOpen] = useState(false);

  return (
    <div
      ref={rootRef}
      className={className ? `vgrid-root ${className}` : "vgrid-root"}
      style={{ width, height, maxHeight, ...style }}
      {...rest}
    >
      {builtInButton && (
        <div className="vgrid-toolbar">
          <button
            type="button"
            className="vgrid-toolbar__button"
            popoverTarget={panelId}
            style={{ anchorName: `--${panelId}` }}
          >
            Columns
          </button>
        </div>
      )}
      {columnManager && (
        <div
          id={panelId}
          popover="auto"
          className="vgrid-manager"
          aria-label="Columns"
          // an external button is the popover's implicit anchor
          style={builtInButton ? { positionAnchor: `--${panelId}` } : undefined}
          onToggle={(event) => setManagerOpen(event.newState === "open")}
        >
          {managerOpen && (
            <Suspense fallback={null}>
              <ColumnManager
                columns={columns}
                state={columnState}
                onChange={changeColumnState}
              />
            </Suspense>
          )}
        </div>
      )}
      <ColumnWindowContext.Provider value={visibleWindow}>
        <List
          // rows keep react-window's index keys: recycling them by slot makes
          // React move ~every row node on each upward scroll step
          rowComponent={Row}
          rowCount={rows.length}
          rowHeight={rowHeight}
          overscanCount={overscanRowCount}
          rowProps={{
            rows,
            pinnedColumns,
            pinnedWidth,
            scrollColumns,
            offsets,
            rowWidth,
            headerHeight,
            slots,
            onRowClick,
            rowProps
          }}
          role="grid"
          aria-rowcount={rows.length + 1}
          aria-colcount={shownColumns.length}
          onScroll={onScroll}
          onResize={(size) => setViewportWidth(size.width)}
          className="vgrid"
          // composited scrolling: without it Chrome repaints the grid every
          // frame on non-retina screens (to keep LCD text), ~5ms per frame
          style={{
            minHeight: 0,
            "--vgrid-auto-height":
              listHeight === undefined ? undefined : `${listHeight}px`,
            overflow: "auto",
            // no rows: a header wider than the box must not add a scrollbar
            overflowX: rows.length === 0 ? "hidden" : undefined,
            willChange: "scroll-position"
          }}
        >
          <Header
            headerHeight={headerHeight}
            rowWidth={rowWidth}
            pinnedColumns={pinnedColumns}
            pinnedWidth={pinnedWidth}
            scrollColumns={scrollColumns}
            offsets={offsets}
          />
          {rows.length === 0 && renderEmpty && (
            <div className="vgrid__empty">{renderEmpty()}</div>
          )}
        </List>
      </ColumnWindowContext.Provider>
    </div>
  );
};
