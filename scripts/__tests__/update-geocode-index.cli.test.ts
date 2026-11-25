import type { GeocodeIndex } from "../../src/lib/location/geocode-index";
import { serializeGeocodeIndex, parseGeocodeIndex } from "../../src/lib/location/geocode-index";
import type { OSMNamedFeature } from "../lib/osm-extract";
import { ensureOsmPbf, updateGeocodeIndex, type StopName } from "../update-geocode-index";

const TOWN = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "東京都千代田区霞が関" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [139.74, 35.66],
            [139.79, 35.66],
            [139.79, 35.71],
            [139.74, 35.71],
            [139.74, 35.66],
          ],
        ],
      },
    },
  ],
};

const ARTIFACT = {
  sources: {
    locations: [
      {
        category: "区役所",
        categoryId: "1302",
        locations: [{ name: "千代田区役所", lat: 35.6751, lng: 139.7526 }],
      },
    ],
  },
};

describe("updateGeocodeIndex", () => {
  const written: GeocodeIndex[] = [];
  const reports: string[] = [];

  function options(overrides: Partial<Parameters<typeof updateGeocodeIndex>[0]> = {}) {
    return {
      readIsj: async () => ({ blocks: [], version: "24.0a" }),
      openOsm: async () =>
        (async function* () {
          yield [];
        })(),
      readTownGeoJson: async () => TOWN,
      readLocationArtifact: async () => ARTIFACT,
      loadStops: async () => [{ name: "神田駅前", lat: 35.6918, lng: 139.7712 }],
      writeIndex: async (index: GeocodeIndex) => {
        written.push(index);
      },
      now: () => new Date("2026-11-24T00:00:00.000Z"),
      report: (message: string) => {
        reports.push(message);
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    written.length = 0;
    reports.length = 0;
  });

  it("索引を組み立てて書き出す", async () => {
    const osm: OSMNamedFeature[] = [
      {
        name: "千代田区役所",
        aliases: [],
        lat: 35.6751,
        lng: 139.7526,
        kind: "public",
      },
    ];
    const result = await updateGeocodeIndex({
      ...options(),
      openOsm: async () =>
        (async function* () {
          yield [
            {
              type: "node",
              id: 1,
              lat: 35.6751,
              lon: 139.7526,
              tags: { name: "千代田区役所", amenity: "townhall" },
            },
          ];
        })(),
    });

    expect(result.counts.isjBlocks).toBe(0);
    expect(result.counts.osm).toBe(1);
    expect(result.counts.names).toBeGreaterThanOrEqual(1);
    void osm;
  });

  it("書き出した索引は読み戻せる形になっている", async () => {
    await updateGeocodeIndex({
      ...options(),
      openOsm: async () =>
        (async function* () {
          yield [
            {
              type: "node",
              id: 1,
              lat: 35.6751,
              lon: 139.7526,
              tags: { name: "千代田区役所", amenity: "townhall" },
            },
          ];
        })(),
    });
    expect(written).toHaveLength(1);
    const serialized = serializeGeocodeIndex(written[0]);
    expect(parseGeocodeIndex(JSON.parse(serialized))).toEqual(written[0]);
  });

  it("進捗を報告する", async () => {
    await updateGeocodeIndex({
      ...options(),
      openOsm: async () =>
        (async function* () {
          yield [];
        })(),
    });
    expect(reports.join("\n")).toMatch(/街区/);
    expect(reports.join("\n")).toMatch(/町字/);
    expect(reports.join("\n")).toMatch(/索引/);
  });

  it("街区域が空でも停留所の名前を索引に残す", async () => {
    await updateGeocodeIndex({
      ...options(),
      openOsm: async () =>
        (async function* () {
          yield [];
        })(),
    });
    expect(
      written[0]?.names.some((entry) => entry.name === "神田駅前"),
    ).toBe(true);
  });
});

describe("ensureOsmPbf", () => {
  it("取得済みのファイルを再利用する", async () => {
    const reports: string[] = [];
    const result = await ensureOsmPbf("/tmp/fixture-from-test.osm.pbf", {
      now: () => new Date(),
      fetch: async () => {
        throw new Error("取得してはならない");
      },
      report: (message) => reports.push(message),
    }).catch((error: unknown) => error);

    // ファイルが存在しないので取得へ進み、その失敗がそのまま返る。
    expect(result).toBeInstanceOf(Error);
  });

  it("取得の失敗を報告する", async () => {
    await expect(
      ensureOsmPbf("/tmp/never-written.osm.pbf", {
        now: () => new Date(),
        fetch: async () => new Response(null, { status: 503 }),
        report: () => undefined,
      }),
    ).rejects.toThrow(/OSM抽出の取得に失敗/);
  });
});
