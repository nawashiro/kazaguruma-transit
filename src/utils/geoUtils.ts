import fs from "fs";
import path from "path";
import { AddressLocation } from "./addressLoader";

interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    name: string;
    uri?: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

let cachedGeoJSON: GeoJSON | null = null;

const GEOJSON_CDN_URL =
  "https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_town_geojson@latest/chiyoda_city.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCoordinate(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every(
      (coordinate) =>
        typeof coordinate === "number" && Number.isFinite(coordinate),
    )
  );
}

function isPolygonCoordinates(value: unknown): value is number[][][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (ring) =>
        Array.isArray(ring) &&
        ring.length > 0 &&
        ring.every(isCoordinate),
    )
  );
}

function isMultiPolygonCoordinates(value: unknown): value is number[][][][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isPolygonCoordinates)
  );
}

function isGeoJSONFeature(value: unknown): value is GeoJSONFeature {
  if (!isRecord(value) || value.type !== "Feature") {
    return false;
  }

  const properties = value.properties;
  const geometry = value.geometry;
  if (!isRecord(properties) || !isRecord(geometry)) {
    return false;
  }

  if (
    typeof properties.name !== "string" ||
    properties.name.trim().length === 0 ||
    (properties.uri !== undefined && typeof properties.uri !== "string")
  ) {
    return false;
  }

  if (geometry.type === "Polygon") {
    return isPolygonCoordinates(geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return isMultiPolygonCoordinates(geometry.coordinates);
  }

  return false;
}

function isGeoJSON(value: unknown): value is GeoJSON {
  return (
    isRecord(value) &&
    value.type === "FeatureCollection" &&
    Array.isArray(value.features) &&
    value.features.length > 0 &&
    value.features.every(isGeoJSONFeature)
  );
}

function validateGeoJSON(value: unknown): GeoJSON {
  if (!isGeoJSON(value)) {
    throw new Error("Invalid GeoJSON FeatureCollection shape");
  }

  return value;
}

function isFileNotFoundError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

function cacheGeoJSON(value: unknown): GeoJSON {
  const validated = validateGeoJSON(value);
  cachedGeoJSON = validated;
  return validated;
}

function loadGeoJSONFromCDN(): Promise<GeoJSON> {
  return fetch(GEOJSON_CDN_URL).then(async (response) => {
    if (!response.ok) {
      throw new Error(`GeoJSON CDN request failed with HTTP ${response.status}`);
    }

    const remoteData: unknown = await response.json();
    return cacheGeoJSON(remoteData);
  });
}

// GeoJSONデータを読み込む関数
export async function loadGeoJSON(): Promise<GeoJSON> {
  if (cachedGeoJSON) {
    return cachedGeoJSON;
  }

  const filePath = path.join(
    process.cwd(),
    "public",
    "geojson",
    "chiyoda_city.geojson",
  );

  try {
    const localData = fs.readFileSync(filePath, "utf8");
    return cacheGeoJSON(JSON.parse(localData) as unknown);
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }
  }

  return loadGeoJSONFromCDN();
}

// 緯度経度が指定されたポリゴン内に含まれるかチェックする関数
export function isPointInPolygon(
  point: [number, number],
  polygon: number[][]
): boolean {
  const [lng, lat] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

// 緯度経度が指定されたマルチポリゴン内に含まれるかチェックする関数
export function isPointInMultiPolygon(
  point: [number, number],
  multiPolygon: number[][][]
): boolean {
  for (const polygon of multiPolygon) {
    if (isPointInPolygon(point, polygon)) {
      return true;
    }
  }
  return false;
}

// 緯度経度からその点が含まれる町村名を取得する関数
export function getAreaNameFromCoordinates(
  lat: number,
  lng: number,
  geoJSON: GeoJSON
): string | null {
  const point: [number, number] = [lng, lat]; // GeoJSONはlng,latの順

  for (const feature of geoJSON.features) {
    if (feature.geometry.type === "Polygon") {
      // Polygonの場合
      const polygonCoords = feature.geometry.coordinates as number[][][];
      for (const polygon of polygonCoords) {
        if (isPointInPolygon(point, polygon)) {
          return feature.properties.name;
        }
      }
    } else if (feature.geometry.type === "MultiPolygon") {
      // MultiPolygonの場合
      const multiPolygonCoords = feature.geometry.coordinates as number[][][][];
      for (const multiPolygon of multiPolygonCoords) {
        if (isPointInMultiPolygon(point, multiPolygon)) {
          return feature.properties.name;
        }
      }
    }
  }

  return null;
}

// 町村名を表示用に整形する関数
export function formatAreaName(name: string): string {
  // GeoJSONの町村名をそのまま返す
  return name;
}

// 町村ごとに場所をグループ化する関数
export function groupLocationsByArea(
  locations: AddressLocation[],
  geoJSON: GeoJSON
): { [areaName: string]: AddressLocation[] } {
  const groups: { [areaName: string]: AddressLocation[] } = {};

  for (const location of locations) {
    const areaName = getAreaNameFromCoordinates(
      location.lat,
      location.lng,
      geoJSON
    );
    if (areaName) {
      const formattedName = formatAreaName(areaName);
      if (!groups[formattedName]) {
        groups[formattedName] = [];
      }
      groups[formattedName].push(location);
    } else {
      // 町村が特定できない場合は「その他」にグループ化
      if (!groups["その他"]) {
        groups["その他"] = [];
      }
      groups["その他"].push(location);
    }
  }

  return groups;
}
