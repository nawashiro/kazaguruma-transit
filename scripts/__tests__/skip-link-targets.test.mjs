import assert from "node:assert/strict";
import { test } from "node:test";
import puppeteer from "puppeteer";

const baseUrl = process.env.ACCESSIBILITY_BASE_URL ?? "http://127.0.0.1:3000";

test("focused skip link leaves header targets unobscured and reaches main", async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    for (const theme of ["cupcake", "dark"]) {
      for (const width of [320, 390, 1024, 1440]) {
        await page.setViewport({ width, height: 900 });
        await page.goto(baseUrl, { waitUntil: "networkidle2" });
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute("href")), "#main-content");
        const targets = await page.evaluate(() => {
          const skip = document.activeElement.getBoundingClientRect();
          return [...document.querySelectorAll(".drawer-content > div button, .drawer-content > div label")]
            .filter((element) => element.getClientRects().length && element.getBoundingClientRect().width > 0)
            .map((element) => {
              const rect = element.getBoundingClientRect();
              const overlapWidth = Math.max(0, Math.min(skip.right, rect.right) - Math.max(skip.left, rect.left));
              const overlapHeight = Math.max(0, Math.min(skip.bottom, rect.bottom) - Math.max(skip.top, rect.top));
              return { name: element.textContent, overlapArea: overlapWidth * overlapHeight };
            });
        });
        assert.ok(targets.length > 0);
        for (const target of targets) {
          assert.equal(target.overlapArea, 0, `${theme}/${width}: skip link overlaps ${target.name}`);
        }
        await page.keyboard.press("Enter");
        assert.equal(await page.evaluate(() => document.activeElement.id), "main-content");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
    }
  } finally {
    await browser.close();
  }
});
