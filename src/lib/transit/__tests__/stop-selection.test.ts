import {
  calculateHaversineDistanceKm,
  selectNearbyStops,
  type StopPosition,
} from "../stop-selection";
import { calculateGridWalkingDistanceKm } from "../walking";

const ORIGIN = { lat: 35.69, lng: 139.75 };
const KM_PER_LAT_DEGREE = 111.195;

function stopAtNorthDistance(id: string, distanceKm: number): StopPosition {
  return {
    id,
    name: id,
    lat: ORIGIN.lat + distanceKm / KM_PER_LAT_DEGREE,
    lon: ORIGIN.lng,
  };
}

function straightDistanceTo(stop: StopPosition): number {
  return calculateHaversineDistanceKm(ORIGIN.lat, ORIGIN.lng, stop.lat, stop.lon);
}

describe("calculateHaversineDistanceKm", () => {
  it("同じ座標の距離は0で、離れるほど大きくなる", () => {
    expect(calculateHaversineDistanceKm(ORIGIN.lat, ORIGIN.lng, ORIGIN.lat, ORIGIN.lng)).toBe(0);
    expect(straightDistanceTo(stopAtNorthDistance("near", 0.1))).toBeLessThan(
      straightDistanceTo(stopAtNorthDistance("far", 0.2)),
    );
  });
});

describe("selectNearbyStops", () => {
  it("500m以内の停留所を採用する", () => {
    const stops = [
      stopAtNorthDistance("stop-300m", 0.3),
      stopAtNorthDistance("stop-too-far", 2),
    ];

    expect(selectNearbyStops(stops, ORIGIN.lat, ORIGIN.lng).map((stop) => stop.id)).toEqual([
      "stop-300m",
    ]);
  });

  it("直線距離ではなく√2補正後の徒歩距離で判定する", () => {
    const stop = stopAtNorthDistance("stop-400m", 0.4);
    const straightDistance = straightDistanceTo(stop);

    expect(straightDistance).toBeLessThan(0.5);
    expect(calculateGridWalkingDistanceKm(straightDistance)).toBeGreaterThan(0.5);
    expect(selectNearbyStops([stop], ORIGIN.lat, ORIGIN.lng)).toEqual([]);
  });

  it("補正後の徒歩距離が上限と等しい停留所を採用する", () => {
    const stop = stopAtNorthDistance("stop-limit", 0.3);
    const limitKm = calculateGridWalkingDistanceKm(straightDistanceTo(stop));

    expect(selectNearbyStops([stop], ORIGIN.lat, ORIGIN.lng, limitKm).map((item) => item.id)).toEqual([
      "stop-limit",
    ]);
    expect(selectNearbyStops([stop], ORIGIN.lat, ORIGIN.lng, limitKm - Number.EPSILON)).toEqual([]);
  });

  it("距離の近い順に並べる", () => {
    const stops = [
      stopAtNorthDistance("stop-300m", 0.3),
      stopAtNorthDistance("stop-10m", 0.01),
      stopAtNorthDistance("stop-200m", 0.2),
    ];

    expect(selectNearbyStops(stops, ORIGIN.lat, ORIGIN.lng).map((stop) => stop.id)).toEqual([
      "stop-10m",
      "stop-200m",
      "stop-300m",
    ]);
  });

  it("停留所の位置と直線距離を返す", () => {
    const stop = stopAtNorthDistance("stop-300m", 0.3);

    const [selected] = selectNearbyStops([stop], ORIGIN.lat, ORIGIN.lng);

    expect(selected).toEqual({
      id: "stop-300m",
      name: "stop-300m",
      lat: stop.lat,
      lng: stop.lon,
      distance: straightDistanceTo(stop),
    });
  });

  it("既定の探索半径は500mである", () => {
    const stops = [
      stopAtNorthDistance("stop-just-inside", 0.5 / Math.SQRT2),
      stopAtNorthDistance("stop-just-outside", 0.36),
    ];

    expect(selectNearbyStops(stops, ORIGIN.lat, ORIGIN.lng).map((stop) => stop.id)).toEqual([
      "stop-just-inside",
    ]);
  });
});
