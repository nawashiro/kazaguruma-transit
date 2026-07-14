import fs from "node:fs";
import path from "node:path";

const sourceFiles = [
  "src/app/discussions/create/page.tsx",
  "src/app/locations/page.tsx",
  "src/app/settings/page.tsx",
  "src/components/discussion/EvaluationComponent.tsx",
  "src/components/discussion/LoginModal.tsx",
  "src/components/features/LocationSuggestions.tsx",
  "src/components/layouts/SidebarLayout.tsx",
  "src/components/ui/NpubDisplay.tsx",
  "src/components/ui/ThemeToggle.tsx",
];

const readSource = (file: string) =>
  fs
    .readFileSync(path.resolve(process.cwd(), file), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("アクセシビリティ実装契約", () => {
  it("対象ソースに手書きSVGを残さない", () => {
    const inlineSvgFiles = sourceFiles.filter((file) =>
      readSource(file).includes("<svg")
    );

    expect(inlineSvgFiles).toEqual([]);
  });

  it("タブの選択状態に無効なarea-selected属性を使わない", () => {
    const invalidFiles = sourceFiles.filter((file) =>
      readSource(file).includes("area-selected")
    );

    expect(invalidFiles).toEqual([]);
  });
});
