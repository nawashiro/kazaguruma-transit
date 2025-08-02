import fs from "fs";
import path from "path";
import { AddressLocation } from "./addressLoader";

interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    name: string;
    uri: string;
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

// GeoJSONデータを読み込む関数
export async function loadGeoJSON(): Promise<GeoJSON> {
  if (cachedGeoJSON) {
    return cachedGeoJSON;
  }

  const filePath = path.join(
    process.cwd(),
    "public",
    "geojson",
    "chiyoda_city.geojson"
  );
  const data = fs.readFileSync(filePath, "utf8");
  cachedGeoJSON = JSON.parse(data) as GeoJSON;
  return cachedGeoJSON;
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
