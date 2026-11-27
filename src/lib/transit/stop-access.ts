import {
  getWalkNetwork,
  haversineKm,
  searchFromMany,
  snapToNetwork,
  type WalkGraph,
  type WalkSource,
} from "./walk-network";

/** 徒歩距離を測る対象の停留所。座標は`lon`で持つ。 */
export interface WalkAccessStop {
  id: string;
  lat: number;
  lon: number;
}

export interface WalkAccess {
  /** 最寄り停留所までの徒歩距離（メートル）。 */
  meters: number;
  /** その停留所のID。 */
  stopId: string;
}

/**
 * 停留所を種にした1回の多点探索。任意の地点から最寄り停留所までの徒歩距離を、
 * 地点ごとの探索なしで読める。距離の規則は`walkLeg`と同じにする。
 */
export class WalkAccessIndex {
  private readonly graph: WalkGraph;
  private readonly stops: WalkAccessStop[];
  private readonly snapNodes: number[];
  private readonly stopsByNode: Map<number, number[]>;
  private readonly distances: Float64Array;
  private readonly owners: Int32Array;

  constructor(stops: readonly WalkAccessStop[], graph: WalkGraph) {
    this.graph = graph;
    this.stops = [...stops];
    this.snapNodes = [];
    this.stopsByNode = new Map();
    const sources: WalkSource[] = [];

    this.stops.forEach((stop, index) => {
      let snap;
      try {
        snap = snapToNetwork(graph, { lat: stop.lat, lng: stop.lon });
      } catch {
        this.snapNodes.push(-1);
        return;
      }
      this.snapNodes.push(snap.node);
      const bucket = this.stopsByNode.get(snap.node);
      if (bucket === undefined) {
        this.stopsByNode.set(snap.node, [index]);
      } else {
        bucket.push(index);
      }
      sources.push({ node: snap.node, km: snap.km });
    });

    const search = searchFromMany(graph, sources);
    this.distances = search.distances;
    this.owners = search.owners;
  }

  /**
   * 停留所までの徒歩距離を返す。徒歩ネットワークへ接続できなければ`null`。
   * 同じノードに接続する停留所とは、接続区間を2回足さず2地点間の直線距離に
   * する。それ以外は接続区間とネットワーク上の距離の和になる。
   */
  measure(lat: number, lng: number): WalkAccess | null {
    let snap;
    try {
      snap = snapToNetwork(this.graph, { lat, lng });
    } catch {
      return null;
    }
    let bestMeters = Number.POSITIVE_INFINITY;
    let bestStopId: string | null = null;

    for (const index of this.stopsByNode.get(snap.node) ?? []) {
      const stop = this.stops[index];
      const meters = haversineKm({ lat, lng }, { lat: stop.lat, lng: stop.lon }) * 1000;
      if (meters < bestMeters) {
        bestMeters = meters;
        bestStopId = stop.id;
      }
    }

    const owner = this.owners[snap.node];
    const networkKm = this.distances[snap.node];
    if (owner >= 0 && Number.isFinite(networkKm) && this.snapNodes[owner] !== snap.node) {
      const meters = (snap.km + networkKm) * 1000;
      if (meters < bestMeters) {
        bestMeters = meters;
        bestStopId = this.stops[owner].id;
      }
    }

    return bestStopId === null ? null : { meters: bestMeters, stopId: bestStopId };
  }
}

let cached: {
  graph: WalkGraph;
  signature: string;
  index: WalkAccessIndex;
} | null = null;

function stopSignature(stops: readonly WalkAccessStop[]): string {
  const parts: string[] = [];
  for (const stop of stops) {
    parts.push(`${stop.id},${stop.lat},${stop.lon}`);
  }
  return parts.join(";");
}

/**
 * 停留所の距離場を作り直すには数ミリ秒かかる。同じ停留所と徒歩ネットワーク
 * なら1度だけ組み立て、地点検索の連続要求で作り直さない。
 */
export function getWalkAccessIndex(
  stops: readonly WalkAccessStop[],
  graph: WalkGraph = getWalkNetwork(),
): WalkAccessIndex {
  const signature = stopSignature(stops);
  if (cached !== null && cached.graph === graph && cached.signature === signature) {
    return cached.index;
  }
  const index = new WalkAccessIndex(stops, graph);
  cached = { graph, signature, index };
  return index;
}

/** テストでキャッシュを持ち越さないために使う。 */
export function resetWalkAccessCache(): void {
  cached = null;
}

/** 1つの地点から最寄り停留所までの徒歩距離を返す。接続できなければ`null`。 */
export function measureWalkAccess(
  stops: readonly WalkAccessStop[],
  lat: number,
  lng: number,
  graph: WalkGraph = getWalkNetwork(),
): WalkAccess | null {
  return getWalkAccessIndex(stops, graph).measure(lat, lng);
}
