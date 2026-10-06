import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";

export interface VirtualGridColumn<Row> {
  /** Unique id. Also the field read from each row when there is no `render`. */
  key: string;
  /** Header label. Defaults to `key`. */
  header?: ReactNode;
  /** Width in px. Default 150. */
  width?: number;
  /** Stick to the left edge while scrolling sideways. Initial value when the column manager is on. */
  pinned?: boolean;
  /** Start hidden. Initial value when the column manager is on. */
  hidden?: boolean;
  /** Set false to stop users hiding it in the column manager. Default true. */
  hideable?: boolean;
  /** Custom cell content. Default: `row[key]`. */
  render?: (row: Row, rowIndex: number) => ReactNode;
  /** Custom header content. Default: `header`. */
  renderHeader?: () => ReactNode;
}

/** Column layout from the column manager. Arrays of column keys; safe to JSON.stringify. */
export interface ColumnState {
  /** All columns in display order, pinned ones first. */
  order: string[];
  hidden: string[];
  pinned: string[];
}

export interface VirtualGridProps<Row>
  extends Omit<HTMLAttributes<HTMLDivElement>, "onScroll" | "onResize"> {
  rows: readonly Row[];
  columns: readonly VirtualGridColumn<Row>[];
  /** Row height in px. Default 30. */
  rowHeight?: number;
  /** Header height in px. Default 30. */
  headerHeight?: number;
  /** Any CSS width. Default "100%". */
  width?: number | string;
  /** Any CSS height. Required: the grid scrolls inside it. */
  height: number | string;
  /** Extra rows rendered above/below the viewport. Default 1. */
  overscanRowCount?: number;
  /**
   * Column manager panel: reorder (drag or ↑/↓), show/hide and pin columns. Default false.
   * - `true`: the grid shows its own "Columns" button.
   * - a string id: no built-in button; any `<button popoverTarget={id}>` on the page opens it.
   */
  columnManager?: boolean | string;
  /** Restore a saved layout (from `onColumnStateChange`). Read once on mount. Unknown keys are ignored, new columns added. */
  initialColumnState?: ColumnState;
  /** Called whenever the user changes the layout. Save it to restore later. */
  onColumnStateChange?: (state: ColumnState) => void;
  /**
   * Save the layout in this browser (localStorage) under this key and restore it on load.
   * Per browser and device only; use onColumnStateChange + initialColumnState to save on a server.
   */
  persistKey?: string;
  className?: string;
  style?: CSSProperties;
}

export function VirtualGrid<Row = Record<string, unknown>>(
  props: VirtualGridProps<Row>
): ReactElement;
