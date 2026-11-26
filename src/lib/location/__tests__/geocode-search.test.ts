import {
  GEOCODE_INDEX_VERSION,
  loadGeocodeIndex,
  parseGeocodeIndex,
  serializeGeocodeIndex,
  type GeocodeIndex,
} from "../geocode-index";
import { GeocodeSearcher } from "../geocode-search";

const HIGASHI = "霞が関";
const KANDA_IZUMICHO = "神田和泉町";
const HAYABUSACHO = "隼町";
const ICHIBANCHO = "一番町";
const KONNYACHO = "神田紺屋町";
const KOJIMACHI = "麹町";

function buildIndex(overrides: Partial<GeocodeIndex> = {}): GeocodeIndex {
  return {
    version: GEOCODE_INDEX_VERSION,
    generatedAt: "2026-11-24T00:00:00.000Z",
    source: {
      isj: {
        name: "位置参照情報",
        url: "https://nlftp.mlit.go.jp/isj/",
        license: "PDL-1.0",
        licenseUrl: "https://www.digital.go.jp/resources/open_data/public_data_license_v1.0",
        version: "24.0a",
      },
      osm: {
        name: "OpenStreetMap",
        url: "https://www.openstreetmap.org/copyright",
        license: "ODbL-1.0",
        licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
        extractUri: "https://osm.download.movisda.io/admin/JP-13-latest.osm.pbf",
      },
    },
    boundary: [
      {
        name: "東京都千代田区霞が関",
        polygons: [
          [
            [
              [139.74, 35.66],
              [139.79, 35.66],
              [139.79, 35.71],
              [139.74, 35.71],
              [139.74, 35.66],
            ],
          ],
        ],
      },
    ],
    blocks: [
      { town: HIGASHI, chome: 1, block: "1", lat: 35.6751, lng: 139.7526, representative: true },
      { town: HIGASHI, chome: 1, block: "2", lat: 35.6753, lng: 139.7529, representative: true },
      { town: HIGASHI, chome: 2, block: "1", lat: 35.6761, lng: 139.7511, representative: true },
      { town: KANDA_IZUMICHO, chome: 0, block: "1", lat: 35.6992, lng: 139.776, representative: true },
      { town: KANDA_IZUMICHO, chome: 0, block: "2", lat: 35.6994, lng: 139.7763, representative: true },
      { town: HAYABUSACHO, chome: 0, block: "1", lat: 35.6826, lng: 139.7424, representative: true },
      { town: HAYABUSACHO, chome: 0, block: "4", lat: 35.6829, lng: 139.7428, representative: true },
      { town: ICHIBANCHO, chome: 0, block: "1", lat: 35.6871, lng: 139.7418, representative: true },
      { town: ICHIBANCHO, chome: 0, block: "25", lat: 35.6881, lng: 139.7431, representative: true },
      { town: KONNYACHO, chome: 0, block: "5", lat: 35.6916, lng: 139.7736, representative: true },
      { town: KONNYACHO, chome: 0, block: "30", lat: 35.6927, lng: 139.7734, representative: true },
      { town: KOJIMACHI, chome: 1, block: "1", lat: 35.6905, lng: 139.7385, representative: true },
      { town: KOJIMACHI, chome: 2, block: "1", lat: 35.6899, lng: 139.7379, representative: true },
    ],
    names: [
      {
        name: "千代田区役所",
        aliases: [],
        lat: 35.6941,
        lng: 139.7535,
        kind: "public",
      },
      {
        name: "ファミリーマート",
        aliases: [],
        lat: 35.6,
        lng: 139.7,
        kind: "food",
      },
      {
        name: "ファミリーマート",
        aliases: [],
        lat: 35.61,
        lng: 139.71,
        kind: "food",
      },
      {
        name: "東京復活大聖堂",
        aliases: ["ニコライ堂"],
        lat: 35.6988,
        lng: 139.7612,
        kind: "culture",
      },
      {
        name: "千代田区立障害者福祉センター えみふる",
        aliases: [],
        lat: 35.6995,
        lng: 139.7602,
        kind: "welfare",
      },
      {
        name: "神田",
        aliases: [],
        lat: 35.6917,
        lng: 139.7709,
        kind: "station",
      },
      {
        name: "神田駅前",
        aliases: [],
        lat: 35.6918,
        lng: 139.7712,
        kind: "other",
      },
      {
        name: "四ツ谷",
        aliases: [],
        lat: 35.6822,
        lng: 139.7304,
        kind: "station",
      },
      {
        name: "千代田区立千代田図書館",
        aliases: [],
        lat: 35.6939,
        lng: 139.7534,
        kind: "culture",
      },
      {
        name: "隼町",
        aliases: [],
        lat: 35.6827,
        lng: 139.7426,
        kind: "other",
      },
      {
        name: "麹町",
        aliases: [],
        lat: 35.6902,
        lng: 139.7382,
        kind: "station",
      },
      {
        name: "千代田区役所別館前",
        aliases: [],
        lat: 35.6943,
        lng: 139.7537,
        kind: "other",
      },
      {
        name: "役所別館",
        aliases: [],
        lat: 35.6945,
        lng: 139.7539,
        kind: "other",
      },
    ],
    ...overrides,
  };
}

