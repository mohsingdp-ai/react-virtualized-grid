// Browser regression test: the grid must not crash when the column manager
// shrinks or grows the visible columns (hide, pin, reset, show all, resize).
// Runs in the locally installed Chrome; no browser download.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./helpers.mjs";
import { chromium } from "playwright-core";

test("hide / pin / reset / resize never crash the grid", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
    await page.goto(`${server.resolvedUrls.local[0]}e2e/column-shrink.html`);
    await page.waitForSelector(".vgrid__cell");

    const headers = () =>
      page.$$eval(".vgrid__header-cell--scroll", (els) =>
        els
          .sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left))
          .map((e) => e.textContent)
      );
    const step = async (label, action) => {
      await action();
      await page.waitForTimeout(100);
      assert.deepEqual(await page.evaluate(() => window.__errors), [], `crashed after: ${label}`);
      assert.ok(await page.$(".vgrid__cell"), `grid gone after: ${label}`);
    };
    const click = (selector) => () => page.click(selector);

    await page.click(".vgrid-toolbar__button");
    await step("hide the last visible column", click('[data-key="c8"] input'));
    assert.equal((await headers()).at(-1), "Col 7");
    await step("hide a middle column", click('[data-key="c3"] input'));
    await step("pin a column", click('[data-key="c5"] .vgrid-manager__pin'));
    assert.ok(!(await headers()).includes("Col 5"), "pinned column left the scrolling area");
    await step("reset", click(".vgrid-manager__footer button:last-child"));
    assert.deepEqual(await headers(), ["Col 0", "Col 1", "Col 2", "Col 3", "Col 4", "Col 5", "Col 6", "Col 7", "Col 8"]);
    await step("show all", click(".vgrid-manager__footer button:first-child"));

    // scrolled to the far right, then shrink: the window sits on the last column
    await page.keyboard.press("Escape");
    await page.$eval(".vgrid", (el) => el.scrollTo(el.scrollWidth, 0));
    await page.waitForTimeout(100);
    await page.click(".vgrid-toolbar__button");
    // the panel list is virtualized too: scroll it so the last column's row exists
    await page.waitForSelector(".vgrid-manager__list");
    await page.$eval(".vgrid-manager__list", (el) => el.scrollTo(0, el.scrollHeight));
    await step("hide the last column while scrolled to the end", click('[data-key="c17"] input'));
    await step("reset while scrolled to the end", click(".vgrid-manager__footer button:last-child"));

    await step("shrink the viewport", () => page.setViewportSize({ width: 600, height: 800 }));
    await step("grow the viewport", () => page.setViewportSize({ width: 1440, height: 800 }));
  } finally {
    await browser.close();
    await server.close();
  }
});

test("columnManager=\"id\": the app's own button opens the panel under it", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
    await page.goto(`${server.resolvedUrls.local[0]}e2e/column-shrink.html?external`);
    await page.waitForSelector(".vgrid__cell");
    assert.equal(await page.$(".vgrid-toolbar"), null, "no built-in Columns button");

    await page.click("#my-columns");
    await page.waitForSelector(".vgrid-manager__list");
    const button = await page.locator("#my-columns").boundingBox();
    const panel = await page.locator(".vgrid-manager").boundingBox();
    assert.ok(Math.abs(panel.y - (button.y + button.height)) <= 8, "panel opens just below the button");
    assert.ok(Math.abs(panel.x + panel.width - (button.x + button.width)) <= 2, "panel right-aligned to the button");

    await page.click('[data-key="c8"] input');
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(() => window.__errors), []);
    assert.equal(await page.$('.vgrid__header-cell--scroll >> text="Col 8"'), null, "Col 8 hidden");

    await page.click("#my-columns"); // same button closes it
    assert.equal(await page.locator(".vgrid-manager").evaluate((el) => el.matches(":popover-open")), false);
  } finally {
    await browser.close();
    await server.close();
  }
});
