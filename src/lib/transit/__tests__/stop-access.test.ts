import {
  WalkAccessIndex,
  getWalkAccessIndex,
  measureWalkAccess,
  resetWalkAccessCache,
  type WalkAccessStop,
} from "../stop-access";
import { walkAccessLevel } from "../walk-access-level";
import { createGridWalkGraph, gridPoint } from "../test-support/walk-network-fixture";
import {
  getWalkNetwork,
  prepareWalkSearch,
  walkLeg,
  type WalkGraph,
} from "../walk-network";

const CENTER = { lat: 35.69, lng: 139.75 };
const graph = createGridWalkGraph(CENTER);

function stopAt(id: string, northKm: number, eastKm = 0): WalkAccessStop {
  const point = gridPoint(CENTER, northKm, eastKm);
  return { id, lat: point.lat, lon: point.lng };
}

function walkLegMeters(target: WalkAccessStop, from = CENTER): number {
  const leg = walkLeg(graph, prepareWalkSearch(graph, from), {
    lat: target.lat,
    lng: target.lon,
  });
  if (leg === null) {
    throw new Error("徒歩経路がありません");
  }
  return leg.distanceKm * 1000;
}

describe("WalkAccessIndex", () => {
  it("停留所までの徒歩距離がwalkLegと一致する", () => {
    const stops = [stopAt("north-300m", 0.3), stopAt("east-600m", 0, 0.6)];
    const index = new WalkAccessIndex(stops, graph);
    const from = gridPoint(CENTER, 0.1, 0.05);

    const measured = index.measure(from.lat, from.lng);

    expect(measured?.stopId).toBe("north-300m");
    expect(measured?.meters).toBeCloseTo(walkLegMeters(stops[0], from), 6);
  });

  it("同じノードに接続する停留所までの距離を直線距離にする", () => {
    // 格子は10m間隔なので、2m離れた停留所は同じノードに接続する。
    const stops = [stopAt("same-node", 0.002)];
    const index = new WalkAccessIndex(stops, graph);

    // 接続区間を2回足すと4mになる。直線距離の2mになることを確かめる。
    expect(index.measure(CENTER.lat, CENTER.lng)?.meters).toBeCloseTo(2, 0);
    expect(walkLegMeters(stops[0], CENTER)).toBeCloseTo(2, 0);
  });

  it("複数の停留所から最も近いものを選ぶ", () => {
    const stops = [stopAt("far-800m", 0.8), stopAt("near-100m", 0.1)];
    const index = new WalkAccessIndex(stops, graph);

    expect(index.measure(CENTER.lat, CENTER.lng)).toEqual({
      meters: expect.closeTo(100, 0),
      stopId: "near-100m",
    });
  });

  it("徒歩ネットワークへ接続できない地点ではnullを返す", () => {
    const index = new WalkAccessIndex([stopAt("north-100m", 0.1)], graph);

    expect(index.measure(0, 0)).toBeNull();
  });
});

describe("measureWalkAccessの距離場", () => {
  afterEach(() => {
    resetWalkAccessCache();
  });

  it("同じ停留所と徒歩ネットワークなら距離場を作り直さない", () => {
    const stops = [stopAt("north-100m", 0.1)];
    const first = getWalkAccessIndex(stops, graph);
    const second = getWalkAccessIndex(stops.map((stop) => ({ ...stop })), graph);

    expect(second).toBe(first);
  });

  it("停留所が変われば距離場を作り直す", () => {
    const first = getWalkAccessIndex([stopAt("north-100m", 0.1)], graph);
    const second = getWalkAccessIndex([stopAt("north-200m", 0.2)], graph);

    expect(second).not.toBe(first);
    expect(second.measure(CENTER.lat, CENTER.lng)?.stopId).toBe("north-200m");
  });

  it("1つの距離場から複数の地点を測れる", () => {
    const stops = [stopAt("north-100m", 0.1), stopAt("east-100m", 0, 0.1)];

    expect(
      measureWalkAccess(stops, CENTER.lat, CENTER.lng, graph)?.stopId,
    ).toBe("north-100m");
    const east = gridPoint(CENTER, 0, 0.05);
    expect(
      measureWalkAccess(stops, east.lat, east.lng, graph)?.stopId,
    ).toBe("east-100m");
  });
});

describe("walkAccessLevel", () => {
  it("警告線ちょうどは通常である", () => {
    expect(walkAccessLevel(500)).toBe("near");
  });

  it("警告線を1m超えると遠い", () => {
    expect(walkAccessLevel(501)).toBe("far");
  });

  it("上限定義ちょうどは遠いのまま", () => {
    expect(walkAccessLevel(750)).toBe("far");
  });

  it("上限を1m超えると遠すぎる", () => {
    expect(walkAccessLevel(751)).toBe("tooFar");
  });
});

describe("実データの徒歩ネットワークとの一致", () => {
  const realGraph: WalkGraph = getWalkNetwork();
  const stops: WalkAccessStop[] = [
    { id: "kudanshita", lat: 35.6952997, lon: 139.7504426 },
    { id: "kanda", lat: 35.6918, lon: 139.7710 },
  ];

  it("walkLegと同じ距離を返す", () => {
    const from = { lat: 35.6921178, lng: 139.7509767 };
    const index = new WalkAccessIndex(stops, realGraph);
    const measured = index.measure(from.lat, from.lng);

    const leg = walkLeg(realGraph, prepareWalkSearch(realGraph, from), {
      lat: stops[0].lat,
      lng: stops[0].lon,
    });

    expect(measured?.stopId).toBe("kudanshita");
    expect(measured?.meters).toBeCloseTo((leg as { distanceKm: number }).distanceKm * 1000, 3);
  });
});
