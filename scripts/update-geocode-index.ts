import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  appConfigFileName,
  resolveAppConfigEnvironment,
} from "../src/lib/config/app-config-environment";
import {
  serializeGeocodeIndex,
  type GeocodeIndex,
} from "../src/lib/location/geocode-index";
import {
  buildGeocodeIndex,
  readArtifactNames,
  readTownBoundary,
} from "./lib/geocode-build";
import {
  readIsjBlocksFromZip,
  type IsjParseResult,
} from "./lib/isj-blocks";
import { extractOsmFeatures, type OSMNamedFeature } from "./lib/osm-extract";
import { readOsmPbf } from "./lib/osm-pbf";

export const ISJ_URI =
  "https://nlftp.mlit.go.jp/isj/dls/data/24.0a/13101-24.0a.zip";
export const OSM_URI =
  "https://osm.download.movisda.io/admin/JP-13-latest.osm.pbf";
export const LOCATION_ARTIFACT_PATH = "public/generated/location-data.json";
export const GEOCODE_INDEX_PATH = "data/geocode-index.json";
export const OSM_PBF_CACHE_PATH = "data/.cache/JP-13-latest.osm.pbf";
export const USER_AGENT =
  "KazagurumaTransit/1.0 (+https://github.com/nawashiro/kazaguruma-transit)";

export interface StopName {
  name: string;
  lat: number;
  lng: number;
}

export interface UpdateGeocodeIndexOptions {
  readIsj: () => Promise<IsjParseResult>;
  openOsm: () => Promise<AsyncIterable<unknown[]>>;
  readTownGeoJson: () => Promise<unknown>;
  readLocationArtifact: () => Promise<unknown>;
  loadStops: () => Promise<StopName[]>;
  writeIndex: (index: GeocodeIndex) => Promise<void>;
  now: () => Date;
  report: (message: string) => void;
}

export interface UpdateGeocodeIndexResult {
  index: GeocodeIndex;
  counts: {
    isjBlocks: number;
    boundary: number;
    artifact: number;
    stops: number;
    osm: number;
    names: number;
  };
}

export async function updateGeocodeIndex(
  options: UpdateGeocodeIndexOptions,
): Promise<UpdateGeocodeIndexResult> {
  options.report("位置参照情報を読み込んでいます");
  const isj = await options.readIsj();
  options.report(`街区 ${isj.blocks.length}件（版 ${isj.version ?? "不明"}）`);

  const [townGeoJson, locationArtifact, stops] = await Promise.all([
    options.readTownGeoJson(),
    options.readLocationArtifact(),
    options.loadStops(),
  ]);
  const boundary = readTownBoundary(townGeoJson);
  const artifactNames = readArtifactNames(locationArtifact);
  options.report(
    `町字 ${boundary.length}件、場所 ${artifactNames.length}件、停留所 ${stops.length}件`,
  );

  options.report("OSM抽出を読み込んでいます");
  const { features, stats } = await extractOsmFeatures(
    await options.openOsm(),
    boundary,
  );
  options.report(
    `OSM ${features.length}件（線形 ${stats.skippedLinear}件、町字外 ${stats.skippedOutside}件を除外）`,
  );

  const { index, counts } = buildGeocodeIndex({
    generatedAt: options.now().toISOString(),
    isjVersion: isj.version,
    blocks: isj.blocks,
    boundary,
    artifactNames,
    stops: stops.map((stop) => ({
      name: stop.name,
      lat: stop.lat,
      lng: stop.lng,
    })),
    osm: features,
  });
  options.report(`索引 ${counts.names}件の名前を作成しました`);

  await options.writeIndex(index);
  return {
    index,
    counts: {
      isjBlocks: isj.blocks.length,
      boundary: counts.boundary,
      artifact: counts.artifact,
      stops: counts.stops,
      osm: counts.osm,
      names: counts.names,
    },
  };
}

