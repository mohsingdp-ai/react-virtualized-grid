// Widths for columns with `width: "auto"`.
//
// Text values (row[key], or a `render` that returns a string/number) are
// measured for EVERY row on a canvas, in the cells' real font, so rows that
// aren't on screen still count. Custom JSX cells: their text is read from the
// returned elements for every row too (<span>{text}</span>), measured in the
// font the rendered cells use, plus the extra width (padding, icons) those
// rendered cells show. Padding and borders come from a rendered cell's
// computed style.

const boxOf = (el) => {
  const cs = getComputedStyle(el);
  return {
    font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
    letterSpacing: cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing,
    extra:
      parseFloat(cs.paddingLeft) +
      parseFloat(cs.paddingRight) +
      parseFloat(cs.borderLeftWidth) +
      parseFloat(cs.borderRightWidth)
  };
};

// own canvas each: a shared one would leave every measurer on the last font set
const textMeasurer = (box) => {
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = box.font;
  if ("letterSpacing" in ctx) ctx.letterSpacing = box.letterSpacing;
  return (text) => ctx.measureText(text).width;
};

// width of an element's content regardless of its box (works for cut-off content)
const contentWidth = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width;
};

const isText = (value) =>
  typeof value === "string" || typeof value === "number";

// Text inside JSX made of plain elements (<span>{text}</span>); null when a
// component is involved, since its output isn't known without rendering it.
const textOf = (node) => {
  if (node == null || typeof node === "boolean") return "";
  if (isText(node)) return String(node);
  if (Array.isArray(node)) {
    let text = "";
    for (const child of node) {
      const t = textOf(child);
      if (t == null) return null;
      text += t;
    }
    return text;
  }
  // host element ("span") or fragment
  if (typeof node.type === "string" || typeof node.type === "symbol")
    return textOf(node.props?.children);
  return null;
};

// ponytail: calls `render` once per row per auto column when rows change; for
// 100k+ rows with heavy renders, measure a sample instead
const widestValues = (column, rows, measureText, measureJsx) => {
  let text = 0;
  let jsx = 0;
  for (let i = 0; i < rows.length; i++) {
    const value = column.render
      ? column.render(rows[i], i)
      : rows[i][column.key];
    if (isText(value)) text = Math.max(text, measureText(String(value)));
    else if (measureJsx) {
      const t = textOf(value);
      if (t) jsx = Math.max(jsx, measureJsx(t));
    }
  }
  return { text, jsx };
};

// JSX cells of a column on screen: the font their text is drawn in (that of
// the first text's element) and the most extra width any of them adds.
// ponytail: one font per cell assumed; mixed fonts inside a cell end up in
// `extra` from the cells on screen only
const jsxSample = (cells) => {
  let font;
  let extra = 0;
  for (const cell of cells) {
    if (cell.firstElementChild == null) continue; // plain text cell
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) && !node.nodeValue.trim());
    if (!node) continue;
    font ??= textMeasurer(boxOf(node.parentElement));
    extra = Math.max(
      extra,
      contentWidth(cell) + boxOf(cell).extra - font(cell.textContent)
    );
  }
  return font && ((text) => font(text) + extra);
};

// Map of column key -> px for every auto column in `columns`.
export const measureAutoWidths = (root, rows, columns) => {
  const widths = new Map();
  const anyCell = root.querySelector(".vgrid__cell, .vgrid__pinned-cell");
  const anyHeader = root.querySelector(".vgrid__header-cell");

  for (const column of columns) {
    if (column.width !== "auto") continue;
    const selector = `[data-column="${CSS.escape(column.key)}"]`;
    const cells = root.querySelectorAll(
      `.vgrid__cell${selector}, .vgrid__pinned-cell${selector}`
    );
    // the column's own cells, so per-column CSS (font-weight etc.) counts;
    // any cell if none of its cells is on screen
    const sampleCell = cells[0] ?? anyCell;
    const sampleHeader =
      root.querySelector(`.vgrid__header-cell${selector}`) ?? anyHeader;
    const cellBox = sampleCell && boxOf(sampleCell);
    const headerBox = sampleHeader && boxOf(sampleHeader);
    const measureJsx = column.render && jsxSample(cells);
    let widest = 0;
    if (cellBox) {
      const { text, jsx } = widestValues(
        column,
        rows,
        textMeasurer(cellBox),
        measureJsx
      );
      if (text) widest = text + cellBox.extra;
      widest = Math.max(widest, jsx);
    }
    if (headerBox && !column.renderHeader) {
      const label = String(column.header ?? column.key);
      widest = Math.max(
        widest,
        textMeasurer(headerBox)(label) + headerBox.extra
      );
    }
    // custom JSX cells and headers: measure what's rendered
    for (const el of root.querySelectorAll(selector)) {
      widest = Math.max(widest, contentWidth(el) + boxOf(el).extra);
    }
    if (widest > 0) {
      const w = Math.ceil(widest) + 1; // +1: sub-pixel rounding
      widths.set(
        column.key,
        Math.min(column.maxWidth ?? Infinity, Math.max(column.minWidth ?? 0, w))
      );
    }
  }
  return widths;
};

export const sameWidths = (a, b) => {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const [key, value] of a) if (b.get(key) !== value) return false;
  return true;
};
