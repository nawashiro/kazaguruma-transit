export type RelayCandidateSource =
  | "hint"
  | "recommended"
  | "successful"
  | "configured"
  | "default";

export interface RelayCandidate {
  url: string;
  source: RelayCandidateSource;
  lastSuccessAt?: number;
}

export interface RelayCandidateSelectorInput {
  hints?: string[];
  recommended?: string[];
  successful?: string[];
  configured: string[];
  defaults: string[];
  limit: number;
}

const isRelayUrl = (url: string): boolean => /^wss?:\/\//.test(url);

const appendCandidates = (
  target: RelayCandidate[],
  seen: Set<string>,
  urls: string[] | undefined,
  source: RelayCandidateSource,
  limit: number
) => {
  for (const url of urls ?? []) {
    const normalizedUrl = url.trim();
    if (!isRelayUrl(normalizedUrl) || seen.has(normalizedUrl) || target.length >= limit) continue;
    seen.add(normalizedUrl);
    target.push({ url: normalizedUrl, source });
  }
};

export const selectRelayCandidates = ({
  hints,
  recommended,
  successful,
  configured,
  defaults,
  limit,
}: RelayCandidateSelectorInput): RelayCandidate[] => {
  return rankRelayCandidates({ hints, recommended, successful, configured, defaults }).slice(0, Math.max(1, Math.min(3, limit)));
};

export const rankRelayCandidates = ({
  hints,
  recommended,
  successful,
  configured,
  defaults,
}: Omit<RelayCandidateSelectorInput, "limit">): RelayCandidate[] => {
  const selected: RelayCandidate[] = [];
  const seen = new Set<string>();
  const relayLimit = Number.POSITIVE_INFINITY;

  appendCandidates(selected, seen, hints, "hint", relayLimit);
  appendCandidates(selected, seen, recommended, "recommended", relayLimit);
  appendCandidates(selected, seen, successful, "successful", relayLimit);
  appendCandidates(selected, seen, configured, "configured", relayLimit);
  appendCandidates(selected, seen, defaults, "default", relayLimit);
  return selected;
};
