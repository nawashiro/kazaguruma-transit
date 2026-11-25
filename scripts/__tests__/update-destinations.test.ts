import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { StopPosition } from "@/lib/transit/stop-selection";
import { createGridWalkGraph } from "@/lib/transit/test-support/walk-network-fixture";

export {};

type TransportResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type Transport = (uri: string) => Promise<TransportResponse>;

type CatalogWriter = (catalog: unknown) => Promise<void> | void;

type UpdateOptions = {
  appConfig: unknown;
  transport: Transport;
  loadStops: () => Promise<StopPosition[]>;
  readExistingCatalog: () => Promise<unknown | null>;
  writeCatalog: CatalogWriter;
  report: (message: string) => void;
  walkGraph?: ReturnType<typeof createGridWalkGraph>;
};

type UpdateCatalog = (options: UpdateOptions) => Promise<{
  source: { datasetJsonLdUri: string; osmMirrorUri: string };
  places: Array<{ id: string; name: string; includeInRouteForm: boolean }>;
}>;

const PLACES_URI = "https://fixtures.example.test/dataset.jsonld";
const OSM_MIRROR_URI = "https://fixtures.example.test/mirrors/osm.json";
const ORIGIN = { lat: 35.69, lng: 139.75 };
const KM_PER_LAT_DEGREE = 111.195;

const ID = {
  cityOffice: "urn:uuid:00000000-0000-4000-8000-000000000001",
  library: "urn:uuid:00000000-0000-4000-8000-000000000002",
  far: "urn:uuid:00000000-0000-4000-8000-000000000003",
  noOsmLink: "urn:uuid:00000000-0000-4000-8000-000000000004",
  missingElement: "urn:uuid:00000000-0000-4000-8000-000000000005",
  emptyName: "urn:uuid:00000000-0000-4000-8000-000000000006",
  vanished: "urn:uuid:00000000-0000-4000-8000-000000000007",
};

const appConfig = {
  datasetJsonLdUri: PLACES_URI,
  osmMirrorUri: OSM_MIRROR_URI,
  townGeoJsonUri: "https://fixtures.example.test/chiyoda-towns.geojson",
};

function northOfOrigin(distanceKm: number): number {
  return ORIGIN.lat + distanceKm / KM_PER_LAT_DEGREE;
}

function placeRecord(
  id: string,
  latitude: number,
  options: { seeAlso?: string[]; gifPoi?: string } = {},
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    "@id": id,
    "@type": ["schema:Place"],
    "schema:geo": {
      "@type": "schema:GeoCoordinates",
      "schema:latitude": latitude,
      "schema:longitude": ORIGIN.lng,
    },
    "schema:identifier": [
      {
        "@type": "schema:PropertyValue",
        "schema:propertyID": "gif-poi",
        "schema:value": options.gifPoi ?? "1302",
      },
    ],
  };
  if (options.seeAlso !== undefined) {
    record["rdfs:seeAlso"] = options.seeAlso;
  }
  return record;
}

const within = northOfOrigin(0.2);
const outside = northOfOrigin(0.6);

const placesJsonLd = {
  "@context": { "@version": 1.1 },
  "@graph": [
    placeRecord(ID.cityOffice, within, {
      seeAlso: [
        "https://www.openstreetmap.org/node/1001",
        "https://www.wikidata.org/entity/Q1",
      ],
    }),
    placeRecord(ID.library, within, {
      seeAlso: ["https://www.openstreetmap.org/way/1002"],
      gifPoi: "1512",
    }),
    placeRecord(ID.far, outside, {
      seeAlso: ["https://www.openstreetmap.org/node/1003"],
    }),
    placeRecord(ID.noOsmLink, within, { seeAlso: ["https://www.wikidata.org/entity/Q2"] }),
    placeRecord(ID.missingElement, within, {
      seeAlso: ["https://www.openstreetmap.org/node/9999"],
    }),
    placeRecord(ID.emptyName, within, {
      seeAlso: ["https://www.openstreetmap.org/node/1004"],
    }),
  ],
};

