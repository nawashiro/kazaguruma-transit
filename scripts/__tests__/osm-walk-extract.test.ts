import {
  extractWalkNetwork,
  isWalkableHighway,
  WALK_STOP_MARGIN_KM,
} from "../lib/osm-walk-extract";
import type { TownBoundary } from "../lib/osm-extract";

const TOWN: TownBoundary[] = [
  {
    name: "東京都千代田区試験町",
    polygons: [
      [
        [
          [139.75, 35.69],
          [139.76, 35.69],
          [139.76, 35.7],
          [139.75, 35.7],
          [139.75, 35.69],
        ],
      ],
    ],
  },
];

const INSIDE = { lat: 35.695, lng: 139.755 };
const kmPerLatDegree = 111.195;
const kmPerLngDegree = 111.195 * Math.cos((35.695 * Math.PI) / 180);

function nodeAt(start: { lat: number; lng: number }, id: number, northKm: number, eastKm = 0) {
  return {
    id,
    lat: start.lat + northKm / kmPerLatDegree,
    lng: start.lng + eastKm / kmPerLngDegree,
  };
}

function node(item: { id: number; lat: number; lng: number }) {
  return { type: "node", id: item.id, lat: item.lat, lon: item.lng };
}

function way(id: number, refs: number[], tags: Record<string, string>) {
  return { type: "way", id, refs, tags };
}

function stream(items: unknown[]) {
  return (async function* () {
    yield items;
  })();
}

describe("isWalkableHighway", () => {
  it("歩行できるhighwayを受け付ける", () => {
    expect(isWalkableHighway({ highway: "footway" })).toBe(true);
    expect(isWalkableHighway({ highway: "residential" })).toBe(true);
    expect(isWalkableHighway({ highway: "steps" })).toBe(true);
  });

  it("歩行できないhighwayと通行禁止を拒否する", () => {
    expect(isWalkableHighway({ highway: "motorway" })).toBe(false);
    expect(isWalkableHighway({ highway: "footway", foot: "no" })).toBe(false);
    expect(isWalkableHighway({ highway: "footway", access: "private" })).toBe(false);
    expect(isWalkableHighway({ highway: "construction" })).toBe(false);
    expect(isWalkableHighway({ highway: "pedestrian", area: "yes" })).toBe(false);
    expect(isWalkableHighway(undefined)).toBe(false);
  });
});

describe("extractWalkNetwork", () => {
  it("町字ポリゴンの内側の道を含める", async () => {
    const result = await extractWalkNetwork(
      stream([
        node(nodeAt(INSIDE, 1, 0)),
        node(nodeAt(INSIDE, 2, 0.05)),
        way(10, [1, 2], { highway: "footway" }),
      ]),
      TOWN,
      [],
    );

    expect(result.nodes.map((entry) => entry.id)).toEqual([1, 2]);
    expect(result.edges).toEqual([{ a: 1, b: 2 }]);
  });

  it("町字ポリゴンの外でも停留所から300メートル以内の道を含める", async () => {
    const outside = { lat: 35.6905, lng: 139.755 };
    const stop = nodeAt(outside, 0, WALK_STOP_MARGIN_KM * 0.4);
    const result = await extractWalkNetwork(
      stream([
        node(nodeAt(outside, 3, 0)),
        node(nodeAt(outside, 4, 0.05)),
        way(11, [3, 4], { highway: "footway" }),
      ]),
      TOWN,
      [{ lat: stop.lat, lng: stop.lng }],
    );

    expect(result.nodes.map((entry) => entry.id)).toEqual([3, 4]);
  });

  it("町字ポリゴンの外で停留所から300メートルを超える道を含めない", async () => {
    const outside = { lat: 35.6805, lng: 139.755 };
    const result = await extractWalkNetwork(
      stream([
        node(nodeAt(outside, 5, 0)),
        node(nodeAt(outside, 6, 0.05)),
        way(12, [5, 6], { highway: "footway" }),
      ]),
      TOWN,
      [nodeAt(INSIDE, 0, 0)],
    );

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("最大の連結成分とつながらない歩道を除く", async () => {
    const result = await extractWalkNetwork(
      stream([
        node(nodeAt(INSIDE, 1, 0)),
        node(nodeAt(INSIDE, 2, 0.02)),
        node(nodeAt(INSIDE, 3, 0.04)),
        node(nodeAt(INSIDE, 21, 0.2, 0.3)),
        node(nodeAt(INSIDE, 22, 0.22, 0.3)),
        way(20, [1, 2, 3], { highway: "footway" }),
        way(21, [21, 22], { highway: "footway" }),
      ]),
      TOWN,
      [],
    );

    expect(result.nodes.map((entry) => entry.id)).toEqual([1, 2, 3]);
    expect(result.edges).toEqual([
      { a: 1, b: 2 },
      { a: 2, b: 3 },
    ]);
    expect(result.stats.components).toBe(2);
  });

  it("通行禁止の道を含めない", async () => {
    const result = await extractWalkNetwork(
      stream([
        node(nodeAt(INSIDE, 1, 0)),
        node(nodeAt(INSIDE, 2, 0.02)),
        way(30, [1, 2], { highway: "footway", foot: "no" }),
      ]),
      TOWN,
      [],
    );

    expect(result.edges).toEqual([]);
  });

  it("同じ2ノードを結ぶエッジを重複させない", async () => {
    const result = await extractWalkNetwork(
      stream([
        node(nodeAt(INSIDE, 1, 0)),
        node(nodeAt(INSIDE, 2, 0.02)),
        way(40, [1, 2], { highway: "footway" }),
        way(41, [2, 1], { highway: "service" }),
      ]),
      TOWN,
      [],
    );

    expect(result.edges).toEqual([{ a: 1, b: 2 }]);
  });

  it("ノードとエッジをIDの昇順に並べる", async () => {
    const result = await extractWalkNetwork(
      stream([
        node(nodeAt(INSIDE, 9, 0.02)),
        node(nodeAt(INSIDE, 3, 0)),
        node(nodeAt(INSIDE, 5, 0.01)),
        way(50, [9, 5, 3], { highway: "footway" }),
      ]),
      TOWN,
      [],
    );

    expect(result.nodes.map((entry) => entry.id)).toEqual([3, 5, 9]);
    expect(result.edges).toEqual([
      { a: 3, b: 5 },
      { a: 5, b: 9 },
    ]);
  });
});
