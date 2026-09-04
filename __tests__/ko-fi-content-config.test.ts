import { appConfig } from "@/lib/config/app-config";
import { loadKoFiContent, loadKoFiUsername } from "@/lib/config/ko-fi-funding";

describe("Ko-fi支援表示設定", () => {
  const originalSupport = { ...appConfig.support };

  afterEach(() => {
    appConfig.support = { ...originalSupport };
  });

  it("app-config.jsonのKo-fiユーザー名を読み取る", () => {
    expect(loadKoFiUsername()).toBe(
      appConfig.support.enabled ? appConfig.support.koFiUsername : null,
    );
  });

  it("app-config.jsonの見出しと説明文を読み取る", () => {
    expect(loadKoFiContent()).toEqual({
      heading: appConfig.support.heading,
      message: appConfig.support.message,
    });
  });

  it("支援表示を無効にするとユーザー名を返さない", () => {
    appConfig.support.enabled = false;

    expect(loadKoFiUsername()).toBeNull();
  });
});