const osmMirror = {
  version: "202611170100",
  elements: [
    {
      type: "node",
      id: 1001,
      lat: within,
      lon: ORIGIN.lng,
      tags: { name: "千代田区役所" },
    },
    {
      type: "way",
      id: 1002,
      lat: within,
      lon: ORIGIN.lng,
      tags: { name: "千代田区立千代田図書館" },
    },
    {
      type: "node",
      id: 1003,
      lat: outside,
      lon: ORIGIN.lng,
      tags: { name: "遠い施設" },
    },
    {
      type: "node",
      id: 1004,
      lat: within,
      lon: ORIGIN.lng,
      tags: { name: "   " },
    },
  ],
};

const stops: StopPosition[] = [
  { id: "stop-1", name: "千代田区役所", lat: ORIGIN.lat, lon: ORIGIN.lng },
];

const existingCatalog = {
  source: { datasetJsonLdUri: PLACES_URI, osmMirrorUri: OSM_MIRROR_URI },
  places: [
    {
      id: ID.cityOffice,
      name: "旧い名前",
      group: "disability-support",
      includeInRouteForm: true,
    },
    { id: ID.library, name: "千代田区立千代田図書館", includeInRouteForm: false },
    { id: ID.far, name: "遠い施設", includeInRouteForm: true },
    { id: ID.vanished, name: "消えた施設", includeInRouteForm: false },
  ],
};

type LoadedModule = {
  updateDestinationCatalog?: UpdateCatalog;
};

function loadModule(): LoadedModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
  return require("../update-destinations") as LoadedModule;
}

function getUpdater(): UpdateCatalog {
  const updater = loadModule().updateDestinationCatalog;
  if (typeof updater !== "function") {
    throw new Error("updateDestinationCatalog is not implemented");
  }
  return updater;
}

type Harness = {
  options: UpdateOptions;
  transport: jest.MockedFunction<Transport>;
  writeCatalog: jest.MockedFunction<CatalogWriter>;
  reported: string[];
};

function createHarness(
  overrides: {
    places?: unknown;
    osmMirror?: unknown;
    existingCatalog?: unknown | null;
    loadStops?: () => Promise<StopPosition[]>;
    transportFailure?: boolean;
  } = {},
): Harness {
  const transport = jest.fn<ReturnType<Transport>, Parameters<Transport>>();
  transport.mockImplementation(async (uri) => {
    if (overrides.transportFailure) {
      throw new Error("network unreachable");
    }
    if (uri === PLACES_URI) {
      return jsonResponse(overrides.places ?? placesJsonLd);
    }
    if (uri === OSM_MIRROR_URI) {
      return jsonResponse(overrides.osmMirror ?? osmMirror);
    }
    throw new Error(`unexpected fixture URI: ${uri}`);
  });

  const writeCatalog = jest.fn<ReturnType<CatalogWriter>, Parameters<CatalogWriter>>();
  const reported: string[] = [];
  const existingCatalog =
    overrides.existingCatalog === undefined
      ? (JSON.parse(JSON.stringify(existingCatalogFixture)) as unknown)
      : overrides.existingCatalog;

  return {
    transport,
    writeCatalog,
    reported,
    options: {
      appConfig,
      transport,
      loadStops: overrides.loadStops ?? (async () => stops),
      readExistingCatalog: async () => existingCatalog as unknown,
      writeCatalog,
      report: (message: string) => {
        reported.push(message);
      },
      walkGraph: createGridWalkGraph(ORIGIN, 1.5, 0.01),
    },
  };
}

const existingCatalogFixture = existingCatalog;

function jsonResponse(payload: unknown, status = 200): TransportResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

