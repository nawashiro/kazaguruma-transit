import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import {
  appConfigFileName,
  resolveAppConfigEnvironment,
} from "../src/lib/config/app-config-environment";
import {
  findOsmElementKey,
  isAbsoluteHttpUri,
  validateDestinationCatalog,
  type DestinationCatalog,
  type DestinationCatalogEntry,
  type DestinationCatalogSourceUris,
} from "../src/lib/location/destination-catalog";
import type { StopPosition } from "../src/lib/transit/stop-selection";
import { getWalkAccessIndex, type WalkAccessStop } from "../src/lib/transit/stop-access";
import { walkAccessLevel } from "../src/lib/transit/walk-access-level";
import { getWalkNetwork, type WalkGraph } from "../src/lib/transit/walk-network";

export interface DestinationCatalogTransportResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type DestinationCatalogTransport = (
  uri: string,
) => Promise<DestinationCatalogTransportResponse>;

export interface UpdateDestinationsOptions {
  appConfig: unknown;
  transport: DestinationCatalogTransport;
  loadStops: () => Promise<StopPosition[]>;
  readExistingCatalog: () => Promise<unknown | null>;
  writeCatalog: (catalog: DestinationCatalog) => Promise<void> | void;
  report: (message: string) => void;
  /**
   * 徒歩距離を求める徒歩ネットワーク。関数を渡すと、最初に必要になった
   * 時点で読み込む。省略時はartifactを読む。
   */
  walkGraph?: WalkGraph | (() => WalkGraph);
}

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

function readSourceUris(appConfig: unknown): DestinationCatalogSourceUris {
  if (!isRecord(appConfig)) {
    throw new Error("公開アプリ設定の形式が不正です");
  }
  const datasetJsonLdUri = appConfig.datasetJsonLdUri;
  const osmMirrorUri = appConfig.osmMirrorUri;
  if (
    typeof datasetJsonLdUri !== "string" ||
    typeof osmMirrorUri !== "string" ||
    !isAbsoluteHttpUri(datasetJsonLdUri) ||
    !isAbsoluteHttpUri(osmMirrorUri)
  ) {
    throw new Error(
      "公開アプリ設定のdatasetJsonLdUriとosmMirrorUriは絶対 http(s) URI である必要があります",
    );
  }
  return { datasetJsonLdUri, osmMirrorUri };
}

async function fetchJson(
  sourceName: string,
  uri: string,
  transport: DestinationCatalogTransport,
): Promise<unknown> {
  const response = await transport(uri);
  if (!response || typeof response !== "object") {
    throw new Error(`${sourceName} の応答が不正です`);
  }
  if (!response.ok || response.status < 200 || response.status >= 300) {
    throw new Error(`${sourceName} の取得に失敗しました (HTTP ${response.status})`);
  }
  return response.json();
}

function hasSchemaType(record: JsonRecord, type: string): boolean {
  const raw = record["@type"];
  return raw === type || (Array.isArray(raw) && raw.includes(type));
}

function readPlaceRecords(payload: unknown): JsonRecord[] {
  if (!isRecord(payload) || !Array.isArray(payload["@graph"])) {
    throw new Error("公開グラフの形式が不正です");
  }
  return payload["@graph"].filter(
    (record): record is JsonRecord =>
      isRecord(record) &&
      hasSchemaType(record, "schema:Place") &&
      typeof record["@id"] === "string" &&
      record["@id"].startsWith("urn:uuid:"),
  );
}

function readOsmNames(payload: unknown): Map<string, string> {
  if (!isRecord(payload) || !Array.isArray(payload.elements)) {
    throw new Error("OSMタグミラーの形式が不正です");
  }

  const names = new Map<string, string>();
  for (const element of payload.elements) {
    if (!isRecord(element)) {
      continue;
    }
    const type = element.type;
    const id = element.id;
    if (
      typeof type !== "string" ||
      (typeof id !== "number" && typeof id !== "string")
    ) {
      continue;
    }
    const tags = element.tags;
    if (!isRecord(tags) || !isNonEmptyString(tags.name)) {
      continue;
    }
    names.set(`${type}/${id}`, tags.name.trim());
  }
  return names;
}

function readPlaceCoordinates(
  record: JsonRecord,
): { lat: number; lng: number } | null {
  const geo = record["schema:geo"];
  if (!isRecord(geo)) {
    return null;
  }
  const lat = geo["schema:latitude"];
  const lng = geo["schema:longitude"];
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return null;
  }
  return { lat, lng };
}

function toAccessStops(stops: readonly StopPosition[]): WalkAccessStop[] {
  return stops.map((stop) => ({ id: stop.id, lat: stop.lat, lon: stop.lon }));
}

function selectCandidates(
  records: JsonRecord[],
  osmNames: Map<string, string>,
  stops: StopPosition[],
  previousEntries: Map<string, DestinationCatalogEntry>,
  walkGraph?: WalkGraph,
): DestinationCatalogEntry[] {
  const candidates = new Map<string, DestinationCatalogEntry>();
  const accessIndex = getWalkAccessIndex(
    toAccessStops(stops),
    walkGraph ?? getWalkNetwork(),
  );

  for (const record of records) {
    const id = record["@id"];
    if (typeof id !== "string") {
      continue;
    }

    const coordinates = readPlaceCoordinates(record);
    if (coordinates === null) {
      continue;
    }

    const access = accessIndex.measure(coordinates.lat, coordinates.lng);
    if (access === null || walkAccessLevel(access.meters) === "tooFar") {
      continue;
    }

    const osmElementKey = findOsmElementKey(record["rdfs:seeAlso"]);
    const osmName =
      osmElementKey === null ? undefined : osmNames.get(osmElementKey);
    const name = osmName ?? previousEntries.get(id)?.name;
    if (name === undefined) {
      continue;
    }

    candidates.set(id, {
      id,
      name,
      includeInRouteForm: false,
      walkToStopMeters: Math.round(access.meters),
    });
  }

  return [...candidates.values()].sort((first, second) =>
    first.id.localeCompare(second.id),
  );
}

