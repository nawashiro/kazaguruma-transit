export interface RouteCandidateMetrics {
  totalWalkingDistance: number;
  totalDuration: number;
}

/** UIの優先条件に従って最適な経路候補を返す。 */
export function selectBestRouteCandidate<
  Candidate extends RouteCandidateMetrics,
>(
  candidates: readonly Candidate[],
  prioritizeSpeed: boolean
): Candidate | undefined {
  return candidates.reduce<Candidate | undefined>((bestCandidate, candidate) => {
    if (!bestCandidate) {
      return candidate;
    }

    const primaryDifference = prioritizeSpeed
      ? candidate.totalDuration - bestCandidate.totalDuration
      : candidate.totalWalkingDistance - bestCandidate.totalWalkingDistance;

    if (primaryDifference !== 0) {
      return primaryDifference < 0 ? candidate : bestCandidate;
    }

    const secondaryDifference = prioritizeSpeed
      ? candidate.totalWalkingDistance - bestCandidate.totalWalkingDistance
      : candidate.totalDuration - bestCandidate.totalDuration;

    return secondaryDifference < 0 ? candidate : bestCandidate;
  }, undefined);
}
