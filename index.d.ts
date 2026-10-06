import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";

export interface VirtualGridColumn<Row> {
  /** Unique id. Also the field read from each row when there is no `render`. */
  key: string;
  /** Header label. Defaults to `key`. */
  header?: ReactNode;
  /** Width in px. Default 150. */
  width?: number;
  /** Stick to the left edge while scrolling sideways. */
  pinned?: boolean;
  /** Custom cell content. Default: `row[key]`. */
  render?: (row: Row, rowIndex: number) => ReactNode;
  /** Custom header content. Default: `header`. */
  renderHeader?: () => ReactNode;
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
  className?: string;
  style?: CSSProperties;
}

export function VirtualGrid<Row = Record<string, unknown>>(
  props: VirtualGridProps<Row>
): ReactElement;
