import fs from "node:fs";
import path from "node:path";

const readSource = (file: string) =>
  fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("依頼されたKISSレイアウト契約", () => {
  it.each([
    "src/app/discussions/page.tsx",
    "src/app/discussions/[naddr]/page.tsx",
  ])("%s の主要セクションをPCでも二列にしない", (file) => {
    expect(readSource(file)).not.toContain("lg:grid-cols-2");
  });

  it("使い方の画像へレスポンシブ寸法を共通指定する", () => {
    const source = readSource("src/app/usage/page.tsx");

    expect(source).toContain("function UsageImage");
    expect(source).toContain('className="h-auto w-full max-w-[300px]"');
    expect(source).toContain('sizes="(max-width: 640px) calc(100vw - 4rem), 300px"');
  });

  it("設定の未ログイン表示に人物アイコンを置かない", () => {
    expect(readSource("src/app/settings/page.tsx")).not.toContain(
      "UserCircleIcon",
    );
  });
});
