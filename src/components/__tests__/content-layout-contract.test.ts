import fs from "node:fs";
import path from "node:path";

const leftAlignedContentFiles = [
  "src/components/discussion/EvaluationComponent.tsx",
  "src/components/features/IntegratedRouteDisplay.tsx",
];

describe("ページ内コンテンツのレイアウト契約", () => {
  it.each(leftAlignedContentFiles)("%s の文章を中央揃えにしない", (file) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

    expect(source).not.toContain("text-center");
  });

  it("カルーセルが共通ページ幅の内側に別の最大幅を作らない", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/ui/CarouselCard.tsx"),
      "utf8",
    );

    expect(source).not.toContain("max-w-screen-lg");
    expect(source).not.toContain("mx-auto");
  });
});
