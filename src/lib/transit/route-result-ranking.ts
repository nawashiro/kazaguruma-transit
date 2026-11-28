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

/** 乗換を選ぶために必要な、直通との差（分）。 */
export const TRANSFER_AVOIDANCE_THRESHOLD_MINUTES = 30;

/** 出発時刻指定では到着時刻、到着時刻指定では出発時刻。 */
function preferredSeconds(
  candidate: RouteCandidateMetrics,
  options: RouteSelectionOptions
): number {
  return parseGtfsTime(
    options.isDeparture ? candidate.arrival : candidate.departure
  );
}

function isDirect(candidate: RouteCandidateMetrics): boolean {
  return candidate.transfers === 0;
}

function isPreferredWithinKind(
  candidate: RouteCandidateMetrics,
  best: RouteCandidateMetrics,
  options: RouteSelectionOptions
): boolean {
  const candidateTime = preferredSeconds(candidate, options);
  const bestTime = preferredSeconds(best, options);
  if (candidateTime !== bestTime) {
    return options.isDeparture
      ? candidateTime < bestTime
      : candidateTime > bestTime;
  }
  if (candidate.totalWalkingDistance !== best.totalWalkingDistance) {
    return candidate.totalWalkingDistance < best.totalWalkingDistance;
  }
  return parseGtfsTime(candidate.departure) < parseGtfsTime(best.departure);
}

function pickWithinKind<Candidate extends RouteCandidateMetrics>(
  candidates: readonly Candidate[],
  options: RouteSelectionOptions
): Candidate | undefined {
  let best: Candidate | undefined;
  for (const candidate of candidates) {
    if (best === undefined || isPreferredWithinKind(candidate, best, options)) {
      best = candidate;
    }
  }
  return best;
}

function transferBeatsDirect(
  transfer: RouteCandidateMetrics,
  direct: RouteCandidateMetrics,
  options: RouteSelectionOptions
): boolean {
  const difference = options.isDeparture
    ? preferredSeconds(direct, options) - preferredSeconds(transfer, options)
    : preferredSeconds(transfer, options) - preferredSeconds(direct, options);
  return difference >= TRANSFER_AVOIDANCE_THRESHOLD_MINUTES * 60;
}

/** 優先条件に従って最適な経路候補を返す。 */
export function selectBestRouteCandidate<
  Candidate extends RouteCandidateMetrics,
>(
  candidates: readonly Candidate[],
  options: RouteSelectionOptions
): Candidate | undefined {
  const direct = pickWithinKind(
    candidates.filter(isDirect),
    options
  );
  const transfer = pickWithinKind(
    candidates.filter((candidate) => !isDirect(candidate)),
    options
  );
  if (options.prioritizeSpeed) {
    if (direct === undefined) return transfer;
    if (transfer === undefined) return direct;
    return isPreferredWithinKind(transfer, direct, options) ? transfer : direct;
  }
  if (direct === undefined) return transfer;
  if (transfer === undefined) return direct;
  return transferBeatsDirect(transfer, direct, options) ? transfer : direct;
}
