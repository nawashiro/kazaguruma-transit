import { isInsideBoundary, type TownBoundary } from "./osm-extract";

/** 停留所の周囲で、町字ポリゴンの外側まで道を残す距離。 */
export const WALK_STOP_MARGIN_KM = 0.3;

/**
 * 徒歩ネットワークに含める`highway`。`foot=no`などの通行禁止と、
 * `area=yes`の面は別に除外する。
 */
export const WALK_HIGHWAYS: readonly string[] = [
  "footway",
  "pedestrian",
  "path",
  "steps",
  "living_street",
  "residential",
  "service",
  "unclassified",
  "tertiary",
  "secondary",
  "primary",
  "track",
  "corridor",
  "crossing",
];

const WALK_HIGHWAY_SET = new Set(WALK_HIGHWAYS);

export interface WalkNode {
  id: number;
  lat: number;
  lng: number;
}

/** 両端のOSMノードIDの組。`a`は`b`より小さい。 */
export interface WalkEdge {
  a: number;
  b: number;
}

export interface WalkExtractStats {
  scannedNodes: number;
  nodesInExtent: number;
  acceptedWays: number;
  edgesBeforeComponent: number;
  components: number;
  largestComponentNodes: number;
}

export interface WalkExtractResult {
  nodes: WalkNode[];
  edges: WalkEdge[];
  stats: WalkExtractStats;
}

interface Position {
  lat: number;
  lng: number;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function distanceKm(first: Position, second: Position): number {
  const EARTH_RADIUS_KM = 6371;
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

export function isWalkableHighway(
  tags: Record<string, string> | undefined,
): boolean {
  if (tags === undefined) {
    return false;
  }
  if (!WALK_HIGHWAY_SET.has(tags.highway ?? "")) {
    return false;
  }
  return !(
    tags.foot === "no" ||
    tags.access === "no" ||
    tags.access === "private" ||
    tags.construction !== undefined ||
    tags.area === "yes"
  );
}

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

function boundsOf(boundary: TownBoundary[], stops: readonly Position[]): Bounds {
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  for (const feature of boundary) {
    for (const polygon of feature.polygons) {
      for (const ring of polygon) {
        for (const [lng, lat] of ring) {
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        }
      }
    }
  }
  for (const stop of stops) {
    minLat = Math.min(minLat, stop.lat);
    maxLat = Math.max(maxLat, stop.lat);
    minLng = Math.min(minLng, stop.lng);
    maxLng = Math.max(maxLng, stop.lng);
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) {
    throw new Error("町字ポリゴンから範囲を求められません");
  }
  // 停留所の余白より広く取り、走査で落とさない。
  const margin = WALK_STOP_MARGIN_KM / 111 + 0.001;
  return {
    minLat: minLat - margin,
    maxLat: maxLat + margin,
    minLng: minLng - margin,
    maxLng: maxLng + margin,
  };
}

interface BoundedPolygon {
  feature: TownBoundary;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * 町字ポリゴンの内外判定を、ポリゴンの外接矩形で先に絞る。
 * 区の内側の判定を数十万点に対して行うため、全ポリゴンを毎回走査しない。
 */
function createBoundaryLocator(boundary: TownBoundary[]) {
  const polygons: BoundedPolygon[] = [];
  for (const feature of boundary) {
    for (const polygon of feature.polygons) {
      let minLat = Number.POSITIVE_INFINITY;
      let maxLat = Number.NEGATIVE_INFINITY;
      let minLng = Number.POSITIVE_INFINITY;
      let maxLng = Number.NEGATIVE_INFINITY;
      for (const ring of polygon) {
        for (const [lng, lat] of ring) {
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        }
      }
      polygons.push({ feature, minLat, maxLat, minLng, maxLng });
    }
  }
  return (lat: number, lng: number): boolean =>
    polygons.some(
      (bounds) =>
        lat >= bounds.minLat &&
        lat <= bounds.maxLat &&
        lng >= bounds.minLng &&
        lng <= bounds.maxLng &&
        isInsideBoundary(lat, lng, [bounds.feature]),
    );
}

const STOP_CELL_DEGREES = 0.01;

function createStopIndex(stops: readonly Position[]) {
  const cells = new Map<string, Position[]>();
  for (const stop of stops) {
    const key = `${Math.floor(stop.lat / STOP_CELL_DEGREES)}:${Math.floor(
      stop.lng / STOP_CELL_DEGREES,
    )}`;
    const bucket = cells.get(key);
    if (bucket === undefined) {
      cells.set(key, [stop]);
    } else {
      bucket.push(stop);
    }
  }
  return (position: Position): boolean => {
    const row = Math.floor(position.lat / STOP_CELL_DEGREES);
    const column = Math.floor(position.lng / STOP_CELL_DEGREES);
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const bucket = cells.get(`${row + rowOffset}:${column + columnOffset}`);
        if (bucket === undefined) {
          continue;
        }
        for (const stop of bucket) {
          if (distanceKm(stop, position) <= WALK_STOP_MARGIN_KM) {
            return true;
          }
        }
      }
    }
    return false;
  };
}

interface RawItem {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  refs?: unknown;
  tags?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toItems(chunk: unknown): RawItem[] {
  if (!Array.isArray(chunk)) {
    return [];
  }
  return chunk.filter((item): item is RawItem => isRecord(item));
}

function toTags(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const tags: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      tags[key] = entry;
    }
  }
  return tags;
}

