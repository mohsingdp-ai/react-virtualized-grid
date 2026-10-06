// Browser test for width: "auto": measured across all rows, min/max caps,
// custom JSX cells, and stable while scrolling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withPage } from "./helpers.mjs";

const widthOf = (page, testId) =>
  page.$eval(`[data-testid="${testId}-header"]`, (el) => Math.round(el.getBoundingClientRect().width));

// a cell fits when its content isn't cut off
const fits = (page, selector) =>
  page.$$eval(selector, (els) => els.every((el) => el.scrollWidth <= el.clientWidth));

test('width: "auto" fits the widest value across all rows', () =>
  withPage(async (page, base) => {
    await page.goto(`${base}e2e/auto-width.html`);
    // last column: only rendered once the grid's width is measured (async)
    await page.waitForSelector('[data-testid="tiny-header"]');
    await page.waitForTimeout(200);

    const before = {
      name: await widthOf(page, "name"),
      memo: await widthOf(page, "memo"),
      status: await widthOf(page, "status"),
      narration: await widthOf(page, "narration"),
      tiny: await widthOf(page, "tiny")
    };

    // caps
    assert.equal(before.memo, 200, "maxWidth caps the column");
    assert.equal(before.tiny, 90, "minWidth floors the column");

    // the long name is on row 400, which isn't rendered yet
    assert.equal(await page.$('.vgrid__row[aria-rowindex="402"]'), null, "row 400 not rendered at load");
    assert.ok(before.name > 400, `name column sized for the long value, got ${before.name}`);

    // custom JSX badges fit (measured from rendered cells)
    assert.ok(await fits(page, '[data-testid="status"]'), "status badges not cut off");

    // scroll to row 300: the JSX narration, never on screen before, fits
    await page.$eval(".vgrid", (el) => el.scrollTo(0, 300 * 30));
    await page.waitForSelector('.vgrid__row[aria-rowindex="302"]');
    const narration = page.locator('.vgrid__row[aria-rowindex="302"] [data-testid="narration"]');
    assert.equal(await narration.textContent(), await page.evaluate(() => window.__LONG_NARRATION));
    assert.ok(await narration.evaluate((el) => el.scrollWidth <= el.clientWidth), "long JSX narration not cut off");

    // scroll to row 400: its name fits, and no column width changed
    await page.$eval(".vgrid", (el) => el.scrollTo(0, 400 * 30)); // default rowHeight 30
    await page.waitForSelector('.vgrid__row[aria-rowindex="402"]');
    const longCell = page.locator('.vgrid__row[aria-rowindex="402"] [data-testid="name"]');
    assert.equal(await longCell.textContent(), await page.evaluate(() => window.__LONG_NAME));
    assert.ok(await longCell.evaluate((el) => el.scrollWidth <= el.clientWidth), "long name not cut off");
    assert.deepEqual(
      {
        name: await widthOf(page, "name"),
        memo: await widthOf(page, "memo"),
        status: await widthOf(page, "status"),
        narration: await widthOf(page, "narration"),
        tiny: await widthOf(page, "tiny")
      },
      before,
      "widths stay the same while scrolling"
    );
    assert.deepEqual(await page.evaluate(() => window.__errors), []);
  }, { width: 1600, height: 800 }));
