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
});
