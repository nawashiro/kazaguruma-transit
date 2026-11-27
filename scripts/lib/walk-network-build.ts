import {
  serializeWalkNetwork,
  WALK_NETWORK_VERSION,
  type WalkNetworkArtifact,
} from "../../src/lib/transit/walk-network";
import type { WalkEdge, WalkNode } from "./osm-walk-extract";

export const WALK_NETWORK_SOURCE = {
  name: "OpenStreetMap",
  url: "https://www.openstreetmap.org/copyright",
  license: "ODbL-1.0",
  licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  extractUri: "https://osm.download.movisda.io/admin/JP-13-latest.osm.pbf",
} as const;

export interface WalkNetworkContents {
  nodes: WalkNode[];
  edges: WalkEdge[];
}

/** 座標は約11センチの精度で十分なため、10^6倍した整数に丸める。 */
function toMicroDegrees(degrees: number): number {
  return Math.round(degrees * 1e6);
}

export function buildWalkNetworkArtifact(
  contents: WalkNetworkContents,
): WalkNetworkArtifact {
  const nodes = [...contents.nodes]
    .map((entry): [number, number, number] => [
      entry.id,
      toMicroDegrees(entry.lat),
      toMicroDegrees(entry.lng),
    ])
    .sort((first, second) => first[0] - second[0]);
  const edges = [...contents.edges]
    .map((edge): [number, number] => [
      Math.min(edge.a, edge.b),
      Math.max(edge.a, edge.b),
    ])
    .sort((first, second) => first[0] - second[0] || first[1] - second[1]);
  return { version: WALK_NETWORK_VERSION, nodes, edges };
}

/**
 * 内容が同じなら書き換えない。生成のたびに書き直すと、変わっていない道まで
 * 差分として現れ、レビューで本当の変更を見分けられなくなる。
 */
export function walkNetworkDigest(artifact: WalkNetworkArtifact): string {
  return `${artifact.nodes.length}:${artifact.edges.length}:${serializeWalkNetwork(
    artifact,
  ).length}`;
}

export interface WriteWalkNetworkOptions {
  artifact: WalkNetworkArtifact;
  readExisting: () => Promise<string | null>;
  write: (contents: string) => Promise<void>;
  report: (message: string) => void;
}

export async function writeWalkNetworkIfChanged(
  options: WriteWalkNetworkOptions,
): Promise<boolean> {
  const existing = await options.readExisting();
  const next = serializeWalkNetwork(options.artifact);
  if (existing !== null && existing === next) {
    options.report("徒歩ネットワークに変更はありません");
    return false;
  }
  await options.write(next);
  options.report("徒歩ネットワークを書き出しました");
  return true;
}
