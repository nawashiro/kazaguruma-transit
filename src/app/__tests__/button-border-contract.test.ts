import { readFileSync } from "node:fs";
import path from "node:path";

jest.unmock("fs");

const styles = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");

function withoutForcedColors(css: string): string {
  return css.replace(/@media \(forced-colors: active\)\s*\{[\s\S]*?\n\}/g, " ");
}

describe("共通ボタンの装飾枠線", () => {
  it("transit-buttonとmy-toggleの枠線を文字色で強制しない", () => {
    const normal = withoutForcedColors(styles);
    expect(normal).toMatch(/\.transit-button/);
    expect(normal).toMatch(/\.my-toggle/);
    expect(normal).not.toMatch(/\.transit-button[^{]*\{[^}]*border-color:\s*currentColor/);
    expect(normal).not.toMatch(/\.my-toggle[^{]*\{[^}]*border:[^;}]*currentColor/);
  });
});
