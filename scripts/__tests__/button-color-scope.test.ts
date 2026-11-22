/** @jest-environment node */

import { readFileSync } from "node:fs";
import postcss from "postcss";

function parentSelector(declaration: postcss.Declaration): string {
  const parent = declaration.parent as postcss.Rule;
  return parent.selector;
}

it("confines brand overrides to the shared Button and the Ruby toggle", () => {
  const css = postcss.parse(readFileSync("src/app/globals.css", "utf8"));

  let count = 0;
  css.walkDecls(/^--color-(primary|secondary)(-content)?$/, (declaration) => {
    count += 1;
    for (const selector of postcss.list.comma(parentSelector(declaration))) {
      expect(selector).toMatch(/(?:\.transit-button|\.my-toggle)/);
    }
  });
  expect(count).toBeGreaterThanOrEqual(3);

  css.walkDecls(/^--focus-color(-light)?$/, (declaration) => {
    if (parentSelector(declaration) === ":root") return;
    for (const selector of postcss.list.comma(parentSelector(declaration))) {
      expect(selector).toMatch(/\.transit-button/);
      expect(selector).toMatch(/\.my-toggle/);
    }
  });
});
