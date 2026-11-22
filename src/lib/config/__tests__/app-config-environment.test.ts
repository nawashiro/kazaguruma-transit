import {
  appConfigFileName,
  parseAppConfigEnvironment,
  resolveAppConfigEnvironment,
} from "../app-config-environment";

describe("公開アプリ設定の環境解決", () => {
  it("APP_CONFIG_ENVの明示指定をNODE_ENVより優先する", () => {
    expect(
      resolveAppConfigEnvironment({
        APP_CONFIG_ENV: "local",
        NODE_ENV: "production",
      }),
    ).toBe("local");
    expect(
      resolveAppConfigEnvironment({
        APP_CONFIG_ENV: "production",
        NODE_ENV: "development",
      }),
    ).toBe("production");
  });

  it("NODE_ENVがproductionのときだけ本番用を選ぶ", () => {
    expect(resolveAppConfigEnvironment({ NODE_ENV: "production" })).toBe(
      "production",
    );
    expect(resolveAppConfigEnvironment({ NODE_ENV: "development" })).toBe(
      "local",
    );
    expect(resolveAppConfigEnvironment({ NODE_ENV: "test" })).toBe("local");
    expect(resolveAppConfigEnvironment({})).toBe("local");
  });

  it("未知のAPP_CONFIG_ENVを有効値の案内つきで拒否する", () => {
    expect(() =>
      resolveAppConfigEnvironment({ APP_CONFIG_ENV: "staging" }),
    ).toThrow(/APP_CONFIG_ENV/);
    expect(() =>
      resolveAppConfigEnvironment({ APP_CONFIG_ENV: "staging" }),
    ).toThrow(/local/);
    expect(() => parseAppConfigEnvironment("staging")).toThrow(/production/);
  });

  it("環境に応じた設定ファイル名を返す", () => {
    expect(appConfigFileName("local")).toBe("app-config.local.json");
    expect(appConfigFileName("production")).toBe("app-config.json");
  });
});
