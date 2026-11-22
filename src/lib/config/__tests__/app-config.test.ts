import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../../../../");
const appConfigTemplateName = "app-config.json.example";

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

function readAppConfigTemplate(fileName: string): unknown {
  const templatePath = path.join(projectRoot, fileName);
  if (!existsSync(templatePath)) {
    throw new Error(`app config template is missing: ${templatePath}`);
  }
  return JSON.parse(readFileSync(templatePath, "utf8")) as unknown;
}

const validConfig = {
  appUrl: "http://localhost:3000",
  gaMeasurementId: "",
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
  announcement: {
    information: "お知らせ本文",
    url: "/announcement",
  },
};

describe("app-config environment selection", () => {
  const configFiles = {
    local: "app-config.local.json",
    production: "app-config.json",
  } as const;

  function readConfigFile(
    environment: keyof typeof configFiles,
  ): unknown {
    return JSON.parse(
      readFileSync(path.join(projectRoot, configFiles[environment]), "utf8"),
    ) as unknown;
  }

  function loadAppConfigModule() {
    return jest.requireActual("../app-config") as {
      appConfig: unknown;
      parseAppConfig: (value: unknown) => unknown;
    };
  }

  afterEach(() => {
    delete process.env.APP_CONFIG_ENV;
  });

  it("loads the local configuration when APP_CONFIG_ENV is absent", () => {
    delete process.env.APP_CONFIG_ENV;

    jest.isolateModules(() => {
      const appConfigModule = loadAppConfigModule();

      expect(appConfigModule.appConfig).toEqual(
        appConfigModule.parseAppConfig(readConfigFile("local")),
      );
    });
  });

  it("loads the production configuration when APP_CONFIG_ENV is production", () => {
    process.env.APP_CONFIG_ENV = "production";

    jest.isolateModules(() => {
      const appConfigModule = loadAppConfigModule();

      expect(appConfigModule.appConfig).toEqual(
        appConfigModule.parseAppConfig(readConfigFile("production")),
      );
    });
  });
});

describe("app-config public module", () => {
  it("provides the required sections", () => {
    const config = readAppConfigTemplate(appConfigTemplateName);

    expect(config).toEqual(
      expect.objectContaining({
        appUrl: expect.any(String),
        gaMeasurementId: expect.any(String),
        datasetJsonLdUri: expect.stringMatching(/^https?:\/\//u),
        osmMirrorUri: expect.stringMatching(/^https?:\/\//u),
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
        announcement: expect.objectContaining({
          information: expect.any(String),
          url: expect.any(String),
        }),
      }),
    );
  });

  it("keeps the tracked template on the development URL", () => {
    const template = readAppConfigTemplate(appConfigTemplateName) as {
      appUrl: string;
    };

    expect(template.appUrl).toBe("http://localhost:3000");
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
    ["missing announcement", { ...validConfig, announcement: undefined }],
    ["empty announcement information", {
      ...validConfig,
      announcement: { ...validConfig.announcement, information: "" },
    }],
    ["empty announcement url", {
      ...validConfig,
      announcement: { ...validConfig.announcement, url: "" },
    }],
    ["invalid relay list", {
      ...validConfig,
      discussion: { ...validConfig.discussion, nostrRelays: ["wss://ok", 1] },
    }],
  ])("rejects %s with a Japanese configuration error", (_name, config) => {
    const appConfigModule = requireAppConfigModule();
    expect(appConfigModule.parseAppConfig).toEqual(expect.any(Function));
    expect(() => appConfigModule.parseAppConfig?.(config)).toThrow(
      "公開アプリ設定の形式が不正です",
    );
  });
});
