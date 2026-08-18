import { readFileSync } from "node:fs";
import path from "node:path";

const globalsCss = readFileSync(
  path.resolve(process.cwd(), "src/app/globals.css"),
  "utf8",
);

function readTopLevelRule(selector: string): string {
  const rule = globalsCss.match(
    new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`, "m"),
  );

  return rule?.[1] ?? "";
}

describe("ルビのアクセシビリティCSS契約", () => {
  it("rtのmarginではなくrubyのline-heightで本文との間隔を確保する", () => {
    const rubyRule = readTopLevelRule("ruby");
    const rtRule = readTopLevelRule("rt");

    expect(rubyRule).toMatch(/line-height:\s*[^;]+/);
    expect(rtRule).not.toMatch(
      /margin(?:-(?:top|bottom|block-start|block-end))?\s*:/,
    );
  });

  it("カテゴリタブではDaisyUIの半透明色より本文色を優先する", () => {
    expect(globalsCss).toMatch(
      /\.tabs\.tabs-box\s*>\s*\.tab\.text-base-content\s*\{[\s\S]*?color:\s*var\(--color-base-content\)/,
    );
  });
});