describe("updateDestinationCatalog", () => {
  it("公開グラフのIDを取り、500m以内の候補を書いてOSM名のない新規recordを除く", async () => {
    const harness = createHarness();

    const catalog = await getUpdater()(harness.options);

    expect(harness.transport.mock.calls.map(([uri]) => uri)).toEqual([
      PLACES_URI,
      OSM_MIRROR_URI,
    ]);
    expect(catalog.source).toEqual({ datasetJsonLdUri: PLACES_URI, osmMirrorUri: OSM_MIRROR_URI });
    expect(catalog.places.map((place) => place.id)).toEqual([ID.cityOffice, ID.library]);
    expect(harness.writeCatalog).toHaveBeenCalledTimes(1);
    expect(harness.writeCatalog).toHaveBeenCalledWith(catalog);
  });

  it("DefinedTerm と NodeShape を場所として拾わない", async () => {
    const termId = "urn:uuid:00000000-0000-4000-8000-000000000099";
    const term = {
      "@id": termId,
      "@type": ["schema:DefinedTerm"],
      "schema:geo": {
        "@type": "schema:GeoCoordinates",
        "schema:latitude": within,
        "schema:longitude": ORIGIN.lng,
      },
      "rdfs:seeAlso": ["https://www.openstreetmap.org/node/1001"],
    };
    const shape = {
      "@id": "urn:uuid:00000000-0000-4000-8000-000000000098",
      "@type": ["sh:NodeShape"],
    };
    const places = {
      ...placesJsonLd,
      "@graph": [...placesJsonLd["@graph"], term, shape],
    };
    const harness = createHarness({ places });

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places.map((place) => place.id)).toEqual([
      ID.cityOffice,
      ID.library,
    ]);
    expect(catalog.places.map((place) => place.id)).not.toContain(termId);
  });

  it("表示名はOSMタグミラーのnameをコメントに使い、目録の古い名前を置き換える", async () => {
    const harness = createHarness();

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places).toEqual([
      { id: ID.cityOffice, name: "千代田区役所", includeInRouteForm: true },
      {
        id: ID.library,
        name: "千代田区立千代田図書館",
        includeInRouteForm: false,
      },
    ]);
  });

  it("新規候補はincludeInRouteForm: falseで追加する", async () => {
    const harness = createHarness({
      existingCatalog: {
        source: { datasetJsonLdUri: PLACES_URI, osmMirrorUri: OSM_MIRROR_URI },
        places: [{ id: ID.cityOffice, name: "千代田区役所", includeInRouteForm: true }],
      },
    });

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places).toContainEqual({
      id: ID.library,
      name: "千代田区立千代田図書館",
      includeInRouteForm: false,
    });
    expect(harness.reported).toContainEqual(expect.stringContaining(ID.library));
    expect(harness.reported).toContainEqual(expect.stringContaining("追加"));
  });

  it("OSM関連付けのない新しいrecordを候補にしない", async () => {
    const harness = createHarness();

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places.map((place) => place.id)).not.toContain(ID.noOsmLink);
  });

  it("OSMタグミラーに要素がないrecordを候補にしない", async () => {
    const harness = createHarness();

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places.map((place) => place.id)).not.toContain(ID.missingElement);
  });

  it("OSM名が空の新しいrecordを候補にしない", async () => {
    const harness = createHarness();

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places.map((place) => place.id)).not.toContain(ID.emptyName);
  });

  it("既存のincludeInRouteFormをIDで引き継ぐ", async () => {
    const harness = createHarness();

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places.find((place) => place.id === ID.cityOffice)?.includeInRouteForm).toBe(true);
    expect(catalog.places.find((place) => place.id === ID.library)?.includeInRouteForm).toBe(false);
  });

  it("既存entryのgroupを引き継がない", async () => {
    const harness = createHarness();

    const catalog = await getUpdater()(harness.options);

    const cityOffice = catalog.places.find((place) => place.id === ID.cityOffice);
    expect(cityOffice).toEqual({
      id: ID.cityOffice,
      name: "千代田区役所",
      includeInRouteForm: true,
    });
    expect(cityOffice).not.toHaveProperty("group");
  });

  it("掲載entryが徒歩圏外になったらIDを報告して目録から除く", async () => {
    const harness = createHarness();

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places.map((place) => place.id)).not.toContain(ID.far);
    expect(harness.reported).toContainEqual(expect.stringContaining(`掲載解除: ${ID.far}`));
  });

  it("掲載entryがOSM不完全になっても、既存の名前と掲載選択を保持する", async () => {
    const harness = createHarness({
      existingCatalog: {
        source: { datasetJsonLdUri: PLACES_URI, osmMirrorUri: OSM_MIRROR_URI },
        places: [{ id: ID.noOsmLink, name: "OSMなし", includeInRouteForm: true }],
      },
    });

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places).toContainEqual({
      id: ID.noOsmLink,
      name: "OSMなし",
      includeInRouteForm: true,
    });
    expect(harness.reported).not.toContainEqual(
      expect.stringContaining(ID.noOsmLink),
    );
  });

  it("公開グラフから消えたentryのIDを報告して目録から除く", async () => {
    const harness = createHarness();

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places.map((place) => place.id)).not.toContain(ID.vanished);
    expect(harness.reported).toContainEqual(expect.stringContaining(`削除: ${ID.vanished}`));
  });

  it("候補が変わらないentryは報告しない", async () => {
    const harness = createHarness();

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places.map((place) => place.id)).toEqual([ID.cityOffice, ID.library]);
    expect(harness.reported.filter((message) => message.includes(ID.cityOffice))).toEqual([]);
  });

  it("取得に失敗したら目録を書かない", async () => {
    const harness = createHarness({ transportFailure: true });

    await expect(getUpdater()(harness.options)).rejects.toThrow(/network unreachable/u);
    expect(harness.writeCatalog).not.toHaveBeenCalled();
  });
});

