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
const Cell = memo(({ row, rowIndex, column, left }) => (
  <div className="vgrid__cell" style={{ left, width: column.width }}>
    {cellContent(column, row, rowIndex)}
  </div>
));

const PinnedCells = memo(({ row, rowIndex, pinnedColumns, pinnedWidth }) => (
  <div className="vgrid__pinned" style={{ width: pinnedWidth }}>
    {pinnedColumns.map((column) => (
      <div
        key={column.key}
        className="vgrid__pinned-cell"
        style={{ width: column.width }}
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
  slots
}) => {
  const [first, last] = useContext(ColumnWindowContext);
  const row = rows[index];
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
        left={pinnedWidth + offsets[c]}
      />
    );
  }
  return (
    <div
      className="vgrid__row"
      style={{ ...style, top: headerHeight, width: rowWidth }}
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
      >
        {headerContent(column)}
      </div>
    );
  }
  return (
    <div
      className="vgrid__header"
      style={{ height: headerHeight, width: rowWidth }}
    >
      {pinnedColumns.length > 0 && (
        <div className="vgrid__pinned" style={{ width: pinnedWidth }}>
          {pinnedColumns.map((column) => (
            <div
              key={column.key}
              className="vgrid__header-cell"
              style={{ width: column.width }}
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

const sameWindow = (next) => (prev) =>
  prev[0] === next[0] && prev[1] === next[1] ? prev : next;

export const VirtualGrid = ({
  rows,
  columns,
  rowHeight = 30,
  headerHeight = 30,
  width = "100%",
  height,
  overscanRowCount = 1,
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

  const { pinnedColumns, scrollColumns, pinnedWidth, offsets } = useMemo(() => {
    const normalized = shownColumns.map((column) =>
      column.width ? column : { ...column, width: DEFAULT_COLUMN_WIDTH }
    );
    const pinned = normalized.filter((column) => column.pinned);
    const scrolling = normalized.filter((column) => !column.pinned);
    return {
      pinnedColumns: pinned,
      scrollColumns: scrolling,
      pinnedWidth: pinned.reduce((sum, column) => sum + column.width, 0),
      offsets: columnOffsets(scrolling.map((column) => column.width))
    };
  }, [shownColumns]);
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
  const [visibleWindow, setVisibleWindow] = useState(() => getWindow(0));
  // re-fit before paint when the size or columns change
  useLayoutEffect(() => {
    setVisibleWindow(sameWindow(getWindow(scrollLeftRef.current)));
  }, [getWindow]);

  const onScroll = (event) => {
    scrollLeftRef.current = event.currentTarget.scrollLeft;
    setVisibleWindow(sameWindow(getWindow(scrollLeftRef.current)));
  };

  const panelId = `vgrid-columns-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const [managerOpen, setManagerOpen] = useState(false);

  return (
    <div
      className={className ? `vgrid-root ${className}` : "vgrid-root"}
      style={{ width, height, ...style }}
      {...rest}
    >
      {columnManager && (
        <div className="vgrid-toolbar">
          <button
            type="button"
            className="vgrid-toolbar__button"
            popoverTarget={panelId}
            style={{ anchorName: `--${panelId}` }}
          >
            Columns
          </button>
          <div
            id={panelId}
            popover="auto"
            className="vgrid-manager"
            aria-label="Columns"
            style={{ positionAnchor: `--${panelId}` }}
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
            slots
          }}
          onScroll={onScroll}
          onResize={(size) => setViewportWidth(size.width)}
          className="vgrid"
          // composited scrolling: without it Chrome repaints the grid every
          // frame on non-retina screens (to keep LCD text), ~5ms per frame
          style={{
            minHeight: 0,
            overflow: "auto",
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
        </List>
      </ColumnWindowContext.Provider>
    </div>
  );
};
