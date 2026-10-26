import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

test("brand overrides are confined to shared Button and Ruby toggle", () => {
  const css = postcss.parse(readFileSync("src/app/globals.css", "utf8"));
  let count = 0;
  css.walkDecls(/^--color-(primary|secondary)(-content)?$/, (declaration) => {
    count++;
    for (const selector of postcss.list.comma(declaration.parent.selector)) {
      assert.match(selector, /(?:\.transit-button|\.my-toggle)/, selector);
    }
  });
  assert.ok(count >= 3);
  css.walkDecls(/^--focus-color(-light)?$/, (declaration) => {
    if (declaration.parent.selector === ":root") return;
    for (const selector of postcss.list.comma(declaration.parent.selector)) {
      assert.match(selector, /\.transit-button/);
      assert.match(selector, /\.my-toggle/);
    }
  });
});
