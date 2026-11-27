jest.unmock("fs");

import { deflateSync } from "node:zlib";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";

import {
  classifyKind,
  extractOsmFeatures,
  isInsideBoundary,
  isLinearFeature,
  readAliases,
  townNameForPoint,
} from "../lib/osm-extract";
import { readOsmItems } from "../lib/osm-pbf";

interface ProtoParsers {
  osm: {
    HeaderBlock: { encode: (value: unknown) => Buffer };
    PrimitiveBlock: { encode: (value: unknown) => Buffer };
  };
  file: {
    Blob: { encode: (value: unknown) => Buffer };
    BlobHeader: { encode: (value: unknown) => Buffer };
  };
}

const parsers = createRequire(import.meta.url)(
  "osm-pbf-parser/lib/parsers.js",
) as ProtoParsers;

function blob(type: string, data: Buffer): Buffer {
  const message = parsers.file.Blob.encode({ zlib_data: deflateSync(data) });
  const header = parsers.file.BlobHeader.encode({
    type,
    datasize: message.length,
  });
  const size = Buffer.alloc(4);
  size.writeUInt32BE(header.length, 0);
  return Buffer.concat([size, header, message]);
}

interface FixtureNode {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

interface FixtureWay {
  id: number;
  refs: number[];
  tags: Record<string, string>;
}

interface Fixture {
  nodes: FixtureNode[];
  ways: FixtureWay[];
}

const STRING_TABLE_KEYS = ["name", "highway", "railway", "official_name"];

function buildPbf(fixture: Fixture): Buffer {
  const table = ["", ...STRING_TABLE_KEYS];
  const keyIndex = (key: string) => {
    const existing = table.indexOf(key);
    if (existing !== -1) {
      return existing;
    }
    table.push(key);
    return table.length - 1;
  };
  const valueIndex = (value: string) => {
    const existing = table.indexOf(value);
    if (existing !== -1) {
      return existing;
    }
    table.push(value);
    return table.length - 1;
  };

  const ids: number[] = [];
  const lats: number[] = [];
  const lons: number[] = [];
  const keysVals: number[] = [];
  let previousId = 0;
  let previousLat = 0;
  let previousLon = 0;

  for (const node of fixture.nodes) {
    const lat = Math.round(node.lat * 1e7);
    const lon = Math.round(node.lon * 1e7);
    ids.push(node.id - previousId);
    lats.push(lat - previousLat);
    lons.push(lon - previousLon);
    previousId = node.id;
    previousLat = lat;
    previousLon = lon;
    for (const [key, value] of Object.entries(node.tags)) {
      keysVals.push(keyIndex(key), valueIndex(value));
    }
    keysVals.push(0);
  }

  const ways = fixture.ways.map((way) => {
    const keys: number[] = [];
    const vals: number[] = [];
    for (const [key, value] of Object.entries(way.tags)) {
      keys.push(keyIndex(key));
      vals.push(valueIndex(value));
    }
    const refs: number[] = [];
    let previousRef = 0;
    for (const ref of way.refs) {
      refs.push(ref - previousRef);
      previousRef = ref;
    }
    return { id: way.id, keys, vals, refs };
  });

  const block = parsers.osm.PrimitiveBlock.encode({
    stringtable: { s: table },
    primitivegroup: [{ dense: { id: ids, lat: lats, lon: lons, keys_vals: keysVals }, ways }],
    granularity: 100,
    lat_offset: 0,
    lon_offset: 0,
    date_granularity: 1000,
  });
  const header = parsers.osm.HeaderBlock.encode({
    required_features: ["OsmSchema-V0.6", "DenseNodes"],
    optional_features: [],
  });
  return Buffer.concat([blob("OSMHeader", header), blob("OSMData", block)]);
}

const SQUARE = [
  { name: "東京都千代田区霞が関", polygons: [[[[139.74, 35.66], [139.79, 35.66], [139.79, 35.71], [139.74, 35.71], [139.74, 35.66]]]] },
];

const FIXTURE: Fixture = {
  nodes: [
    { id: 1, lat: 35.6941, lon: 139.7535, tags: { name: "千代田区役所" } },
    { id: 2, lat: 35.6917, lon: 139.7709, tags: { railway: "station", name: "神田" } },
    { id: 3, lat: 35.6988, lon: 139.7612, tags: { name: "東京復活大聖堂", official_name: "ニコライ堂" } },
    { id: 4, lat: 35.5, lon: 139.5, tags: { name: "区外の施設" } },
    { id: 5, lat: 35.695, lon: 139.756, tags: {} },
  ],
  ways: [
    { id: 10, refs: [1, 2], tags: { highway: "residential", name: "外堀通り" } },
    { id: 11, refs: [1, 2], tags: { name: "区役所と神田の中間" } },
    { id: 12, refs: [3, 3], tags: { railway: "rail", name: "中央本線" } },
    { id: 13, refs: [4, 4], tags: { name: "区外の道路" } },
  ],
};

async function extractFrom(fixture: Fixture, boundary = SQUARE) {
  const pbf = buildPbf(fixture);
  const source = new PassThrough();
  source.end(pbf);
  return extractOsmFeatures(await readOsmItems(source), boundary);
}

describe("isLinearFeature", () => {
  it("道路・鉄道線・水路・境界を線形として扱う", () => {
    expect(isLinearFeature({ highway: "residential", name: "x" })).toBe(true);
    expect(isLinearFeature({ route: "bus", name: "x" })).toBe(true);
    expect(isLinearFeature({ waterway: "river", name: "x" })).toBe(true);
    expect(isLinearFeature({ boundary: "administrative", name: "x" })).toBe(true);
    expect(isLinearFeature({ railway: "rail", name: "x" })).toBe(true);
  });

  it("駅は線形として扱わない", () => {
    expect(isLinearFeature({ railway: "station", name: "神田" })).toBe(false);
    expect(isLinearFeature({ railway: "halt", name: "x" })).toBe(false);
    expect(isLinearFeature({ public_transport: "station", name: "x" })).toBe(false);
  });

  it("建物・公園・店舗は線形として扱わない", () => {
    expect(isLinearFeature({ building: "yes", name: "x" })).toBe(false);
    expect(isLinearFeature({ leisure: "park", name: "x" })).toBe(false);
    expect(isLinearFeature({ shop: "convenience", name: "x" })).toBe(false);
  });
});

describe("classifyKind", () => {
  it("駅を station にする", () => {
    expect(classifyKind({ railway: "station" })).toBe("station");
  });

  it("公園を park にする", () => {
    expect(classifyKind({ leisure: "park" })).toBe("park");
  });

  it("公共施設・文化施設・医療機関を区別する", () => {
    expect(classifyKind({ amenity: "townhall" })).toBe("public");
    expect(classifyKind({ amenity: "library" })).toBe("culture");
    expect(classifyKind({ amenity: "hospital" })).toBe("medical");
    expect(classifyKind({ tourism: "museum" })).toBe("culture");
  });

  it("物販・飲食・駐車場を区別する", () => {
    expect(classifyKind({ shop: "convenience" })).toBe("shop");
    expect(classifyKind({ amenity: "cafe" })).toBe("food");
    expect(classifyKind({ amenity: "parking" })).toBe("parking");
  });

  it("未知の種別を other にする", () => {
    expect(classifyKind({ man_made: "tower" })).toBe("other");
  });
});

describe("readAliases", () => {
  it("公式名称と別名を取り込み、名前自身は除く", () => {
    expect(
      readAliases({
        name: "東京復活大聖堂",
        official_name: "ニコライ堂",
        alt_name: "ニコライ聖堂;東京復活大聖堂",
        "name:ja": "東京復活大聖堂",
      }),
    ).toEqual(["ニコライ堂", "ニコライ聖堂"]);
  });

  it("別名が無ければ空配列を返す", () => {
    expect(readAliases({ name: "千代田区役所" })).toEqual([]);
  });
});

describe("isInsideBoundary / townNameForPoint", () => {
  it("ポリゴンの内外を判定する", () => {
    expect(isInsideBoundary(35.69, 139.75, SQUARE)).toBe(true);
    expect(isInsideBoundary(35.5, 139.5, SQUARE)).toBe(false);
  });

  it("点を含む町字の名前を返す", () => {
    expect(townNameForPoint(35.69, 139.75, SQUARE)).toBe("東京都千代田区霞が関");
    expect(townNameForPoint(35.5, 139.5, SQUARE)).toBeNull();
  });
});

describe("extractOsmFeatures", () => {
  it("町字内の名前付き要素だけを集める", async () => {
    const { features } = await extractFrom(FIXTURE);
    const names = features.map((feature) => feature.name);
    expect(names).toContain("千代田区役所");
    expect(names).toContain("神田");
    expect(names).toContain("東京復活大聖堂");
    expect(names).not.toContain("区外の施設");
    expect(names).not.toContain("区外の道路");
  });

  it("線形要素を除外し、駅は残す", async () => {
    const { features, stats } = await extractFrom(FIXTURE);
    const names = features.map((feature) => feature.name);
    expect(names).not.toContain("外堀通り");
    expect(names).not.toContain("中央本線");
    expect(names).toContain("神田");
    expect(stats.skippedLinear).toBeGreaterThanOrEqual(2);
  });

  it("wayの重心で代表させ、名前を引き継ぐ", async () => {
    const { features } = await extractFrom(FIXTURE);
    const way = features.find(
      (feature) => feature.name === "区役所と神田の中間",
    );
    expect(way).toBeDefined();
    expect(way?.lat).toBeCloseTo((35.6941 + 35.6917) / 2, 6);
  });

  it("別名を索引の照合対象として持たせる", async () => {
    const { features } = await extractFrom(FIXTURE);
    const nikolai = features.find((feature) => feature.name === "東京復活大聖堂");
    expect(nikolai?.aliases).toEqual(["ニコライ堂"]);
  });

  it("種別をタグから決める", async () => {
    const { features } = await extractFrom(FIXTURE);
    expect(features.find((feature) => feature.name === "神田")?.kind).toBe(
      "station",
    );
    expect(
      features.find((feature) => feature.name === "千代田区役所")?.kind,
    ).toBe("other");
  });

  it("同じ入力に対して同じ順序を返す", async () => {
    const first = await extractFrom(FIXTURE);
    const second = await extractFrom(FIXTURE);
    expect(first.features).toEqual(second.features);
  });

  it("町字ポリゴンが空なら失敗する", async () => {
    await expect(extractFrom(FIXTURE, [])).rejects.toThrow(/範囲/);
  });

  it("読み込みの失敗をそのまま伝える", async () => {
    const broken = new PassThrough();
    const stream = await readOsmItems(broken);
    const promise = extractOsmFeatures(stream, SQUARE);
    broken.destroy(new Error("読み込みに失敗しました"));
    await expect(promise).rejects.toThrow(/読み込みに失敗しました/);
  });
});