describe("parseGeocodeIndex", () => {
  it("生成した索引をそのまま読み戻せる", () => {
    const index = buildIndex();
    expect(parseGeocodeIndex(JSON.parse(serializeGeocodeIndex(index)))).toEqual(
      index,
    );
  });

  it("配列の要素を1行ずつ書き出す", () => {
    const index = buildIndex();
    const lines = serializeGeocodeIndex(index).split("\n");
    const total =
      index.boundary.length + index.blocks.length + index.names.length;

    const entryLines = lines.filter((line) => /^    \{"/u.test(line));
    expect(entryLines).toHaveLength(total);

    for (const entry of index.names) {
      expect(entryLines.map((line) => line.replace(/,$/u, ""))).toContain(
        `    ${JSON.stringify(entry)}`,
      );
    }
  });

  it("要素が変わっても、ほかの要素の行は変わらない", () => {
    const index = buildIndex();
    const changed = {
      ...index,
      names: index.names.map((entry, position) =>
        position === 0 ? { ...entry, lat: entry.lat + 0.0001 } : entry,
      ),
    };
    const before = serializeGeocodeIndex(index).split("\n");
    const after = serializeGeocodeIndex(changed).split("\n");
    const changedLines = after.filter(
      (line, position) => line !== before[position],
    );
    expect(changedLines).toEqual([
      `    ${JSON.stringify(changed.names[0])},`,
    ]);
  });

  it("版が異なる索引を拒否する", () => {
    const index = buildIndex();
    expect(() =>
      parseGeocodeIndex({ ...index, version: GEOCODE_INDEX_VERSION + 1 }),
    ).toThrow(/version/);
  });

  it("種別が未知の名前を拒否する", () => {
    const index = buildIndex();
    expect(() =>
      parseGeocodeIndex({
        ...index,
        names: [{ name: "x", aliases: [], lat: 0, lng: 0, kind: "unknown" }],
      }),
    ).toThrow(/kind/);
  });

  it("必須項目が欠けた街区を拒否する", () => {
    const index = buildIndex();
    expect(() =>
      parseGeocodeIndex({
        ...index,
        blocks: [{ town: HIGASHI, chome: 1, lat: 1, lng: 2 }],
      }),
    ).toThrow(/blocks/);
  });
});

describe("loadGeocodeIndex", () => {
  it("読み込めない索引は失敗結果を返す", () => {
    const result = loadGeocodeIndex("/missing.json", () => {
      throw new Error("ENOENT");
    });
    expect(result.status).toBe("error");
  });

  it("JSONとして壊れた索引は失敗結果を返す", () => {
    const result = loadGeocodeIndex("/broken.json", () => "{not json");
    expect(result.status).toBe("error");
  });

  it("正しい索引は成功結果を返す", () => {
    const text = serializeGeocodeIndex(buildIndex());
    const result = loadGeocodeIndex("/index.json", () => text);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.index.names).toHaveLength(buildIndex().names.length);
    }
  });
});