function readPreviousEntries(
  existingCatalog: unknown | null,
): Map<string, DestinationCatalogEntry> {
  if (existingCatalog === null) {
    return new Map();
  }
  const catalog = validateDestinationCatalog(existingCatalog);
  return new Map(catalog.places.map((entry) => [entry.id, entry]));
}

function applySelection(
  candidates: DestinationCatalogEntry[],
  previousEntries: Map<string, DestinationCatalogEntry>,
  report: (message: string) => void,
): DestinationCatalogEntry[] {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));

  const places = candidates.map((candidate) => {
    const previous = previousEntries.get(candidate.id);
    if (previous === undefined) {
      report(`追加: ${candidate.id}`);
      return candidate;
    }
    return {
      ...candidate,
      includeInRouteForm: previous.includeInRouteForm,
    };
  });

  for (const previous of previousEntries.values()) {
    if (candidateIds.has(previous.id)) {
      continue;
    }
    report(
      previous.includeInRouteForm
        ? `掲載解除: ${previous.id}`
        : `削除: ${previous.id}`,
    );
  }

  return places;
}

/**
 * 公開グラフとOSMタグミラーから候補を抽出し、既存の掲載選択を引き継いだ
 * 目的地目録を返す。writer は全文を検証した後に一度だけ呼ぶ。
 */
export async function updateDestinationCatalog(
  options: UpdateDestinationsOptions,
): Promise<DestinationCatalog> {
  if (!isRecord(options)) {
    throw new Error("目録更新の設定が不正です");
  }
  if (typeof options.transport !== "function") {
    throw new Error("目録更新には取得関数が必要です");
  }
  if (typeof options.loadStops !== "function") {
    throw new Error("目録更新には停留所の読み込み関数が必要です");
  }
  if (typeof options.writeCatalog !== "function") {
    throw new Error("目録更新には書き込み関数が必要です");
  }
  if (typeof options.report !== "function") {
    throw new Error("目録更新には報告関数が必要です");
  }

  const source = readSourceUris(options.appConfig);

  const [placesPayload, osmPayload, stops, existingCatalog] = await Promise.all([
    fetchJson("公開グラフ", source.datasetJsonLdUri, options.transport),
    fetchJson("OSMタグミラー", source.osmMirrorUri, options.transport),
    options.loadStops(),
    options.readExistingCatalog(),
  ]);

  const previousEntries = readPreviousEntries(existingCatalog);
  const records = readPlaceRecords(placesPayload);
  const osmNames = readOsmNames(osmPayload);
  const walkGraph =
    typeof options.walkGraph === "function"
      ? options.walkGraph()
      : options.walkGraph;
  const candidates = selectCandidates(
    records,
    osmNames,
    stops,
    previousEntries,
    walkGraph,
  );
  const places = applySelection(candidates, previousEntries, options.report);
  const catalog: DestinationCatalog = { source, places };

  await options.writeCatalog(catalog);
  return catalog;
}

async function fetchFromNetwork(
  uri: string,
): Promise<DestinationCatalogTransportResponse> {
  const response = await fetch(uri);
  return {
    ok: response.ok,
    status: response.status,
    json: async () => response.json(),
  };
}

async function loadStopsFromDatabase(): Promise<StopPosition[]> {
  const { prisma } = await import("../src/lib/db/prisma");
  return prisma.stop.findMany({
    select: { id: true, name: true, lat: true, lon: true },
  });
}

async function writeCatalogAtomically(
  catalog: DestinationCatalog,
  catalogPath: string,
): Promise<void> {
  const catalogDirectory = dirname(catalogPath);
  let temporaryPath: string | null = null;

  try {
    await mkdir(catalogDirectory, { recursive: true });
    temporaryPath = resolve(
      catalogDirectory,
      `.destinations.json.${process.pid}.${randomUUID()}.tmp`,
    );
    await writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
    await rename(temporaryPath, catalogPath);
    temporaryPath = null;
  } finally {
    if (temporaryPath !== null) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

async function readExistingCatalogFile(
  catalogPath: string,
): Promise<unknown | null> {
  let raw: string;
  try {
    raw = await readFile(catalogPath, "utf8");
  } catch (error) {
    if (
      isRecord(error) &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
  return JSON.parse(raw) as unknown;
}

async function runCli(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const appConfigPath = resolve(
      projectRoot,
      appConfigFileName(resolveAppConfigEnvironment(process.env)),
    );
    const appConfig = JSON.parse(
      await readFile(appConfigPath, "utf8"),
    ) as unknown;
    const catalogPath = resolve(projectRoot, "data", "destinations.json");

    await updateDestinationCatalog({
      appConfig,
      transport: fetchFromNetwork,
      loadStops: loadStopsFromDatabase,
      walkGraph: () =>
        getWalkNetwork(resolve(projectRoot, "data", "walk-network.json")),
      readExistingCatalog: () => readExistingCatalogFile(catalogPath),
      writeCatalog: (catalog) => writeCatalogAtomically(catalog, catalogPath),
      report: (message) => {
        process.stderr.write(`${message}\n`);
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${detail}\n`);
    process.exitCode = 1;
  }
}

function isDirectCliInvocation(): boolean {
  const entrypoint = process.argv[1];
  return (
    typeof entrypoint === "string" &&
    basename(entrypoint) === "update-destinations.ts"
  );
}

if (isDirectCliInvocation()) {
  void runCli();
}
