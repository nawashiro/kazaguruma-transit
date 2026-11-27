import { parseGtfsTime } from "./walking";

export interface RouteCandidateMetrics {
  /** 乗車停留所と降車停留所を結ぶ経路の総徒歩距離（キロメートル）。 */
  totalWalkingDistance: number;
  departure: string;
  arrival: string;
  transfers: number;
}

export interface RouteSelectionOptions {
  prioritizeSpeed: boolean;
  isDeparture: boolean;
}

/** 乗換1回あたりのコスト（分）。徒歩優先で到着・出発時刻に足し引きする。 */
export const TRANSFER_PENALTY_MINUTES = 10;

interface ComparisonKey {
  /** 主値。出発時刻指定では小さいほど、到着時刻指定では大きいほど望ましい。 */
  primary: number;
  walkingDistance: number;
  transfers: number;
  /** 同値時の時刻。小さいほど望ましい。 */
  time: number;
}

function toComparisonKey(
  candidate: RouteCandidateMetrics,
  options: RouteSelectionOptions
): ComparisonKey {
  const penaltySeconds = TRANSFER_PENALTY_MINUTES * 60 * candidate.transfers;
  const transitTime = parseGtfsTime(
    options.isDeparture ? candidate.arrival : candidate.departure
  );
  return {
    primary: options.prioritizeSpeed
      ? transitTime
      : options.isDeparture
        ? transitTime + penaltySeconds
        : transitTime - penaltySeconds,
    walkingDistance: candidate.totalWalkingDistance,
    transfers: candidate.transfers,
    time: parseGtfsTime(
      options.isDeparture ? candidate.departure : candidate.arrival
    ),
  };
}

function isBetter(
  candidate: ComparisonKey,
  best: ComparisonKey,
  options: RouteSelectionOptions
): boolean {
  if (candidate.primary !== best.primary) {
    return options.isDeparture
      ? candidate.primary < best.primary
      : candidate.primary > best.primary;
  }
  if (candidate.walkingDistance !== best.walkingDistance) {
    return candidate.walkingDistance < best.walkingDistance;
  }
  if (candidate.transfers !== best.transfers) {
    return candidate.transfers < best.transfers;
  }
  return candidate.time < best.time;
}

/** 優先条件に従って最適な経路候補を返す。 */
export function selectBestRouteCandidate<
  Candidate extends RouteCandidateMetrics,
>(
  candidates: readonly Candidate[],
  options: RouteSelectionOptions
): Candidate | undefined {
  let bestCandidate: Candidate | undefined;
  let bestKey: ComparisonKey | undefined;
  for (const candidate of candidates) {
    const key = toComparisonKey(candidate, options);
    if (bestKey === undefined || isBetter(key, bestKey, options)) {
      bestCandidate = candidate;
      bestKey = key;
    }
  }
  return bestCandidate;
}
