import {
  buildWalkGraph,
  type WalkGraph,
  type WalkNetworkArtifact,
} from "../walk-network";

const KM_PER_LAT_DEGREE = 111.195;
const KM_PER_LNG_DEGREE = 111.195 * Math.cos((35.69 * Math.PI) / 180);

/**
 * 試験用に、中心から10メートル間隔の格子状の道を作る。実際のOSM抽出に
 * 依存せず、徒歩距離が格子の歩行距離になることを固定できる。
 */
export function createGridWalkGraph(
  center: { lat: number; lng: number } = { lat: 35.69, lng: 139.75 },
  radiusKm = 1.5,
  stepKm = 0.01,
): WalkGraph {
  const steps = Math.round(radiusKm / stepKm);
  const nodes: Array<[number, number, number]> = [];
  const edges: Array<[number, number]> = [];
  const idOf = (row: number, column: number) => (row + steps) * (steps * 2 + 1) + column + steps + 1;

  for (let row = -steps; row <= steps; row += 1) {
    for (let column = -steps; column <= steps; column += 1) {
      const lat = Math.round((center.lat + (row * stepKm) / KM_PER_LAT_DEGREE) * 1e6);
      const lng = Math.round((center.lng + (column * stepKm) / KM_PER_LNG_DEGREE) * 1e6);
      nodes.push([idOf(row, column), lat, lng]);
    }
  }
  for (let row = -steps; row <= steps; row += 1) {
    for (let column = -steps; column <= steps; column += 1) {
      const id = idOf(row, column);
      if (column < steps) {
        edges.push([id, idOf(row, column + 1)]);
      }
      if (row < steps) {
        edges.push([id, idOf(row + 1, column)]);
      }
    }
  }
  const artifact: WalkNetworkArtifact = { version: 1, nodes, edges };
  return buildWalkGraph(artifact);
}

/** 中心から北へ`northKm`、東へ`eastKm`だけ離れた点を、格子と同じ座標系で返す。 */
export function gridPoint(
  center: { lat: number; lng: number },
  northKm: number,
  eastKm = 0,
): { lat: number; lng: number } {
  return {
    lat: Math.round((center.lat + northKm / KM_PER_LAT_DEGREE) * 1e6) / 1e6,
    lng: Math.round((center.lng + eastKm / KM_PER_LNG_DEGREE) * 1e6) / 1e6,
  };
}
