import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import {
  buildWalkNetworkArtifact,
  writeWalkNetworkIfChanged,
} from "./lib/walk-network-build";
import {
  extractWalkNetwork,
  type WalkExtractStats,
} from "./lib/osm-walk-extract";
import type { TownBoundary } from "./lib/osm-extract";
import { readOsmPbf } from "./lib/osm-pbf";
import { WALK_NETWORK_PATH } from "../src/lib/transit/walk-network";
import {
  ensureOsmPbf,
  GEOCODE_INDEX_PATH,
  OSM_PBF_CACHE_PATH,
  USER_AGENT,
} from "./update-geocode-index";

export interface WalkStop {
  name: string;
  lat: number;
  lng: number;
}

export interface UpdateWalkNetworkOptions {
  openOsm: () => Promise<AsyncIterable<unknown[]>>;
  readBoundary: () => Promise<TownBoundary[]>;
  loadStops: () => Promise<WalkStop[]>;
  readExisting: () => Promise<string | null>;
  write: (contents: string) => Promise<void>;
  report: (message: string) => void;
}

export interface UpdateWalkNetworkResult {
  written: boolean;
  counts: {
    nodes: number;
    edges: number;
    stops: number;
  };
  stats: WalkExtractStats;
}

export async function updateWalkNetwork(
  options: UpdateWalkNetworkOptions,
): Promise<UpdateWalkNetworkResult> {
  const boundary = await options.readBoundary();
  const stops = await options.loadStops();
  options.report(`町字 ${boundary.length}件、停留所 ${stops.length}件`);

  options.report("OSM抽出から歩行ネットワークを組み立てています");
  const extracted = await extractWalkNetwork(
    await options.openOsm(),
    boundary,
    stops.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
  );
  options.report(
    `徒歩ネットワーク ${extracted.nodes.length}ノード、${extracted.edges.length}エッジ（連結成分 ${extracted.stats.components}件、最大 ${extracted.stats.largestComponentNodes}ノード）`,
  );

  const artifact = buildWalkNetworkArtifact(extracted);
  const written = await writeWalkNetworkIfChanged({
    artifact,
    readExisting: options.readExisting,
    write: options.write,
    report: options.report,
  });

  return {
    written,
    counts: {
      nodes: artifact.nodes.length,
      edges: artifact.edges.length,
      stops: stops.length,
    },
    stats: extracted.stats,
  };
}

/**
 * 徒歩ネットワークは地点索引と同じ町字ポリゴンを使う。索引のboundaryは
 * 更新済みの町字GeoJSONから作られており、公開アプリ設定から取り直す
 * 必要がない。
 */
export async function readBoundaryFromGeocodeIndex(
  indexPath: string,
): Promise<TownBoundary[]> {
  const raw = await readFile(indexPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { boundary?: unknown }).boundary)
  ) {
    throw new Error("地点索引に boundary がありません");
  }
  return (parsed as { boundary: TownBoundary[] }).boundary;
}

async function readExistingText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

async function writeAtomically(path: string, contents: string): Promise<void> {
  const directory = dirname(path);
  let temporaryPath: string | null = null;
  try {
    await mkdir(directory, { recursive: true });
    temporaryPath = resolve(
      directory,
      `.walk-network.json.${process.pid}.${randomUUID()}.tmp`,
    );
    await writeFile(temporaryPath, contents, "utf8");
    await rename(temporaryPath, path);
    temporaryPath = null;
  } finally {
    if (temporaryPath !== null) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

async function loadStopsFromDatabase(): Promise<WalkStop[]> {
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
    const report = (message: string) => process.stderr.write(`${message}\n`);
    const override = process.env.GEOCODE_OSM_PBF;
    const osmPath =
      override !== undefined && override.length > 0
        ? resolve(projectRoot, override)
        : (
            await ensureOsmPbf(resolve(projectRoot, OSM_PBF_CACHE_PATH), {
              now: () => new Date(),
              fetch: (uri) => fetch(uri, { headers: { "User-Agent": USER_AGENT } }),
              report,
            })
          ).path;

    const result = await updateWalkNetwork({
      openOsm: () => readOsmPbf(osmPath),
      readBoundary: () =>
        readBoundaryFromGeocodeIndex(resolve(projectRoot, GEOCODE_INDEX_PATH)),
      loadStops: loadStopsFromDatabase,
      readExisting: () =>
        readExistingText(resolve(projectRoot, WALK_NETWORK_PATH)),
      write: (contents) =>
        writeAtomically(resolve(projectRoot, WALK_NETWORK_PATH), contents),
      report,
    });

    report(
      `徒歩ネットワーク ${result.counts.nodes}ノード、${result.counts.edges}エッジ（停留所 ${result.counts.stops}件）`,
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
    basename(entrypoint) === "update-walk-network.ts"
  );
}

if (isDirectCliInvocation()) {
  void runCli();
}
