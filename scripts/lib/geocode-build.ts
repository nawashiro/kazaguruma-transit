import { createHash } from "node:crypto";

import type {
  GeocodeBoundary,
  GeocodeIndex,
  GeocodeIndexSource,
} from "../../src/lib/location/geocode-index";
import { GEOCODE_INDEX_VERSION } from "../../src/lib/location/geocode-index";
import { mergeNames, type NameAccumulator } from "./geocode-merge";
import type { OSMNamedFeature, TownBoundary } from "./osm-extract";

export const ISJ_SOURCE: GeocodeIndexSource["isj"] = {
  name: "位置参照情報（街区レベル）",
  url: "https://nlftp.mlit.go.jp/isj/",
  license: "公共データ利用規約（第1.0版）",
  licenseUrl: "https://www.digital.go.jp/resources/open_data/public_data_license_v1.0",
  version: "24.0a",
};

export const OSM_SOURCE: GeocodeIndexSource["osm"] = {
  name: "OpenStreetMap（東京都抽出）",
  url: "https://www.openstreetmap.org/copyright",
  license: "ODbL-1.0",
  licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  extractUri: "https://osm.download.movisda.io/admin/JP-13-latest.osm.pbf",
};

export interface BuildIndexInput {
  generatedAt: string;
  isjVersion: string | null;
  blocks: GeocodeIndex["blocks"];
  boundary: TownBoundary[];
  artifactNames: Array<{
    name: string;
    lat: number;
    lng: number;
    categoryIds: string[];
  }>;
  stops: Array<{ name: string; lat: number; lng: number }>;
  osm: OSMNamedFeature[];
}

export interface BuildIndexResult {
  index: GeocodeIndex;
  counts: {
    blocks: number;
    boundary: number;
    artifact: number;
    stops: number;
    osm: number;
    names: number;
  };
}

/**
 * 索引の内容そのものからダイジェストを作る。生成日時は含めないため、
 * 同じ出典から生成し直したときに同じ値になる。
 */
export function indexDigest(index: GeocodeIndex): string {
  const payload = JSON.stringify({
    version: index.version,
    boundary: index.boundary.map((feature) => feature.name),
    blocks: index.blocks,
    names: index.names,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function toBoundary(boundary: TownBoundary[]): GeocodeBoundary[] {
  return boundary.map((feature) => ({
    name: feature.name,
    polygons: feature.polygons,
  }));
}

export function buildGeocodeIndex(input: BuildIndexInput): BuildIndexResult {
  const { names, counts } = mergeNames({
    blocks: input.blocks,
    artifactNames: input.artifactNames,
    stops: input.stops,
    osm: input.osm,
  });

  return {
    index: {
      version: GEOCODE_INDEX_VERSION,
      generatedAt: input.generatedAt,
      source: {
        isj: {
          ...ISJ_SOURCE,
          version: input.isjVersion ?? ISJ_SOURCE.version,
        },
        osm: { ...OSM_SOURCE },
      },
      boundary: toBoundary(input.boundary),
      blocks: input.blocks,
      names,
    },
    counts: {
      blocks: input.blocks.length,
      boundary: input.boundary.length,
      artifact: counts.artifact,
      stops: counts.stops,
      osm: counts.osm,
      names: counts.merged,
    },
  };
}

export interface NameSourcePayload {
  artifact: unknown;
  stops: Array<{ name: string; lat: number; lng: number }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * 場所artifactのカテゴリ一覧から、索引に載せる名前を取り出す。
 * 同じ場所が複数カテゴリに出るため、名前と座標でまとめてカテゴリを
 * 集約する。
 */
export function readArtifactNames(payload: unknown): BuildIndexInput["artifactNames"] {
  if (!isRecord(payload) || !isRecord(payload.sources)) {
    throw new Error("場所artifactの形式が不正です");
  }
  const categories = payload.sources.locations;
  if (!Array.isArray(categories)) {
    throw new Error("場所artifactにカテゴリ一覧がありません");
  }
  const byPlace = new Map<string, BuildIndexInput["artifactNames"][number]>();
  for (const category of categories) {
    if (!isRecord(category) || !Array.isArray(category.locations)) {
      continue;
    }
    const categoryId = typeof category.categoryId === "string" ? category.categoryId : "";
    for (const location of category.locations) {
      if (!isRecord(location)) {
        continue;
      }
      const name = location.name;
      const lat = location.lat;
      const lng = location.lng;
      if (!isNonEmptyString(name) || !isFiniteNumber(lat) || !isFiniteNumber(lng)) {
        continue;
      }
      const key = `${name}|${lat}|${lng}`;
      const existing = byPlace.get(key);
      if (existing === undefined) {
        byPlace.set(key, { name, lat, lng, categoryIds: [categoryId] });
        continue;
      }
      if (categoryId.length > 0 && !existing.categoryIds.includes(categoryId)) {
        existing.categoryIds.push(categoryId);
      }
    }
  }
  return [...byPlace.values()].sort((first, second) =>
    first.name.localeCompare(second.name, "ja"),
  );
}

export function readTownBoundary(payload: unknown): TownBoundary[] {
  if (!isRecord(payload) || payload.type !== "FeatureCollection") {
    throw new Error("町字GeoJSONの形式が不正です");
  }
  const features = payload.features;
  if (!Array.isArray(features) || features.length === 0) {
    throw new Error("町字GeoJSONにフィーチャーがありません");
  }
  return features.map((feature, index) => {
    if (!isRecord(feature) || !isRecord(feature.properties)) {
      throw new Error(`町字GeoJSONのフィーチャーが不正です: ${index}`);
    }
    const name = feature.properties.name;
    if (!isNonEmptyString(name)) {
      throw new Error(`町字GeoJSONに名前がありません: ${index}`);
    }
    const geometry = feature.geometry;
    if (!isRecord(geometry)) {
      throw new Error(`町字GeoJSONにジオメトリがありません: ${index}`);
    }
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.type === "MultiPolygon"
          ? geometry.coordinates
          : null;
    if (!Array.isArray(polygons)) {
      throw new Error(`町字GeoJSONの種別が不正です: ${index}`);
    }
    return {
      name,
      polygons: polygons as number[][][][],
    };
  });
}

export type { NameAccumulator };
