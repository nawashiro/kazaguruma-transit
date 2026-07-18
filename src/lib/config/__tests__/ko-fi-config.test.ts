import {
  buildKoFiPageUrl,
  buildKoFiWidgetUrl,
  parseKoFiUsername,
} from "../ko-fi-config";

describe("Ko-fi設定", () => {
  it("FUNDING.ymlのko_fiユーザー名を読み取る", () => {
    expect(
      parseKoFiUsername("github: example\nko_fi: nawashiro\n"),
    ).toBe("nawashiro");
  });

  it("引用符付きのko_fiユーザー名を読み取る", () => {
    expect(parseKoFiUsername("ko_fi: 'nawashiro' # 支援先\n")).toBe(
      "nawashiro",
    );
  });

  it.each(["", "ko_fi:", "ko_fi: null", "ko_fi: false", "ko_fi: []"])(
    "ko_fiが有効でなければ支援を無効にする: %s",
    (fundingYaml) => {
      expect(parseKoFiUsername(fundingYaml)).toBeNull();
    },
  );

  it("ユーザー名から公式形式の埋め込みURLを組み立てる", () => {
    expect(buildKoFiWidgetUrl("nawashiro")).toBe(
      "https://ko-fi.com/nawashiro/?hidefeed=true&widget=true&embed=true&preview=true",
    );
  });

  it("ユーザー名からKo-fiページのURLを組み立てる", () => {
    expect(buildKoFiPageUrl("nawashiro")).toBe(
      "https://ko-fi.com/nawashiro/",
    );
  });
});
