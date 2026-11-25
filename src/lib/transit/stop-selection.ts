import type { NearbyStop } from "../../types/core";
import { TRANSIT_PARAMS } from "./transit-params";
import {
  getWalkNetwork,
  haversineKm,
  prepareWalkSearch,
  walkLeg,
  type WalkGraph,
} from "./walk-network";

const EARTH_RADIUS_KM = 6371;

export interface StopPosition {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** 2点間の直線距離をハバーサイン公式でキロメートル単位で返す。 */
export function calculateHaversineDistanceKm(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): number {
  const firstLatitudeRad = toRadians(firstLatitude);
  const firstLongitudeRad = toRadians(firstLongitude);
  const secondLatitudeRad = toRadians(secondLatitude);
  const secondLongitudeRad = toRadians(secondLongitude);

  const latitudeDifference = secondLatitudeRad - firstLatitudeRad;
  const longitudeDifference = secondLongitudeRad - firstLongitudeRad;

  const haversineValue =
    Math.sin(latitudeDifference / 2) * Math.sin(latitudeDifference / 2) +
    Math.cos(firstLatitudeRad) *
      Math.cos(secondLatitudeRad) *
      Math.sin(longitudeDifference / 2) *
      Math.sin(longitudeDifference / 2);

  return (
    EARTH_RADIUS_KM *
    2 *
    Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue))
  );
}

/**
 * 指定座標から、徒歩ネットワーク上の徒歩距離が半径以内の停留所を、
 * 徒歩距離の近い順に返す。上限ちょうどの距離は含める。起点から最寄りノード
 * までの接続区間と、停留所から最寄りノードまでの接続区間を含める。
 */
export function selectNearbyStops(
  stops: readonly StopPosition[],
  lat: number,
  lng: number,
  radiusKm: number = TRANSIT_PARAMS.DEFAULT_SEARCH_RADIUS / 1000,
  graph: WalkGraph = getWalkNetwork(),
): NearbyStop[] {
  const origin = { lat, lng };
  const prepared = prepareWalkSearch(graph, origin);
  const scored: Array<{ stop: NearbyStop; walkingKm: number }> = [];
  for (const stop of stops) {
    const position = { lat: stop.lat, lng: stop.lon };
    const leg = walkLeg(graph, prepared, position, { path: false });
    if (leg === null || leg.distanceKm > radiusKm) {
      continue;
    }
    scored.push({
      stop: {
        id: stop.id,
        name: stop.name,
        lat: stop.lat,
        lng: stop.lon,
        distance: haversineKm(origin, position),
      },
      walkingKm: leg.distanceKm,
    });
  }
  return scored
    .sort((firstStop, secondStop) => firstStop.walkingKm - secondStop.walkingKm)
    .map((entry) => entry.stop);
}
