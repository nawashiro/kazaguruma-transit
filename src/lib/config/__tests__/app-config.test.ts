import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../../../../");
const appConfigExamplePath = path.join(projectRoot, "app-config.json.example");

type AppConfigModule = {
  parseAppConfig?: (value: unknown) => unknown;
};

function requireAppConfigModule(): AppConfigModule {
  try {
    return jest.requireActual("../app-config") as AppConfigModule;
  } catch (error) {
    throw new Error(
      `app-config public module is not implemented: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function readAppConfigExample(): unknown {
  if (!existsSync(appConfigExamplePath)) {
    throw new Error(
      `app-config.json.example is not implemented: ${appConfigExamplePath}`,
    );
  }
  return JSON.parse(readFileSync(appConfigExamplePath, "utf8")) as unknown;
}

const validConfig = {
  appUrl: "http://localhost:3000",
  gaMeasurementId: "",
  locationsDataVersion: "1.0.0",
  discussion: {
    enabled: false,
    adminPubkey: "",
    busStopDiscussionId: "",
    discussionListNaddr: "",
    nostrRelays: ["wss://relay.example"],
    nostrTimeoutMs: 5000,
    readStrategy: {
      idleTimeoutMs: 5000,
      hardTimeoutMs: 15000,
      dedupWindowMs: 250,
    },
  },
  support: {
    enabled: true,
    koFiUsername: "nawashiro",
    heading: "開発者を支援する",
    message: "支援メッセージ",
  },
};

describe("app-config public module", () => {
  it("provides the tracked public template with the required sections", () => {
    const config = readAppConfigExample();

    expect(config).toEqual(
      expect.objectContaining({
        appUrl: expect.any(String),
        gaMeasurementId: expect.any(String),
        locationsDataVersion: expect.any(String),
        discussion: expect.objectContaining({
          enabled: expect.any(Boolean),
          adminPubkey: expect.any(String),
          busStopDiscussionId: expect.any(String),
          discussionListNaddr: expect.any(String),
          nostrRelays: expect.any(Array),
          nostrTimeoutMs: expect.any(Number),
          readStrategy: expect.objectContaining({
            idleTimeoutMs: expect.any(Number),
            hardTimeoutMs: expect.any(Number),
            dedupWindowMs: expect.any(Number),
          }),
        }),
        support: expect.objectContaining({
          enabled: expect.any(Boolean),
          koFiUsername: expect.any(String),
          heading: expect.any(String),
          message: expect.any(String),
        }),
      }),
    );
  });

  it("exports a parser that accepts the documented shape", () => {
    const appConfigModule = requireAppConfigModule();
    expect(appConfigModule.parseAppConfig).toEqual(expect.any(Function));
    expect(appConfigModule.parseAppConfig?.(validConfig)).toEqual(validConfig);
  });

  it.each([
    ["missing appUrl", { ...validConfig, appUrl: undefined }],
    ["missing discussion", { ...validConfig, discussion: undefined }],
    ["missing support", { ...validConfig, support: undefined }],
    ["invalid relay list", {
      ...validConfig,
      discussion: { ...validConfig.discussion, nostrRelays: ["wss://ok", 1] },
    }],
  ])("rejects %s with a Japanese configuration error", (_name, config) => {
    const appConfigModule = requireAppConfigModule();
    expect(appConfigModule.parseAppConfig).toEqual(expect.any(Function));
    expect(() => appConfigModule.parseAppConfig?.(config)).toThrow(
      "app-config.jsonの形式が不正です",
    );
  });
});
