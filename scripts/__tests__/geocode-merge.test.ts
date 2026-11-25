import type { GeocodeBlock } from "../../src/lib/location/geocode-index";
import {
  kindFromCategoryIds,
  mergeNames,
  NameAccumulator,
} from "../lib/geocode-merge";

const BLOCKS: GeocodeBlock[] = [
  { town: "霞が関", chome: 1, block: "1", lat: 35.6751, lng: 139.7526, representative: true },
  { town: "霞が関", chome: 1, block: "2", lat: 35.6753, lng: 139.7529, representative: true },
  { town: "神田和泉町", chome: 0, block: "1", lat: 35.6992, lng: 139.776, representative: true },
];

describe("kindFromCategoryIds", () => {
  it("カテゴリコードから種別を決める", () => {
    expect(kindFromCategoryIds(["1302"])).toBe("public");
    expect(kindFromCategoryIds(["1512"])).toBe("culture");
    expect(kindFromCategoryIds(["1601"])).toBe("medical");
    expect(kindFromCategoryIds(["1003"])).toBe("park");
    expect(kindFromCategoryIds(["2603"])).toBe("shop");
  });

  it("複数カテゴリでは優先度の高い種別を採る", () => {
    expect(kindFromCategoryIds(["2603", "1601"])).toBe("medical");
    expect(kindFromCategoryIds(["2603", "1003"])).toBe("park");
  });

  it("未知のコードだけなら other にする", () => {
    expect(kindFromCategoryIds([])).toBe("other");
    expect(kindFromCategoryIds(["9999"])).toBe("other");
  });
});

describe("NameAccumulator", () => {
  it("名前と街区が同じ地点を1件にまとめる", () => {
    const accumulator = new NameAccumulator(BLOCKS);
    accumulator.add("千代田区役所", 35.6751, 139.7526, "public");
    accumulator.add("千代田区役所", 35.67511, 139.75261, "public");
    expect(accumulator.toNames()).toHaveLength(1);
  });

  it("街区が異なれば別の地点として残す", () => {
    const accumulator = new NameAccumulator(BLOCKS);
    accumulator.add("ファミリーマート", 35.6751, 139.7526, "food");
    accumulator.add("ファミリーマート", 35.6992, 139.776, "food");
    expect(accumulator.toNames()).toHaveLength(2);
  });

  it("種別は優先度の高いものを残す", () => {
    const accumulator = new NameAccumulator(BLOCKS);
    accumulator.add("神田", 35.6751, 139.7526, "other");
    accumulator.add("神田", 35.6751, 139.7526, "station");
    expect(accumulator.toNames()[0]?.kind).toBe("station");
  });

  it("別名を合わせ、名前自身は別名から除く", () => {
    const accumulator = new NameAccumulator(BLOCKS);
    accumulator.add("東京復活大聖堂", 35.6751, 139.7526, "culture", [
      "ニコライ堂",
      "東京復活大聖堂",
    ]);
    expect(accumulator.toNames()[0]?.aliases).toEqual(["ニコライ堂"]);
  });

  it("座標を平均し、丸めた値を返す", () => {
    const single: GeocodeBlock[] = [
      { town: "霞が関", chome: 1, block: "1", lat: 35.6751, lng: 139.7526, representative: true },
    ];
    const accumulator = new NameAccumulator(single);
    accumulator.add("地点", 35.6750, 139.7525, "other");
    accumulator.add("地点", 35.6752, 139.7527, "other");
    expect(accumulator.toNames()[0]).toMatchObject({
      lat: 35.6751,
      lng: 139.7526,
    });
  });

  it("空の名前を無視する", () => {
    const accumulator = new NameAccumulator(BLOCKS);
    accumulator.add("   ", 35.6751, 139.7526, "other");
    expect(accumulator.toNames()).toEqual([]);
  });

  it("同じ入力からは同じ並びを返す", () => {
    const first = new NameAccumulator(BLOCKS);
    first.add("あ", 35.6751, 139.7526, "other");
    first.add("い", 35.6992, 139.776, "other");
    const second = new NameAccumulator(BLOCKS);
    second.add("い", 35.6992, 139.776, "other");
    second.add("あ", 35.6751, 139.7526, "other");
    expect(first.toNames()).toEqual(second.toNames());
  });
});

describe("mergeNames", () => {
  it("3つの出典を統合し、重複をまとめる", () => {
    const result = mergeNames({
      blocks: BLOCKS,
      artifactNames: [
        { name: "千代田区役所", lat: 35.6751, lng: 139.7526, categoryIds: ["1302"] },
      ],
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
    expect(result.counts.artifact).toBe(1);
    expect(result.counts.stops).toBe(1);
    expect(result.counts.osm).toBe(1);
    expect(result.counts.merged).toBe(1);
    expect(result.names[0]?.kind).toBe("public");
  });

  it("停留所だけの名前も索引に残す", () => {
    const result = mergeNames({
      blocks: BLOCKS,
      artifactNames: [],
      stops: [{ name: "神田駅前", lat: 35.6918, lng: 139.7712 }],
      osm: [],
    });
    expect(result.names.map((entry) => entry.name)).toEqual(["神田駅前"]);
  });

  it("OSMの別名を索引へ引き継ぐ", () => {
    const result = mergeNames({
      blocks: BLOCKS,
      artifactNames: [],
      stops: [],
      osm: [
        {
          name: "東京復活大聖堂",
          aliases: ["ニコライ堂"],
          lat: 35.6751,
          lng: 139.7526,
          kind: "culture",
        },
      ],
    });
    expect(result.names[0]?.aliases).toEqual(["ニコライ堂"]);
  });
});
