import fs from "node:fs";
import path from "node:path";

const sourceDirectory = path.resolve(process.cwd(), "src");

function findTsxFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : findTsxFiles(entryPath);
    }

    return entry.name.endsWith(".tsx") ? [entryPath] : [];
  });
}

const sourceFiles = findTsxFiles(sourceDirectory);
const relativePath = (file: string) => path.relative(process.cwd(), file);

describe("共通DOM構造契約", () => {
  it("mainランドマークを共通レイアウトだけに定義する", () => {
    const filesWithMain = sourceFiles
      .filter((file) => /<main\b|role=["']main["']/.test(fs.readFileSync(file, "utf8")))
      .map(relativePath)
      .sort();

    expect(filesWithMain).toEqual(["src/components/layouts/SidebarLayout.tsx"]);
  });

  it("h1を共通ページ見出しだけに定義する", () => {
    const filesWithH1 = sourceFiles
      .filter((file) => fs.readFileSync(file, "utf8").includes("<h1"))
      .map(relativePath)
      .sort();

    expect(filesWithH1).toEqual(["src/components/layouts/PageHeader.tsx"]);
  });

  it("articleを独立した会話一覧項目だけに使用する", () => {
    const filesWithArticle = sourceFiles
      .filter((file) => fs.readFileSync(file, "utf8").includes("<article"))
      .map(relativePath)
      .sort();

    expect(filesWithArticle).toEqual(["src/app/discussions/page.tsx"]);
  });
});
