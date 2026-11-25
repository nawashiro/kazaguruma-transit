import {
  buildWalkGraph,
  walkDistanceKm,
  type WalkNetworkArtifact,
} from "../walk-network";
import {
  calculateHaversineDistanceKm,
  selectNearbyStops,
  type StopPosition,
} from "../stop-selection";

const ORIGIN = { lat: 35.69, lng: 139.75 };
const KM_PER_LAT_DEGREE = 111.195;
const KM_PER_LNG_DEGREE = 111.195 * Math.cos((35.69 * Math.PI) / 180);

function grid(lat: number, lng: number): [number, number] {
  return [Math.round(lat * 1e6), Math.round(lng * 1e6)];
}

/**
 * 原点から北へ伸びる道と、東へ伸びる道が、原点の交差点で交わる。
 * 北の道は3本の枝を持つ。東の道は遠回りになるよう、北へ大きく迂回させる。
 */
function crossArtifact(): WalkNetworkArtifact {
  const nodes: number[][] = [];
  const edges: Array<[number, number]> = [];
  let id = 1;
  const add = (lat: number, lng: number): number => {
    const current = id;
    id += 1;
    nodes.push([current, ...grid(lat, lng)]);
    return current;
  };
  const connect = (a: number, b: number) => edges.push([Math.min(a, b), Math.max(a, b)]);

  const origin = add(ORIGIN.lat, ORIGIN.lng);
  let previous = origin;
  for (let step = 1; step <= 60; step += 1) {
    const next = add(ORIGIN.lat + (step * 0.01) / KM_PER_LAT_DEGREE, ORIGIN.lng);
    connect(previous, next);
    previous = next;
  }
  previous = origin;
  for (let step = 1; step <= 60; step += 1) {
    const next = add(ORIGIN.lat, ORIGIN.lng + (step * 0.01) / KM_PER_LNG_DEGREE);
    connect(previous, next);
    previous = next;
  }
  return { version: 1, nodes: nodes as [number, number, number][], edges };
}

const graph = buildWalkGraph(crossArtifact());

function stopOnNorthRoad(id: string, km: number, offsetKm = 0): StopPosition {
  return {
    id,
    name: id,
    lat:
      Math.round(
        (ORIGIN.lat + km / KM_PER_LAT_DEGREE + offsetKm / KM_PER_LAT_DEGREE) * 1e6,
      ) / 1e6,
    lon: ORIGIN.lng,
  };
}

function stopOnEastRoad(id: string, km: number): StopPosition {
  return {
    id,
    name: id,
    lat: ORIGIN.lat,
    lon:
      Math.round((ORIGIN.lng + km / KM_PER_LNG_DEGREE) * 1e6) / 1e6,
  };
}

function straightDistanceTo(stop: StopPosition): number {
  return calculateHaversineDistanceKm(ORIGIN.lat, ORIGIN.lng, stop.lat, stop.lon);
}

describe("calculateHaversineDistanceKm", () => {
  it("同じ座標の距離は0で、離れるほど大きくなる", () => {
    expect(
      calculateHaversineDistanceKm(ORIGIN.lat, ORIGIN.lng, ORIGIN.lat, ORIGIN.lng),
    ).toBe(0);
    expect(straightDistanceTo(stopOnNorthRoad("near", 0.1))).toBeLessThan(
      straightDistanceTo(stopOnNorthRoad("far", 0.2)),
    );
  });
});

describe("selectNearbyStops", () => {
  it("徒歩距離が500m以内の停留所を採用する", () => {
    const stops = [stopOnNorthRoad("stop-300m", 0.3), stopOnNorthRoad("stop-too-far", 2)];

    expect(
      selectNearbyStops(stops, ORIGIN.lat, ORIGIN.lng, 0.5, graph).map((stop) => stop.id),
    ).toEqual(["stop-300m"]);
  });

  it("接続区間を含めると徒歩距離が直線距離より長くなる", () => {
    const offRoad = stopOnNorthRoad("off-road", 0.05, 0.3);
    const walkingKm = walkDistanceKm(
      graph,
      { lat: ORIGIN.lat, lng: ORIGIN.lng },
      { lat: offRoad.lat, lng: offRoad.lon },
    );

    expect(straightDistanceTo(offRoad)).toBeLessThan(walkingKm);
    expect(selectNearbyStops([offRoad], ORIGIN.lat, ORIGIN.lng, 0.5, graph)).toHaveLength(1);
  });

  it("徒歩距離が上限と等しい停留所を採用する", () => {
    const stop = stopOnNorthRoad("stop-limit", 0.3);
    const walkingKm = walkDistanceKm(
      graph,
      { lat: ORIGIN.lat, lng: ORIGIN.lng },
      { lat: stop.lat, lng: stop.lon },
    );

    expect(
      selectNearbyStops([stop], ORIGIN.lat, ORIGIN.lng, walkingKm, graph).map(
        (item) => item.id,
      ),
    ).toEqual(["stop-limit"]);
    expect(
      selectNearbyStops([stop], ORIGIN.lat, ORIGIN.lng, walkingKm - 0.0001, graph),
    ).toEqual([]);
  });

  it("徒歩距離の近い順に並べる", () => {
    const stops = [
      stopOnNorthRoad("stop-300m", 0.3),
      stopOnNorthRoad("stop-10m", 0.01),
      stopOnNorthRoad("stop-200m", 0.2),
    ];

    expect(
      selectNearbyStops(stops, ORIGIN.lat, ORIGIN.lng, 0.5, graph).map((stop) => stop.id),
    ).toEqual(["stop-10m", "stop-200m", "stop-300m"]);
  });

  it("停留所の位置と直線距離を返す", () => {
    const stop = stopOnNorthRoad("stop-300m", 0.3);

    const [selected] = selectNearbyStops([stop], ORIGIN.lat, ORIGIN.lng, 0.5, graph);

    expect(selected).toMatchObject({
      id: "stop-300m",
      name: "stop-300m",
      lat: stop.lat,
      lng: stop.lon,
    });
    expect(selected.distance).toBeCloseTo(straightDistanceTo(stop), 6);
  });

  it("既定の探索半径は500mである", () => {
    const stops = [stopOnNorthRoad("stop-just-inside", 0.49), stopOnNorthRoad("stop-just-outside", 0.6)];

    expect(
      selectNearbyStops(stops, ORIGIN.lat, ORIGIN.lng, undefined, graph).map((stop) => stop.id),
    ).toEqual(["stop-just-inside"]);
  });

  it("北と東の道を同じ基準で測る", () => {
    const north = stopOnNorthRoad("north-400m", 0.4);
    const east = stopOnEastRoad("east-400m", 0.4);

    expect(
      selectNearbyStops([north, east], ORIGIN.lat, ORIGIN.lng, 0.45, graph).map(
        (stop) => stop.id,
      ).sort(),
    ).toEqual(["east-400m", "north-400m"]);
  });
});
