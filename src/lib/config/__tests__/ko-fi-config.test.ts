import { buildKoFiPageUrl, buildKoFiWidgetUrl } from "../ko-fi-config";

describe("Ko-fi URL設定", () => {
  it("ユーザー名から公式形式の埋め込みURLを組み立てる", () => {
    expect(buildKoFiWidgetUrl("nawashiro")).toBe(
      "https://ko-fi.com/nawashiro/?hidefeed=true&widget=true&embed=true&preview=true",
    );
  });

  it("ユーザー名からKo-fiページのURLを作る", () => {
    expect(buildKoFiPageUrl("nawashiro")).toBe(
      "https://ko-fi.com/nawashiro/",
    );
  });
});
