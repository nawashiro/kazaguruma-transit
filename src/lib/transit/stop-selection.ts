import type { NearbyStop } from "../../types/core";
import { TRANSIT_PARAMS } from "./transit-params";
import { calculateGridWalkingDistanceKm } from "./walking";

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
 * 指定座標から補正徒歩距離が半径以内の停留所を、直線距離の近い順に返す。
 * 上限ちょうどの距離は含める。
 */
export function selectNearbyStops(
  stops: readonly StopPosition[],
  lat: number,
  lng: number,
  radiusKm: number = TRANSIT_PARAMS.DEFAULT_SEARCH_RADIUS / 1000,
): NearbyStop[] {
  return stops
    .map((stop) => ({
      id: stop.id,
      name: stop.name,
      lat: stop.lat,
      lng: stop.lon,
      distance: calculateHaversineDistanceKm(lat, lng, stop.lat, stop.lon),
    }))
    .filter(
      (stop) => calculateGridWalkingDistanceKm(stop.distance) <= radiusKm,
    )
    .sort((firstStop, secondStop) => firstStop.distance - secondStop.distance);
}
