import { appConfig } from "@/lib/config/app-config";
import { loadKoFiContent, loadKoFiUsername } from "@/lib/config/ko-fi-funding";

describe("Ko-fi支援表示設定", () => {
  const originalSupport = { ...appConfig.support };

  afterEach(() => {
    appConfig.support = { ...originalSupport };
  });

  it("app-config.jsonのKo-fiユーザー名を読み取る", () => {
    expect(loadKoFiUsername()).toBe("nawashiro");
  });

  it("app-config.jsonの見出しと説明文を読み取る", () => {
    expect(loadKoFiContent()).toEqual({
      heading: "開発者を支援する",
      message:
        "私は現在、労働災害で負った障害により、通常の仕事に就くことができません。貯金を切り崩して生活しています。継続的な支援があれば、活動を続けることができるかもしれません。支援をお願いします。",
    });
  });

  it("支援表示を無効にするとユーザー名を返さない", () => {
    appConfig.support.enabled = false;

    expect(loadKoFiUsername()).toBeNull();
  });
});