describe("GeocodeSearcher", () => {
  const searcher = new GeocodeSearcher(buildIndex());

  it("丁目を持つ町名の番地を街区代表点で解決する", () => {
    expect(searcher.findAddress("霞が関1-1")).toMatchObject({
      address: "千代田区霞が関一丁目1番",
      lat: 35.6751,
      lng: 139.7526,
    });
  });

  it("漢数字と全角数字の番地を同じ結果にする", () => {
    expect(searcher.findAddress("霞が関一丁目1番")).toEqual(
      searcher.findAddress("霞が関１−１"),
    );
  });

  it("丁目を持たない町名の番地を一丁目として解釈しない", () => {
    expect(searcher.findAddress("神田和泉町1")).toMatchObject({
      address: "千代田区神田和泉町1番",
      lat: 35.6992,
    });
  });

  it("区名を伴う住所を解決する", () => {
    expect(searcher.findAddress("千代田区神田和泉町1番地")).toMatchObject({
      address: "千代田区神田和泉町1番",
    });
  });

  it("存在しない街区には町名の代表点を返す", () => {
    const result = searcher.findAddress("霞が関1-99");
    expect(result?.address).toBe("千代田区霞が関一丁目1番");
  });

  it("索引に無い町名の番地は名前検索へ委ねる", () => {
    expect(searcher.findAddress("千代田区丸の内1-1")).toBeNull();
  });

  it("街区のあとの号を街区として読まない", () => {
    expect(searcher.findAddress("隼町4-1")).toMatchObject({
      address: "千代田区隼町4番",
      lat: 35.6829,
    });
    expect(searcher.findAddress("一番町25-1")).toMatchObject({
      address: "千代田区一番町25番",
      lat: 35.6881,
    });
    expect(searcher.findAddress("神田紺屋町30-2")).toMatchObject({
      address: "千代田区神田紺屋町30番",
      lat: 35.6927,
    });
  });

  it("丁目と街区と号を伴う住所を解決する", () => {
    expect(searcher.findAddress("霞が関1-1-1")).toMatchObject({
      address: "千代田区霞が関一丁目1番",
      lat: 35.6751,
    });
  });

  it("番地として解決できた検索は1件だけ返す", () => {
    expect(searcher.search("霞が関1-1")).toHaveLength(1);
  });

  it("別名でも同じ地点を引ける", () => {
    const byOfficial = searcher.search("東京復活大聖堂");
    const byAlias = searcher.search("ニコライ堂");
    expect(byAlias).toEqual(byOfficial);
    expect(byAlias[0]?.lat).toBe(35.6988);
  });

  it("末尾の駅を除いて再照合する", () => {
    const result = searcher.search("四ツ谷駅");
    expect(result[0]?.name).toBe("四ツ谷");
  });

  it("駅を停留所や店舗より上位に並べる", () => {
    const result = searcher.search("神田");
    expect(result[0]?.kind).toBe("station");
  });

  it("チェーン店を公共施設より下位に並べる", () => {
    const result = searcher.search("千代田");
    const kinds = result.map((candidate) => candidate.kind);
    expect(kinds.indexOf("culture")).toBeLessThan(
      kinds.indexOf("food") === -1 ? Infinity : kinds.indexOf("food"),
    );
    expect(result[0]?.kind).not.toBe("food");
  });

  it("完全一致を部分一致より先に並べる", () => {
    const result = searcher.search("千代田区役所");
    expect(result[0]?.name).toBe("千代田区役所");
  });

  it("候補を最大5件に切る", () => {
    const many = buildIndex({
      names: Array.from({ length: 12 }, (_, index) => ({
        name: `テスト施設${index}`,
        aliases: [],
        lat: 35.69 + index / 10000,
        lng: 139.75,
        kind: "shop" as const,
      })),
    });
    expect(new GeocodeSearcher(many).search("テスト施設")).toHaveLength(5);
  });

  it("同じ入力に対して同じ順序を返す", () => {
    const first = searcher.search("千代田");
    const second = new GeocodeSearcher(buildIndex()).search("千代田");
    expect(first).toEqual(second);
  });

  it("街区を町・丁目・街区のキーで引く", () => {
    expect(searcher.search("霞が関一丁目1番").map((candidate) => candidate.name)).toEqual([
      "千代田区霞が関一丁目1番",
    ]);
    expect(searcher.search("神田和泉町2番").map((candidate) => candidate.name)).toEqual([
      "千代田区神田和泉町2番",
    ]);
  });

  it("町名を打ち終えたら街区を候補にする", () => {
    expect(searcher.search("千代田区神田和泉町").map((candidate) => candidate.name)).toEqual([
      "千代田区神田和泉町1番",
      "千代田区神田和泉町2番",
    ]);
  });

  it("町名の途中でも候補を返す", () => {
    expect(searcher.search("千代田区神田和").map((candidate) => candidate.name)).toEqual([
      "千代田区神田和泉町1番",
      "千代田区神田和泉町2番",
    ]);
  });

  it("丁目を持つ町名では丁目を候補にする", () => {
    expect(searcher.search("千代田区霞が関").map((candidate) => candidate.name)).toEqual([
      "千代田区霞が関一丁目1番",
      "千代田区霞が関二丁目1番",
    ]);
  });

  it("丁目まで打ったらその丁目の街区を候補にする", () => {
    expect(searcher.search("千代田区霞が関1").map((candidate) => candidate.name)).toEqual([
      "千代田区霞が関一丁目1番",
      "千代田区霞が関一丁目2番",
    ]);
  });

  it("複数の町に割れる語では住所候補を出さない", () => {
    const result = searcher.search("神田");
    expect(result.map((candidate) => candidate.kind)).not.toContain("address");
    expect(searcher.search("千代田区").map((candidate) => candidate.kind)).not.toContain("address");
  });

  it("候補の住所は街区符号を持つ", () => {
    for (const query of ["千代田区霞が関", "千代田区神田和泉町", "隼町", "千代田区霞が関1"]) {
      for (const candidate of searcher.search(query)) {
        if (candidate.kind !== "address") {
          continue;
        }
        expect(candidate.address).toMatch(/^千代田区.+[0-9]+番$/u);
        expect(candidate.name).toBe(candidate.address);
      }
    }
  });

  it("区名を付けた名前でも索引の地点に当たる", () => {
    expect(searcher.search("千代田区役所")[0]?.name).toBe("千代田区役所");
    expect(searcher.search("東京都千代田区役所")[0]?.name).toBe("千代田区役所");
  });

  it("区名を落とした語の一致は元の語の一致より後ろに並ぶ", () => {
    const result = searcher.search("千代田区役所");
    const original = result.findIndex((candidate) => candidate.name === "千代田区役所");
    const stripped = result.findIndex((candidate) => candidate.name === "役所別館");
    expect(original).toBe(0);
    expect(stripped).toBeGreaterThan(original);
  });

  it("区名を落としても2文字に満たない語では照合しない", () => {
    const result = searcher.search("千代田区役");
    expect(result.map((candidate) => candidate.name)).not.toContain("役所別館");
  });

  it("番地を確定した検索はその街区だけを返す", () => {
    expect(searcher.search("隼町4-1").map((candidate) => candidate.name)).toEqual([
      "千代田区隼町4番",
    ]);
  });

  it("住所と同名の名前がある町では住所を先に並べる", () => {
    expect(searcher.search("隼町").map((candidate) => candidate.name)).toEqual([
      "千代田区隼町1番",
      "千代田区隼町4番",
      "隼町",
    ]);
  });

  it("同じ町名の駅があるときは完全一致の駅を先頭に置く", () => {
    const result = searcher.search("麹町");
    expect(result[0]).toMatchObject({ name: "麹町", kind: "station" });
    expect(result[1]?.kind).toBe("address");
  });

  it("空の検索語には候補を返さない", () => {
    expect(searcher.search("   ")).toEqual([]);
  });

  it("候補には解決できる住所を添える", () => {
    const result = searcher.search("千代田区役所");
    expect(result[0]?.address).toMatch(/^千代田区/);
  });

  it("範囲内の座標を逆引きする", () => {
    expect(searcher.reverse(35.6751, 139.7526)).toMatch(/^千代田区霞が関一丁目1番$/);
  });

  it("町字ポリゴンの外の座標には住所を返さない", () => {
    expect(searcher.reverse(35.5, 139.5)).toBeNull();
  });

  it("数値でない座標には null を返す", () => {
    expect(searcher.reverse(Number.NaN, 139.75)).toBeNull();
  });
});
