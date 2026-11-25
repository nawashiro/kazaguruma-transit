import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 徒歩ネットワークのartifactは、OSMのノードIDを鍵にして書く。内部の通し番号を
 * 使うと、ノードが1つ増えただけで以降の番号がずれ、全行が差分になる。
 *
 * エッジの長さは保存しない。両端の座標からハバーサインで求めるため、
 * 座標と長さが食い違う余地を残さない。
 */
export const WALK_NETWORK_VERSION = 1;

export const WALK_NETWORK_PATH = join("data", "walk-network.json");

/** `[OSMノードID, 緯度×10^6, 経度×10^6]`。 */
export type WalkNetworkNodeRow = [number, number, number];

/** 両端のOSMノードIDの組。`a`は`b`より小さい。 */
export type WalkNetworkEdgeRow = [number, number];

export interface WalkNetworkArtifact {
  version: number;
  nodes: WalkNetworkNodeRow[];
  edges: WalkNetworkEdgeRow[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** GeoJSONと同じく [経度, 緯度] の順で持つ。 */
export type LngLat = [number, number];

export interface WalkSnap {
  /** 最寄りノードの内部番号。 */
  node: number;
  /** 点から最寄りノードまでの直線距離（キロメートル）。 */
  km: number;
}

export interface WalkGraph {
  readonly latitude: Float64Array;
  readonly longitude: Float64Array;
  readonly offsets: Int32Array;
  readonly targets: Int32Array;
  readonly weights: Float64Array;
  readonly indexOfId: Map<number, number>;
  readonly cells: Map<string, number[]>;
}

export interface WalkRoute {
  distanceKm: number;
  /** 起点、通過したノード、終点の順。 */
  path: LngLat[];
}

const EARTH_RADIUS_KM = 6371;
const SNAP_CELL_DEGREES = 0.001;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** 2点間の直線距離をハバーサインでキロメートル単位で返す。 */
export function haversineKm(first: LatLng, second: LatLng): number {
  const latitudeDifference = toRadians(second.lat - first.lat);
  const longitudeDifference = toRadians(second.lng - first.lng);
  const haversineValue =
    Math.sin(latitudeDifference / 2) * Math.sin(latitudeDifference / 2) +
    Math.cos(toRadians(first.lat)) *
      Math.cos(toRadians(second.lat)) *
      Math.sin(longitudeDifference / 2) *
      Math.sin(longitudeDifference / 2);
  return (
    EARTH_RADIUS_KM *
    2 *
    Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fail(message: string): never {
  throw new Error(`徒歩ネットワークの形式が不正です: ${message}`);
}

function isCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readNodeRow(value: unknown, index: number): WalkNetworkNodeRow {
  if (!Array.isArray(value) || value.length !== 3) {
    fail(`nodes[${index}] は [OSMノードID, 緯度, 経度] である必要があります`);
  }
  const [id, latitude, longitude] = value;
  if (!isCoordinate(id) || !Number.isInteger(id) || id <= 0) {
    fail(`nodes[${index}][0] は正の整数のOSMノードIDである必要があります`);
  }
  if (!isCoordinate(latitude) || !Number.isInteger(latitude)) {
    fail(`nodes[${index}][1] は緯度×10^6の整数である必要があります`);
  }
  if (!isCoordinate(longitude) || !Number.isInteger(longitude)) {
    fail(`nodes[${index}][2] は経度×10^6の整数である必要があります`);
  }
  return [id, latitude, longitude];
}

function readEdgeRow(
  value: unknown,
  index: number,
  known: Set<number>,
): WalkNetworkEdgeRow {
  if (!Array.isArray(value) || value.length !== 2) {
    fail(`edges[${index}] は [a, b] である必要があります`);
  }
  const [a, b] = value;
  if (!isCoordinate(a) || !isCoordinate(b)) {
    fail(`edges[${index}] の両端は数値のOSMノードIDである必要があります`);
  }
  if (!known.has(a) || !known.has(b)) {
    fail(`edges[${index}] の端点が nodes にありません`);
  }
  if (a === b) {
    fail(`edges[${index}] の両端が同じノードです`);
  }
  return [Math.min(a, b), Math.max(a, b)];
}

export function parseWalkNetwork(value: unknown): WalkNetworkArtifact {
  if (!isRecord(value)) {
    fail("最上位はオブジェクトである必要があります");
  }
  if (value.version !== WALK_NETWORK_VERSION) {
    fail(`version は ${WALK_NETWORK_VERSION} である必要があります`);
  }
  if (!Array.isArray(value.nodes)) {
    fail("nodes は配列である必要があります");
  }
  if (!Array.isArray(value.edges)) {
    fail("edges は配列である必要があります");
  }
  if (value.nodes.length === 0) {
    fail("nodes が空です");
  }
  const nodes = value.nodes.map((row, index) => readNodeRow(row, index));
  const ids = new Set<number>();
  for (const [id] of nodes) {
    if (ids.has(id)) {
      fail(`nodes に同じIDが2回現れます: ${id}`);
    }
    ids.add(id);
  }
  const edges = value.edges.map((row, index) => readEdgeRow(row, index, ids));
  return { version: WALK_NETWORK_VERSION, nodes, edges };
}

/**
 * 1要素を1行に書き、IDの昇順に並べる。1行のJSONでは差分が全体の置換になり、
 * どの道が変わったかをレビューできない。
 */
export function serializeWalkNetwork(artifact: WalkNetworkArtifact): string {
  const nodes = [...artifact.nodes].sort((first, second) => first[0] - second[0]);
  const edges = [...artifact.edges]
    .map(([a, b]): WalkNetworkEdgeRow => [Math.min(a, b), Math.max(a, b)])
    .sort((first, second) => first[0] - second[0] || first[1] - second[1]);
  const nodeLines = nodes.map((row) => `    ${JSON.stringify(row)}`);
  const edgeLines = edges.map((row) => `    ${JSON.stringify(row)}`);
  return [
    "{",
    `  "version": ${WALK_NETWORK_VERSION},`,
    '  "nodes": [',
    nodeLines.join(",\n"),
    "  ],",
    '  "edges": [',
    edgeLines.join(",\n"),
    "  ]",
    "}",
    "",
  ].join("\n");
}

function toCoordinate(micro: number): number {
  return micro / 1e6;
}

function cellKey(latitude: number, longitude: number): string {
  return `${Math.floor(latitude / SNAP_CELL_DEGREES)}:${Math.floor(
    longitude / SNAP_CELL_DEGREES,
  )}`;
}

/**
 * artifactから、探索用の隣接リスト（CSR）と、最寄りノードを引くための
 * セル索引を組み立てる。ノード25,000件で60ミリ秒ほどかかるため、
 * プロセス内で1度だけ行う。
 */
export function buildWalkGraph(artifact: WalkNetworkArtifact): WalkGraph {
  const nodeCount = artifact.nodes.length;
  const latitude = new Float64Array(nodeCount);
  const longitude = new Float64Array(nodeCount);
  const indexOfId = new Map<number, number>();
  const cells = new Map<string, number[]>();

  artifact.nodes.forEach(([id, latMicro, lngMicro], index) => {
    const lat = toCoordinate(latMicro);
    const lng = toCoordinate(lngMicro);
    latitude[index] = lat;
    longitude[index] = lng;
    indexOfId.set(id, index);
    const key = cellKey(lat, lng);
    const bucket = cells.get(key);
    if (bucket === undefined) {
      cells.set(key, [index]);
    } else {
      bucket.push(index);
    }
  });

  const offsets = new Int32Array(nodeCount + 1);
  for (const [a, b] of artifact.edges) {
    offsets[(indexOfId.get(a) as number) + 1] += 1;
    offsets[(indexOfId.get(b) as number) + 1] += 1;
  }
  for (let index = 0; index < nodeCount; index += 1) {
    offsets[index + 1] += offsets[index];
  }

  const targets = new Int32Array(offsets[nodeCount]);
  const weights = new Float64Array(offsets[nodeCount]);
  const cursor = offsets.slice(0, nodeCount);
  for (const [a, b] of artifact.edges) {
    const first = indexOfId.get(a) as number;
    const second = indexOfId.get(b) as number;
    const distance = haversineKm(
      { lat: latitude[first], lng: longitude[first] },
      { lat: latitude[second], lng: longitude[second] },
    );
    targets[cursor[first]] = second;
    weights[cursor[first]] = distance;
    cursor[first] += 1;
    targets[cursor[second]] = first;
    weights[cursor[second]] = distance;
    cursor[second] += 1;
  }

  return { latitude, longitude, offsets, targets, weights, indexOfId, cells };
}

function nodePosition(graph: WalkGraph, node: number): LatLng {
  return { lat: graph.latitude[node], lng: graph.longitude[node] };
}

/**
 * 点から最寄りノードを探す。セルの周囲を1つずつ広げ、見つかった距離より
 * 遠いセルに到達した時点で打ち切る。
 */
export function snapToNetwork(graph: WalkGraph, point: LatLng): WalkSnap {
  const row = Math.floor(point.lat / SNAP_CELL_DEGREES);
  const column = Math.floor(point.lng / SNAP_CELL_DEGREES);
  const maxRing = 32;
  let bestNode = -1;
  let bestKm = Number.POSITIVE_INFINITY;
  for (let ring = 0; ring <= maxRing; ring += 1) {
    for (let rowOffset = -ring; rowOffset <= ring; rowOffset += 1) {
      for (let columnOffset = -ring; columnOffset <= ring; columnOffset += 1) {
        if (Math.max(Math.abs(rowOffset), Math.abs(columnOffset)) !== ring) {
          continue;
        }
        const bucket = graph.cells.get(
          `${row + rowOffset}:${column + columnOffset}`,
        );
        if (bucket === undefined) {
          continue;
        }
        for (const node of bucket) {
          const distance = haversineKm(point, nodePosition(graph, node));
          if (distance < bestKm) {
            bestKm = distance;
            bestNode = node;
          }
        }
      }
    }
    // 残りのセルは最低でも ring * SNAP_CELL_DEGREES 度ぶん離れている。
    if (bestNode >= 0 && bestKm <= ring * SNAP_CELL_DEGREES * 111) {
      break;
    }
  }
  if (bestNode < 0) {
    throw new Error("徒歩ネットワークに最寄りのノードがありません");
  }
  return { node: bestNode, km: bestKm };
}

interface Heap {
  distances: number[];
  nodes: number[];
}

function heapPush(heap: Heap, distance: number, node: number): void {
  heap.distances.push(distance);
  heap.nodes.push(node);
  let index = heap.distances.length - 1;
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (heap.distances[parent] <= heap.distances[index]) {
      break;
    }
    swap(heap, parent, index);
    index = parent;
  }
}

function swap(heap: Heap, first: number, second: number): void {
  const distance = heap.distances[first];
  heap.distances[first] = heap.distances[second];
  heap.distances[second] = distance;
  const node = heap.nodes[first];
  heap.nodes[first] = heap.nodes[second];
  heap.nodes[second] = node;
}

function heapPop(heap: Heap): [number, number] {
  const distance = heap.distances[0];
  const node = heap.nodes[0];
  const lastDistance = heap.distances.pop() as number;
  const lastNode = heap.nodes.pop() as number;
  if (heap.distances.length > 0) {
    heap.distances[0] = lastDistance;
    heap.nodes[0] = lastNode;
    let index = 0;
    for (;;) {
      const left = 2 * index + 1;
      const right = left + 1;
      let smallest = index;
      if (
        left < heap.distances.length &&
        heap.distances[left] < heap.distances[smallest]
      ) {
        smallest = left;
      }
      if (
        right < heap.distances.length &&
        heap.distances[right] < heap.distances[smallest]
      ) {
        smallest = right;
      }
      if (smallest === index) {
        break;
      }
      swap(heap, smallest, index);
      index = smallest;
    }
  }
  return [distance, node];
}

export interface WalkSearchOptions {
  /** この距離を超える経路を打ち切る。省略時は無制限。 */
  limitKm?: number;
  /** 経路を復元するために直前のノードを記録する。 */
  trackPrevious?: boolean;
}

export interface WalkSearchResult {
  distances: Float64Array;
  previous: Int32Array | null;
}

/**
 * 1つのノードから全ノードへの最短距離を求める。停留所79件の距離は
 * この1回の結果から読めるため、停留所ごとに探索しない。
 */
export function searchFrom(
  graph: WalkGraph,
  source: number,
  options: WalkSearchOptions = {},
): WalkSearchResult {
  const nodeCount = graph.latitude.length;
  const limitKm = options.limitKm ?? Number.POSITIVE_INFINITY;
  const distances = new Float64Array(nodeCount).fill(Number.POSITIVE_INFINITY);
  const previous = options.trackPrevious ? new Int32Array(nodeCount).fill(-1) : null;
  const settled = new Uint8Array(nodeCount);
  const heap: Heap = { distances: [], nodes: [] };
  distances[source] = 0;
  heapPush(heap, 0, source);

  while (heap.distances.length > 0) {
    const [distance, node] = heapPop(heap);
    if (settled[node] === 1) {
      continue;
    }
    settled[node] = 1;
    if (distance >= limitKm) {
      continue;
    }
    for (let edge = graph.offsets[node]; edge < graph.offsets[node + 1]; edge += 1) {
      const target = graph.targets[edge];
      const next = distance + graph.weights[edge];
      if (next <= limitKm && next < distances[target] - 1e-12) {
        distances[target] = next;
        if (previous !== null) {
          previous[target] = node;
        }
        heapPush(heap, next, target);
      }
    }
  }

  return { distances, previous };
}

/**
 * 2地点間の徒歩経路を返す。距離は起点から最寄りノードまでの接続区間、
 * ネットワーク上の最短距離、到着点の最寄りノードから到着点までの接続区間の和。
 * 到達できないときは`null`を返す。
 */
export function walkRoute(
  graph: WalkGraph,
  from: LatLng,
  to: LatLng,
  options: { path?: boolean } = {},
): WalkRoute | null {
  const prepared = prepareWalkSearch(graph, from);
  return walkLeg(graph, prepared, to, options);
}

/** 起点のスナップと探索結果を、複数の到着点で使い回すためにまとめたもの。 */
export interface PreparedWalk {
  from: LatLng;
  snap: WalkSnap;
  search: WalkSearchResult;
}

/**
 * 起点から1回だけ探索し、複数の到着点までの距離を読めるようにする。
 * 停留所79件の距離を求めるのに、停留所ごとの探索をしないため。
 */
export function prepareWalkSearch(graph: WalkGraph, from: LatLng): PreparedWalk {
  const snap = snapToNetwork(graph, from);
  return {
    from,
    snap,
    search: searchFrom(graph, snap.node, { trackPrevious: true }),
  };
}

/**
 * 準備済みの探索から、到着点までの徒歩距離と折れ線を返す。折れ線は起点、
 * 通過したノード、到着点の順に並べる。
 */
export function walkLeg(
  graph: WalkGraph,
  prepared: PreparedWalk,
  to: LatLng,
  options: { path?: boolean } = {},
): WalkRoute | null {
  const toSnap = snapToNetwork(graph, to);
  const networkKm = prepared.search.distances[toSnap.node];
  if (!Number.isFinite(networkKm)) {
    return null;
  }
  const distanceKm = prepared.snap.km + networkKm + toSnap.km;
  const withPath = options.path ?? true;
  if (!withPath) {
    return { distanceKm, path: [] };
  }
  const previous = prepared.search.previous;
  const path: LngLat[] = [[prepared.from.lng, prepared.from.lat]];
  if (previous !== null) {
    let cursor = toSnap.node;
    const chain: number[] = [];
    while (cursor !== -1) {
      chain.push(cursor);
      if (cursor === prepared.snap.node) {
        break;
      }
      cursor = previous[cursor];
    }
    for (const node of chain.reverse()) {
      path.push([graph.longitude[node], graph.latitude[node]]);
    }
  }
  path.push([to.lng, to.lat]);
  return { distanceKm, path };
}

/** 徒歩距離だけを返す。到達できないときは`Infinity`。 */
export function walkDistanceKm(graph: WalkGraph, from: LatLng, to: LatLng): number {
  const route = walkRoute(graph, from, to, { path: false });
  return route === null ? Number.POSITIVE_INFINITY : route.distanceKm;
}

export type WalkNetworkLoadResult =
  | { status: "success"; network: WalkGraph }
  | { status: "error"; error: Error };

export function loadWalkNetwork(
  path: string,
  readText: (target: string) => string = (target) =>
    readFileSync(target, "utf8"),
): WalkNetworkLoadResult {
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
    return {
      status: "success",
      network: buildWalkGraph(parseWalkNetwork(JSON.parse(raw))),
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

let cachedNetwork: WalkGraph | null = null;

/**
 * プロセス内で1度だけartifactを読む。読めないときは例外を投げる。
 * 直線距離による判定へは切り替えない。切り替えると、artifactの更新漏れが
 * 精度の低い答えとして静かに現れ、気づけなくなるため。
 */
export function getWalkNetwork(
  path: string = join(process.cwd(), WALK_NETWORK_PATH),
): WalkGraph {
  if (cachedNetwork !== null) {
    return cachedNetwork;
  }
  const loaded = loadWalkNetwork(path);
  if (loaded.status !== "success") {
    throw new Error(`徒歩ネットワークを読み込めません: ${loaded.error.message}`);
  }
  cachedNetwork = loaded.network;
  return cachedNetwork;
}

/** テストでcacheを持ち越さないために使う。 */
export function resetWalkNetworkCache(): void {
  cachedNetwork = null;
}
