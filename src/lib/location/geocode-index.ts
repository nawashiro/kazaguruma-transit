import { readFileSync } from "node:fs";

/**
 * 索引の形式はビルド時の生成スクリプトと実行時の検索で共有する。
 * data/geocode-index.json はこのモジュールの serializeGeocodeIndex で書き出す。
 */
export const GEOCODE_INDEX_VERSION = 1;

export const PREFECTURE_PREFIX = "千代田区";

export type GeocodeKind =
  | "station"
  | "park"
  | "public"
  | "culture"
  | "medical"
  | "school"
  | "welfare"
  | "lodging"
  | "shop"
  | "food"
  | "parking"
  | "other";

const GEOCODE_KINDS: readonly GeocodeKind[] = [
  "station",
  "park",
  "public",
  "culture",
  "medical",
  "school",
  "welfare",
  "lodging",
  "shop",
  "food",
  "parking",
  "other",
];

export interface GeocodeBlock {
  town: string;
  /** 0 は丁目を持たない町名を表す。 */
  chome: number;
  block: string;
  lat: number;
  lng: number;
  representative: boolean;
}

export interface GeocodeName {
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
  kind: GeocodeKind;
}

export interface GeocodeIndexSource {
  isj: {
    name: string;
    url: string;
    license: string;
    licenseUrl: string;
    version: string;
  };
  osm: {
    name: string;
    url: string;
    license: string;
    licenseUrl: string;
    extractUri: string;
  };
}

export interface GeocodeBoundary {
  name: string;
  /** ポリゴン -> リング -> [経度, 緯度]。最初のリングが外周、以降は穴。 */
  polygons: number[][][][];
}

export interface GeocodeIndex {
  version: number;
  generatedAt: string;
  source: GeocodeIndexSource;
  boundary: GeocodeBoundary[];
  blocks: GeocodeBlock[];
  names: GeocodeName[];
}

export type GeocodeIndexLoadResult =
  | { status: "success"; index: GeocodeIndex }
  | { status: "error"; error: Error };

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(message: string): never {
  throw new Error(`地点索引の形式が不正です: ${message}`);
}

function requireString(value: unknown, path: string): string {
  if (!isNonEmptyString(value)) {
    fail(`${path} は空でない文字列である必要があります`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (!isFiniteNumber(value)) {
    fail(`${path} は有限の数値である必要があります`);
  }
  return value;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(`${path} は配列である必要があります`);
  }
  return value;
}

function requireRecord(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) {
    fail(`${path} はオブジェクトである必要があります`);
  }
  return value;
}

export function isGeocodeKind(value: unknown): value is GeocodeKind {
  return (
    typeof value === "string" &&
    (GEOCODE_KINDS as readonly string[]).includes(value)
  );
}

function parseSource(value: unknown): GeocodeIndexSource {
  const source = requireRecord(value, "source");
  const isj = requireRecord(source.isj, "source.isj");
  const osm = requireRecord(source.osm, "source.osm");
  return {
    isj: {
      name: requireString(isj.name, "source.isj.name"),
      url: requireString(isj.url, "source.isj.url"),
      license: requireString(isj.license, "source.isj.license"),
      licenseUrl: requireString(isj.licenseUrl, "source.isj.licenseUrl"),
      version: requireString(isj.version, "source.isj.version"),
    },
    osm: {
      name: requireString(osm.name, "source.osm.name"),
      url: requireString(osm.url, "source.osm.url"),
      license: requireString(osm.license, "source.osm.license"),
      licenseUrl: requireString(osm.licenseUrl, "source.osm.licenseUrl"),
      extractUri: requireString(osm.extractUri, "source.osm.extractUri"),
    },
  };
}

function parseRing(value: unknown, path: string): number[][] {
  return requireArray(value, path).map((point, pointIndex) => {
    const pair = requireArray(point, `${path}[${pointIndex}]`);
    if (pair.length !== 2) {
      fail(`${path}[${pointIndex}] は [経度, 緯度] である必要があります`);
    }
    return [
      requireFiniteNumber(pair[0], `${path}[${pointIndex}][0]`),
      requireFiniteNumber(pair[1], `${path}[${pointIndex}][1]`),
    ];
  });
}

