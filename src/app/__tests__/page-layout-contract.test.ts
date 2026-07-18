import fs from "node:fs";
import path from "node:path";

const appDirectory = path.resolve(process.cwd(), "src/app");

function findPageLayoutFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return findPageLayoutFiles(entryPath);
    }

    return entry.name === "page.tsx" || entry.name === "layout.tsx"
      ? [entryPath]
      : [];
  });
}

describe("ページ外枠の共通化契約", () => {
  it("各ページが共通レイアウトと重複するcontainerと左右余白を定義しない", () => {
    const duplicatedLayoutPatterns = [
      "container mx-auto px-4 py-8",
      "container mx-auto px-4 py-8 ruby-text",
      "container mx-auto px-2 pb-8 ruby-text sm:px-4",
      "container ruby-text",
      'className="container"',
    ];
    const violatingFiles = findPageLayoutFiles(appDirectory).filter((file) => {
      const source = fs.readFileSync(file, "utf8");

      return duplicatedLayoutPatterns.some((pattern) => source.includes(pattern));
    });

    expect(
      violatingFiles.map((file) => path.relative(process.cwd(), file)),
    ).toEqual([]);
  });

  it("各ページが共通レイアウトと重複するmainランドマークを定義しない", () => {
    const violatingFiles = findPageLayoutFiles(appDirectory).filter((file) => {
      const source = fs.readFileSync(file, "utf8");

      return /<main\b|role=["']main["']/.test(source);
    });

    expect(
      violatingFiles.map((file) => path.relative(process.cwd(), file)),
    ).toEqual([]);
  });

  it("ページ見出しを共通部品へ集約し、ページ側でh1を直接定義しない", () => {
    const violatingFiles = findPageLayoutFiles(appDirectory).filter((file) =>
      fs.readFileSync(file, "utf8").includes("<h1"),
    );

    expect(
      violatingFiles.map((file) => path.relative(process.cwd(), file)),
    ).toEqual([]);
  });

  it("標準ページ幅と競合する中央寄せ付き最大幅を定義しない", () => {
    const duplicatedWidthPattern =
      /(?:max-w-(?:md|lg|xl|2xl|3xl|4xl)[^"\n]*mx-auto|mx-auto[^"\n]*max-w-(?:md|lg|xl|2xl|3xl|4xl))/;
    const violatingFiles = findPageLayoutFiles(appDirectory).filter((file) =>
      duplicatedWidthPattern.test(fs.readFileSync(file, "utf8")),
    );

    expect(
      violatingFiles.map((file) => path.relative(process.cwd(), file)),
    ).toEqual([]);
  });

  it("ページ本文の文章を中央揃えにしない", () => {
    const violatingFiles = findPageLayoutFiles(appDirectory)
      .filter((file) => !file.endsWith(path.join("license", "page.tsx")))
      .filter((file) => fs.readFileSync(file, "utf8").includes("text-center"));

    expect(
      violatingFiles.map((file) => path.relative(process.cwd(), file)),
    ).toEqual([]);
  });
});