function toRefs(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }
  const refs: number[] = [];
  for (const ref of value) {
    if (typeof ref !== "number" || !Number.isFinite(ref)) {
      return null;
    }
    refs.push(ref);
  }
  return refs;
}

/**
 * PBFの全要素を走査し、町字ポリゴンの内側または停留所から300メートル以内に
 * ある歩行可能な道から、最大の連結成分だけを残す。ノードとエッジはIDの
 * 昇順に並べるため、同じ入力からは同じ並びの結果が得られる。
 */
export async function extractWalkNetwork(
  stream: AsyncIterable<unknown[]>,
  boundary: TownBoundary[],
  stops: readonly Position[],
): Promise<WalkExtractResult> {
  const bounds = boundsOf(boundary, stops);
  const coordinates = new Map<number, Position>();
  const ways: number[][] = [];
  let scannedNodes = 0;

  for await (const chunk of stream) {
    for (const item of toItems(chunk)) {
      if (item.type === "node") {
        if (
          typeof item.id !== "number" ||
          typeof item.lat !== "number" ||
          typeof item.lon !== "number"
        ) {
          continue;
        }
        if (
          item.lat < bounds.minLat ||
          item.lat > bounds.maxLat ||
          item.lon < bounds.minLng ||
          item.lon > bounds.maxLng
        ) {
          continue;
        }
        scannedNodes += 1;
        coordinates.set(item.id, { lat: item.lat, lng: item.lon });
        continue;
      }
      if (item.type !== "way" || typeof item.id !== "number") {
        continue;
      }
      if (!isWalkableHighway(toTags(item.tags))) {
        continue;
      }
      const refs = toRefs(item.refs);
      if (refs === null) {
        continue;
      }
      ways.push(refs);
    }
  }

  const isInsideTown = createBoundaryLocator(boundary);
  const isNearStop = createStopIndex(stops);
  const inExtent = new Set<number>();
  for (const [id, position] of coordinates) {
    if (isInsideTown(position.lat, position.lng) || isNearStop(position)) {
      inExtent.add(id);
    }
  }

  const edgeKeys = new Set<string>();
  const edges: WalkEdge[] = [];
  const used = new Set<number>();
  for (const refs of ways) {
    let previous: number | null = null;
    for (const ref of refs) {
      if (!inExtent.has(ref)) {
        previous = null;
        continue;
      }
      if (previous !== null && previous !== ref) {
        const a = Math.min(previous, ref);
        const b = Math.max(previous, ref);
        const key = `${a}:${b}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ a, b });
          used.add(a);
          used.add(b);
        }
      }
      previous = ref;
    }
  }

  const neighbours = new Map<number, number[]>();
  for (const edge of edges) {
    const fromA = neighbours.get(edge.a);
    if (fromA === undefined) {
      neighbours.set(edge.a, [edge.b]);
    } else {
      fromA.push(edge.b);
    }
    const fromB = neighbours.get(edge.b);
    if (fromB === undefined) {
      neighbours.set(edge.b, [edge.a]);
    } else {
      fromB.push(edge.a);
    }
  }

  const component = new Map<number, number>();
  const sizes: number[] = [];
  for (const start of [...used].sort((first, second) => first - second)) {
    if (component.has(start)) {
      continue;
    }
    const label = sizes.length;
    let size = 0;
    const stack = [start];
    component.set(start, label);
    while (stack.length > 0) {
      const current = stack.pop() as number;
      size += 1;
      for (const next of neighbours.get(current) ?? []) {
        if (!component.has(next)) {
          component.set(next, label);
          stack.push(next);
        }
      }
    }
    sizes.push(size);
  }

  const largest = sizes.length === 0 ? -1 : sizes.indexOf(Math.max(...sizes));
  const isMain = (id: number) => component.get(id) === largest;

  const keptEdges = edges
    .filter((edge) => isMain(edge.a) && isMain(edge.b))
    .sort((first, second) => first.a - second.a || first.b - second.b);
  const keptNodes: WalkNode[] = [];
  for (const id of [...used].sort((first, second) => first - second)) {
    if (!isMain(id)) {
      continue;
    }
    const position = coordinates.get(id) as Position;
    keptNodes.push({ id, lat: position.lat, lng: position.lng });
  }

  return {
    nodes: keptNodes,
    edges: keptEdges,
    stats: {
      scannedNodes,
      nodesInExtent: inExtent.size,
      acceptedWays: ways.length,
      edgesBeforeComponent: edges.length,
      components: sizes.length,
      largestComponentNodes: keptNodes.length,
    },
  };
}