async function fetchBytes(uri: string): Promise<Buffer> {
  const response = await fetch(uri, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`取得に失敗しました: ${uri} (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * 133MBの抽出は毎回取得するには重い。索引の更新は明示的なコマンドなので、
 * 既定では同じ日の取得物を再利用し、日付が変わったときだけ取り直す。
 */
export async function ensureOsmPbf(
  targetPath: string,
  options: {
    now: () => Date;
    fetch: (uri: string) => Promise<Response>;
    report: (message: string) => void;
  } = {
    now: () => new Date(),
    fetch: (uri) => fetch(uri, { headers: { "User-Agent": USER_AGENT } }),
    report: (message) => process.stderr.write(`${message}\n`),
  },
): Promise<{ path: string; downloaded: boolean }> {
  const existing = await stat(targetPath).catch(() => null);
  if (existing !== null) {
    const ageMs = options.now().getTime() - existing.mtimeMs;
    if (ageMs < 24 * 60 * 60 * 1000) {
      options.report(`取得済みのOSM抽出を使います: ${targetPath}`);
      return { path: targetPath, downloaded: false };
    }
  }

  options.report(`OSM抽出を取得しています: ${OSM_URI}`);
  const response = await options.fetch(OSM_URI);
  if (!response.ok || response.body === null) {
    throw new Error(`OSM抽出の取得に失敗しました (${response.status})`);
  }
  await mkdir(dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
  try {
    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(temporaryPath),
    );
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
  return { path: targetPath, downloaded: true };
}

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function writeIndexAtomically(
  index: GeocodeIndex,
  indexPath: string,
): Promise<void> {
  const indexDirectory = dirname(indexPath);
  let temporaryPath: string | null = null;
  try {
    await mkdir(indexDirectory, { recursive: true });
    temporaryPath = resolve(
      indexDirectory,
      `.geocode-index.json.${process.pid}.${randomUUID()}.tmp`,
    );
    await writeFile(temporaryPath, serializeGeocodeIndex(index), "utf8");
    await rename(temporaryPath, indexPath);
    temporaryPath = null;
  } finally {
    if (temporaryPath !== null) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

async function loadStopsFromDatabase(): Promise<StopName[]> {
  const { prisma } = await import("../src/lib/db/prisma");
  const stops = await prisma.stop.findMany({
    select: { name: true, lat: true, lon: true },
    orderBy: { id: "asc" },
  });
  return stops.map((stop) => ({
    name: stop.name,
    lat: stop.lat,
    lng: stop.lon,
  }));
}

async function runCli(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const appConfigPath = resolve(
      projectRoot,
      appConfigFileName(resolveAppConfigEnvironment(process.env)),
    );
    const appConfig = (await readJsonFile(appConfigPath)) as {
      townGeoJsonUri?: unknown;
    };
    if (typeof appConfig.townGeoJsonUri !== "string") {
      throw new Error("公開アプリ設定に townGeoJsonUri がありません");
    }
    const townGeoJsonUri = appConfig.townGeoJsonUri;

    const report = (message: string) => process.stderr.write(`${message}\n`);
    const override = process.env.GEOCODE_OSM_PBF;
    const osmPath =
      override !== undefined && override.length > 0
        ? resolve(projectRoot, override)
        : (await ensureOsmPbf(resolve(projectRoot, OSM_PBF_CACHE_PATH), {
            now: () => new Date(),
            fetch: (uri) =>
              fetch(uri, { headers: { "User-Agent": USER_AGENT } }),
            report,
          })).path;

    const result = await updateGeocodeIndex({
      readIsj: async () => readIsjBlocksFromZip(await fetchBytes(ISJ_URI)),
      openOsm: () => readOsmPbf(osmPath),
      readTownGeoJson: async () => {
        const response = await fetch(townGeoJsonUri, {
          headers: { "User-Agent": USER_AGENT },
        });
        if (!response.ok) {
          throw new Error(
            `町字GeoJSONの取得に失敗しました (${response.status})`,
          );
        }
        return response.json() as Promise<unknown>;
      },
      readLocationArtifact: () =>
        readJsonFile(resolve(projectRoot, LOCATION_ARTIFACT_PATH)),
      loadStops: loadStopsFromDatabase,
      writeIndex: (index) =>
        writeIndexAtomically(index, resolve(projectRoot, GEOCODE_INDEX_PATH)),
      now: () => new Date(),
      report,
    });

    report(
      `索引を書き出しました: ${GEOCODE_INDEX_PATH}（街区 ${result.counts.isjBlocks}件、名前 ${result.counts.names}件）`,
    );
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
    basename(entrypoint) === "update-geocode-index.ts"
  );
}

if (isDirectCliInvocation()) {
  void runCli();
}