function parseBoundary(value: unknown): GeocodeBoundary[] {
  return requireArray(value, "boundary").map((entry, index) => {
    const path = `boundary[${index}]`;
    const record = requireRecord(entry, path);
    const polygons = requireArray(record.polygons, `${path}.polygons`).map(
      (polygon, polygonIndex) =>
        requireArray(polygon, `${path}.polygons[${polygonIndex}]`).map(
          (ring, ringIndex) =>
            parseRing(
              ring,
              `${path}.polygons[${polygonIndex}][${ringIndex}]`,
            ),
        ),
    );
    return {
      name: requireString(record.name, `${path}.name`),
      polygons,
    };
  });
}

function parseBlocks(value: unknown): GeocodeBlock[] {
  return requireArray(value, "blocks").map((entry, index) => {
    const path = `blocks[${index}]`;
    const record = requireRecord(entry, path);
    const chome = requireFiniteNumber(record.chome, `${path}.chome`);
    if (!Number.isInteger(chome) || chome < 0) {
      fail(`${path}.chome は0以上の整数である必要があります`);
    }
    if (typeof record.representative !== "boolean") {
      fail(`${path}.representative は真偽値である必要があります`);
    }
    return {
      town: requireString(record.town, `${path}.town`),
      chome,
      block: requireString(record.block, `${path}.block`),
      lat: requireFiniteNumber(record.lat, `${path}.lat`),
      lng: requireFiniteNumber(record.lng, `${path}.lng`),
      representative: record.representative,
    };
  });
}

function parseNames(value: unknown): GeocodeName[] {
  return requireArray(value, "names").map((entry, index) => {
    const path = `names[${index}]`;
    const record = requireRecord(entry, path);
    if (!isGeocodeKind(record.kind)) {
      fail(`${path}.kind は既知の種別である必要があります`);
    }
    const aliases = requireArray(record.aliases, `${path}.aliases`).map(
      (alias, aliasIndex) =>
        requireString(alias, `${path}.aliases[${aliasIndex}]`),
    );
    return {
      name: requireString(record.name, `${path}.name`),
      aliases,
      lat: requireFiniteNumber(record.lat, `${path}.lat`),
      lng: requireFiniteNumber(record.lng, `${path}.lng`),
      kind: record.kind,
    };
  });
}

export function parseGeocodeIndex(value: unknown): GeocodeIndex {
  const record = requireRecord(value, "index");
  const version = requireFiniteNumber(record.version, "version");
  if (version !== GEOCODE_INDEX_VERSION) {
    fail(`version は ${GEOCODE_INDEX_VERSION} である必要があります`);
  }
  return {
    version,
    generatedAt: requireString(record.generatedAt, "generatedAt"),
    source: parseSource(record.source),
    boundary: parseBoundary(record.boundary),
    blocks: parseBlocks(record.blocks),
    names: parseNames(record.names),
  };
}

/**
 * 索引の生成日時と出典はファイルの先頭に置く。作業者が中身を開いたとき、
 * どの時点のデータかを最初に確認できるようにするため。
 *
 * 配列の要素は1行ずつ書き出す。1行のJSONでは差分が全体の置換になり、
 * どの地点が変わったかをレビューできない。
 */
export function serializeGeocodeIndex(index: GeocodeIndex): string {
  const header = {
    version: index.version,
    generatedAt: index.generatedAt,
    source: index.source,
  };
  const headerText = JSON.stringify(header, null, 2).slice(0, -2);
  const arrays = (["boundary", "blocks", "names"] as const).map((key) => {
    const entries = index[key].map((entry) => JSON.stringify(entry));
    return `  ${JSON.stringify(key)}: [\n${entries.map((entry) => `    ${entry}`).join(",\n")}\n  ]`;
  });
  return `${headerText},\n${arrays.join(",\n")}\n}\n`;
}

export function loadGeocodeIndex(
  path: string,
  readText: (path: string) => string = (target) =>
    readFileSync(target, "utf8"),
): GeocodeIndexLoadResult {
  let raw: string;
  try {
    raw = readText(path);
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
  try {
    return { status: "success", index: parseGeocodeIndex(JSON.parse(raw)) };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
