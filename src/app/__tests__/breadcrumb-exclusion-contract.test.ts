import { readFileSync } from "node:fs";
import path from "node:path";

jest.unmock("fs");

const EXCLUDED_SOURCES: ReadonlyArray<readonly [string, string]> = [
  [
    "src/app/discussions/[naddr]/page.tsx",
    "会話一覧に戻る",
  ],
  [
    "src/app/discussions/[naddr]/edit/page.tsx",
    "会話一覧に戻る",
  ],
  [
    "src/app/discussions/[naddr]/approve/page.tsx",
    "会話一覧に戻る",
  ],
  [
    "src/app/rate-limit/page.tsx",
    "発生元の画面へ戻る",
  ],
];

describe("breadcrumb exclusion contract", () => {
  it("keeps in-place back actions outside the breadcrumb navigation", () => {
    for (const [sourcePath, expectedText] of EXCLUDED_SOURCES) {
      const source = readFileSync(
        path.join(process.cwd(), sourcePath),
        "utf8",
      );
      expect(source).toContain(expectedText);
    }
  });

  it("does not pass breadcrumbs to the rate-limit page header", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/rate-limit/page.tsx"),
      "utf8",
    );
    expect(source).not.toContain("breadcrumbs");
  });
});
