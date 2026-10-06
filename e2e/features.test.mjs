// Browser tests for: screen-reader roles, onRowClick / rowProps, column
// align, auto height + maxHeight, renderEmpty, testId, styling variables.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withPage } from "./helpers.mjs";

test("grid semantics, row click, align, testId, styling variables", () =>
  withPage(async (page, base) => {
    await page.goto(`${base}e2e/features.html`);
    await page.waitForSelector(".vgrid__cell");
    const attrs = (sel, names) =>
      page.$eval(sel, (el, names) => Object.fromEntries(names.map((n) => [n, el.getAttribute(n)])), names);

    // screen readers: a grid with counted rows and columns
    assert.deepEqual(await attrs(".vgrid", ["role", "aria-rowcount", "aria-colcount"]), {
      role: "grid",
      "aria-rowcount": "7", // header + 6 rows
      "aria-colcount": "4"
    });
    assert.deepEqual(await attrs(".vgrid__header", ["role", "aria-rowindex"]), { role: "row", "aria-rowindex": "1" });
    assert.deepEqual(await attrs('.vgrid__row[data-id="100"]', ["role", "aria-rowindex"]), { role: "row", "aria-rowindex": "2" });
    assert.deepEqual(await attrs('[data-testid="id-header"]', ["role", "aria-colindex"]), { role: "columnheader", "aria-colindex": "1" });
    assert.deepEqual(await attrs('.vgrid__row[data-id="100"] [data-testid="amount"]', ["role", "aria-colindex"]), {
      role: "gridcell",
      "aria-colindex": "3"
    });

    // align: "right" on header and cells
    for (const sel of ['[data-testid="amount-header"]', '.vgrid__row[data-id="100"] [data-testid="amount"]']) {
      assert.equal(await page.$eval(sel, (el) => getComputedStyle(el).justifyContent), "flex-end", sel);
    }
    assert.equal(await page.$eval('[data-testid="id-header"]', (el) => getComputedStyle(el).justifyContent), "normal");

    // styling variables without a theme
    assert.equal(await page.$eval('.vgrid__row[data-id="100"] [data-testid="amount"]', (el) => getComputedStyle(el).paddingLeft), "7px");
    assert.equal(await page.$eval('.vgrid__row[data-id="100"]', (el) => getComputedStyle(el).borderBottomWidth), "2px");

    // rowProps: className and data-* land on the row; clicking fires both handlers
    assert.ok(await page.$('.vgrid__row.odd[data-id="101"]'), "rowProps className + data-id");
    assert.equal(await page.$eval('.vgrid__row[data-id="101"]', (el) => getComputedStyle(el).cursor), "pointer");
    await page.click('.vgrid__row[data-id="101"] [data-testid="amount"]');
    assert.deepEqual(await page.evaluate(() => window.__clicks), [
      { via: "rowProps", id: 101 },
      { via: "onRowClick", id: 101, index: 1, tag: "DIV" }
    ]);

    // auto height: 6 rows * 30 + header 30 = 210, capped at maxHeight 160 -> scrolls
    const box = await page.$eval(".vgrid-root", (el) => el.getBoundingClientRect().height);
    assert.equal(Math.round(box), 160);
    assert.ok(await page.$eval(".vgrid", (el) => el.scrollHeight > el.clientHeight), "scrolls inside maxHeight");
    assert.deepEqual(await page.evaluate(() => window.__errors), []);
  }));

test("auto height fits the rows exactly when under maxHeight", () =>
  withPage(async (page, base) => {
    await page.goto(`${base}e2e/features.html?rows=3`);
    await page.waitForSelector(".vgrid__cell");
    // toolbar + 3 rows * 30 + header 30 = toolbar + 120; the scroll area must not scroll
    assert.equal(await page.$eval(".vgrid", (el) => Math.round(el.getBoundingClientRect().height)), 120);
    assert.equal(await page.$eval(".vgrid", (el) => el.scrollHeight - el.clientHeight), 0, "no vertical scrollbar");
    assert.equal(await page.$$eval(".vgrid__row", (els) => els.length), 3);
  }));

test("renderEmpty shows under the header and keeps the Columns button", () =>
  withPage(async (page, base) => {
    await page.goto(`${base}e2e/features.html?rows=0`);
    await page.waitForSelector(".empty-msg");
    assert.equal(await page.$eval(".empty-msg", (el) => el.textContent), "No transactions");
    assert.ok(await page.$(".vgrid__header"), "header still rendered");
    assert.ok(await page.$(".vgrid-toolbar__button"), "Columns button still rendered");
    assert.equal(await page.$eval(".vgrid", (el) => el.getAttribute("aria-rowcount")), "1");
    const header = await page.$eval(".vgrid__header", (el) => el.getBoundingClientRect().bottom);
    const empty = await page.$eval(".vgrid__empty", (el) => el.getBoundingClientRect().top);
    assert.ok(Math.abs(empty - header) < 1, "empty state sits directly under the header");
    assert.deepEqual(await page.evaluate(() => window.__errors), []);
  }));
