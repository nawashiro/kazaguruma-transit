import {
  buildGeocodeIndex,
  indexDigest,
  readArtifactNames,
  readTownBoundary,
  ISJ_SOURCE,
  OSM_SOURCE,
} from "../lib/geocode-build";

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
        locations: [
          { name: "千代田区役所", lat: 35.6751, lng: 139.7526 },
          { name: "千代田区役所", lat: 35.6751, lng: 139.7526 },
        ],
      },
      {
        category: "図書館",
        categoryId: "1512",
        locations: [{ name: "千代田区役所", lat: 35.6751, lng: 139.7526 }],
      },
    ],
  },
};

describe("readTownBoundary", () => {
  it("Polygonのフィーチャーを境界として読む", () => {
    const boundary = readTownBoundary(TOWN);
    expect(boundary).toHaveLength(1);
    expect(boundary[0]?.name).toBe("東京都千代田区霞が関");
    expect(boundary[0]?.polygons).toHaveLength(1);
  });

  it("FeatureCollection でない入力を拒否する", () => {
    expect(() => readTownBoundary({ type: "Feature" })).toThrow(/町字GeoJSON/);
  });

  it("名前の無いフィーチャーを拒否する", () => {
    expect(() =>
      readTownBoundary({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: {} }],
      }),
    ).toThrow(/名前/);
  });
});

describe("readArtifactNames", () => {
  it("同じ場所の重複をまとめ、カテゴリを集約する", () => {
    const names = readArtifactNames(ARTIFACT);
    expect(names).toHaveLength(1);
    expect(names[0]).toMatchObject({
      name: "千代田区役所",
      categoryIds: ["1302", "1512"],
    });
  });

  it("座標や名前の欠けた場所を飛ばす", () => {
    const names = readArtifactNames({
      sources: {
        locations: [
          {
            category: "x",
            categoryId: "1302",
            locations: [
              { name: "", lat: 1, lng: 2 },
              { name: "ok", lat: Number.NaN, lng: 2 },
              { name: "good", lat: 1, lng: 2 },
            ],
          },
        ],
      },
    });
    expect(names.map((entry) => entry.name)).toEqual(["good"]);
  });

  it("locations の無い入力を拒否する", () => {
    expect(() => readArtifactNames({ sources: {} })).toThrow(/カテゴリ一覧/);
  });
});

describe("buildGeocodeIndex", () => {
  const boundary = readTownBoundary(TOWN);
  const artifactNames = readArtifactNames(ARTIFACT);
  const blocks = [
    { town: "霞が関", chome: 1, block: "1", lat: 35.6751, lng: 139.7526, representative: true },
  ];

  it("出典と生成日時を先頭に持つ索引を作る", () => {
    const { index, counts } = buildGeocodeIndex({
      generatedAt: "2026-11-24T00:00:00.000Z",
      isjVersion: "24.0a",
      blocks,
      boundary,
      artifactNames,
      stops: [{ name: "千代田区役所", lat: 35.6751, lng: 139.7526 }],
      osm: [
        {
          name: "千代田区役所",
          aliases: [],
          lat: 35.6751,
          lng: 139.7526,
          kind: "public",
        },
      ],
    });
    expect(index.generatedAt).toBe("2026-11-24T00:00:00.000Z");
    expect(index.source.isj.license).toBe(ISJ_SOURCE.license);
    expect(index.source.osm.license).toBe(OSM_SOURCE.license);
    expect(index.source.isj.version).toBe("24.0a");
    expect(counts.blocks).toBe(1);
    expect(counts.artifact).toBe(1);
    expect(counts.stops).toBe(1);
    expect(counts.osm).toBe(1);
    expect(counts.names).toBe(1);
  });

  it("版が無ければ既定の版を使う", () => {
    const { index } = buildGeocodeIndex({
      generatedAt: "2026-11-24T00:00:00.000Z",
      isjVersion: null,
      blocks,
      boundary,
      artifactNames,
      stops: [],
      osm: [],
    });
    expect(index.source.isj.version).toBe(ISJ_SOURCE.version);
  });

  it("索引のダイジェストは生成日時に依存しない", () => {
    const first = buildGeocodeIndex({
      generatedAt: "2026-11-24T00:00:00.000Z",
      isjVersion: "24.0a",
      blocks,
      boundary,
      artifactNames,
      stops: [],
      osm: [],
    });
    const second = buildGeocodeIndex({
      generatedAt: "2027-01-01T00:00:00.000Z",
      isjVersion: "24.0a",
      blocks,
      boundary,
      artifactNames,
      stops: [],
      osm: [],
    });
    expect(indexDigest(first.index)).toBe(indexDigest(second.index));
  });

  it("内容が変わればダイジェストも変わる", () => {
    const base = buildGeocodeIndex({
      generatedAt: "2026-11-24T00:00:00.000Z",
      isjVersion: "24.0a",
      blocks,
      boundary,
      artifactNames,
      stops: [],
      osm: [],
    });
    const withStop = buildGeocodeIndex({
      generatedAt: "2026-11-24T00:00:00.000Z",
      isjVersion: "24.0a",
      blocks,
      boundary,
      artifactNames,
      stops: [{ name: "神田駅前", lat: 35.69, lng: 139.77 }],
      osm: [],
    });
    expect(indexDigest(base.index)).not.toBe(indexDigest(withStop.index));
  });
});