describe("徒歩距離による候補抽出", () => {
  it("直線距離に√2を掛けると圏外でも、徒歩距離が500m以内なら候補にする", async () => {
    // 直線0.45kmは√2補正で0.636kmになり旧判定では圏外。格子状の徒歩経路は約0.45km。
    const distantStop: StopPosition[] = [
      { id: "stop-far", name: "遠い停留所", lat: northOfOrigin(0.45), lon: ORIGIN.lng },
    ];
    const harness = createHarness({ loadStops: async () => distantStop });

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places.map((place) => place.id)).toContain(ID.cityOffice);
  });

  it("徒歩ネットワークにつながらない停留所しかなければ候補にしない", async () => {
    const disconnected: StopPosition[] = [
      { id: "stop-out", name: "圏外停留所", lat: northOfOrigin(3), lon: ORIGIN.lng },
    ];
    const harness = createHarness({ loadStops: async () => disconnected });

    const catalog = await getUpdater()(harness.options);

    expect(catalog.places).toEqual([]);
  });
});

describe("update-destinations CLI configuration selection", () => {
  const repositoryRoot = process.cwd();
  const cliPath = path.resolve(repositoryRoot, "scripts/update-destinations.ts");
  const tsxCliPath = path.resolve(
    repositoryRoot,
    "node_modules/tsx/dist/cli.mjs",
  );
  const temporaryDirectories: string[] = [];

  function createProjectDirectory(): string {
    const directory = mkdtempSync(path.join(tmpdir(), "update-destinations-"));
    temporaryDirectories.push(directory);
    return directory;
  }

  function runCli(cwd: string, overrides: Record<string, string>) {
    const { APP_CONFIG_ENV: _appConfigEnv, ...baseEnv } = process.env;

    return spawnSync(process.execPath, [tsxCliPath, cliPath], {
      cwd,
      encoding: "utf8",
      env: { ...baseEnv, ...overrides },
      timeout: 30_000,
    });
  }

  afterEach(() => {
    for (const directory of temporaryDirectories) {
      rmSync(directory, { force: true, recursive: true });
    }
    temporaryDirectories.length = 0;
  });

  it("reads app-config.local.json when APP_CONFIG_ENV is absent", () => {
    const cwd = createProjectDirectory();
    writeFileSync(path.join(cwd, "app-config.json"), "{}\n");

    const result = runCli(cwd, {});

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("app-config.local.json");
  });

  it("reads app-config.json when APP_CONFIG_ENV is production", () => {
    const cwd = createProjectDirectory();
    writeFileSync(path.join(cwd, "app-config.json"), "{}\n");

    const result = runCli(cwd, { APP_CONFIG_ENV: "production" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("datasetJsonLdUriとosmMirrorUri");
    expect(result.stderr).not.toContain("ENOENT");
  });

  it("rejects an unknown APP_CONFIG_ENV", () => {
    const cwd = createProjectDirectory();
    writeFileSync(path.join(cwd, "app-config.json"), "{}\n");

    const result = runCli(cwd, { APP_CONFIG_ENV: "staging" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("APP_CONFIG_ENV");
  });
});
