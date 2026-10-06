// Widths for columns with `width: "auto"`.
//
// Text values (row[key], or a `render` that returns a string/number) are
// measured for EVERY row on a canvas, in the cells' real font, so rows that
// aren't on screen still count. Custom JSX cells can't be measured off-screen,
// so for those the cells currently rendered are measured instead. Padding and
// borders come from a rendered cell's computed style.

let canvas;

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

const textMeasurer = (box) => {
  const ctx = (canvas ??= document.createElement("canvas")).getContext("2d");
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

// ponytail: calls `render` once per row per auto column when rows change; for
// 100k+ rows with heavy renders, measure a sample instead
const widestText = (column, rows, measure) => {
  let widest = 0;
  for (let i = 0; i < rows.length; i++) {
    const value = column.render
      ? column.render(rows[i], i)
      : rows[i][column.key];
    if (isText(value)) widest = Math.max(widest, measure(String(value)));
  }
  return widest;
};

// Map of column key -> px for every auto column in `columns`.
export const measureAutoWidths = (root, rows, columns) => {
  const widths = new Map();
  const sampleCell = root.querySelector(".vgrid__cell, .vgrid__pinned-cell");
  const sampleHeader = root.querySelector(".vgrid__header-cell");
  const cellBox = sampleCell && boxOf(sampleCell);
  const headerBox = sampleHeader && boxOf(sampleHeader);

  for (const column of columns) {
    if (column.width !== "auto") continue;
    let widest = 0;
    if (cellBox) {
      const text = widestText(column, rows, textMeasurer(cellBox));
      if (text) widest = text + cellBox.extra;
    }
    if (headerBox && !column.renderHeader) {
      const label = String(column.header ?? column.key);
      widest = Math.max(
        widest,
        textMeasurer(headerBox)(label) + headerBox.extra
      );
    }
    // custom JSX cells and headers: measure what's rendered
    for (const el of root.querySelectorAll(
      `[data-column="${CSS.escape(column.key)}"]`
    )) {
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
