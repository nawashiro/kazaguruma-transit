import type { DiscussionReadPlan } from "@/lib/discussion/discussion-read-plan";
import {
  rankRelayCandidates,
  type RelayCandidateSelectorInput,
} from "@/lib/discussion/relay-candidate-selector";
import type {
  DiscussionNdkGateway,
  NdkEventFilter,
  NdkQueryCompletion,
  NostrEventDTO,
} from "@/lib/nostr/discussion-ndk-gateway";
import type { CompletionReason, ReadEventsOptions } from "@/lib/nostr/nostr-service";

const RELAYS_PER_ATTEMPT = 3;

export type DiscussionReadTransport = (
  filters: NdkEventFilter[],
  options: ReadEventsOptions
) => Promise<NdkQueryCompletion>;

export type DiscussionReadGateway = Pick<DiscussionNdkGateway, "queryWithCompletion">;

export interface RelayAttempt {
  relayUrls: string[];
  completionReason: CompletionReason;
  events: NostrEventDTO[];
  sourceRelayUrlsByEventId: Record<string, string[]>;
  elapsedMs: number;
}

export interface ExecuteDiscussionReadInput {
  plan: DiscussionReadPlan;
  candidates: Omit<RelayCandidateSelectorInput, "limit">;
  onAttemptComplete?: (attempt: RelayAttempt) => void;
}

export interface DiscussionReadResult {
  events: NostrEventDTO[];
  completionReason: CompletionReason;
  attemptedRelayUrls: string[];
  successfulEventRelayUrls: string[];
  sourceRelayUrlsByEventId: Record<string, string[]>;
  attempts: RelayAttempt[];
}

const dedupeEvents = (events: NostrEventDTO[]): NostrEventDTO[] => {
  const byId = new Map<string, NostrEventDTO>();
  for (const event of events) {
    if (!byId.has(event.id)) byId.set(event.id, event);
  }
  return Array.from(byId.values());
};

const mergeSourceRelayUrls = (
  target: Record<string, string[]>,
  events: NostrEventDTO[],
  incoming: Record<string, string[]>
): void => {
  for (const event of events) {
    const sources = incoming[event.id] ?? [];
    const existing = target[event.id] ?? [];
    target[event.id] = Array.from(new Set([...existing, ...sources]));
  }
};

const toAttempt = (
  relayUrls: string[],
  completion: NdkQueryCompletion
): RelayAttempt => ({
  relayUrls,
  completionReason: completion.completionReason,
  events: dedupeEvents(completion.events),
  sourceRelayUrlsByEventId: completion.sourceRelayUrlsByEventId,
  elapsedMs: completion.elapsedMs,
});

const getTransport = (
  transportOrGateway: DiscussionReadTransport | DiscussionReadGateway
): DiscussionReadTransport =>
  typeof transportOrGateway === "function"
    ? transportOrGateway
    : (filters, options) => transportOrGateway.queryWithCompletion(filters, options);

/** Executes at most two completion-aware reads over ranked relay candidates. */
export const executeDiscussionRead = async (
  transportOrGateway: DiscussionReadTransport | DiscussionReadGateway,
  { plan, candidates, onAttemptComplete }: ExecuteDiscussionReadInput
): Promise<DiscussionReadResult> => {
  const transport = getTransport(transportOrGateway);
  const rankedCandidates = rankRelayCandidates({
    ...candidates,
    hints: [...plan.relayHints, ...(candidates.hints ?? [])],
  });
  const relayUrls = rankedCandidates.map((candidate) => candidate.url);
  const firstRelayUrls = relayUrls.slice(0, RELAYS_PER_ATTEMPT);

  const options = {
    idleTimeoutMs: plan.idleTimeoutMs,
    hardTimeoutMs: plan.hardTimeoutMs,
  };
  const attempts: RelayAttempt[] = [];
  const mergedSourceRelayUrlsByEventId: Record<string, string[]> = {};
  const mergedEvents: NostrEventDTO[] = [];

  const executeAttempt = async (attemptRelayUrls: string[]): Promise<RelayAttempt> => {
    const completion = await transport(plan.filters, { relayUrls: attemptRelayUrls, ...options });
    const attempt = toAttempt(attemptRelayUrls, completion);
    attempts.push(attempt);
    mergedEvents.push(...attempt.events);
    mergeSourceRelayUrls(
      mergedSourceRelayUrlsByEventId,
      attempt.events,
      attempt.sourceRelayUrlsByEventId
    );
    onAttemptComplete?.(attempt);
    return attempt;
  };

  const firstAttempt = await executeAttempt(firstRelayUrls);
  const retryRelayUrls = relayUrls.slice(RELAYS_PER_ATTEMPT, RELAYS_PER_ATTEMPT * 2);
  const shouldRetry = firstAttempt.completionReason !== "eose" && retryRelayUrls.length > 0;
  let retryRejected = false;
  let finalAttempt = firstAttempt;
  if (shouldRetry) {
    try {
      finalAttempt = await executeAttempt(retryRelayUrls);
    } catch {
      retryRejected = true;
    }
  }
  const events = dedupeEvents(mergedEvents);
  const attemptedRelayUrls = Array.from(
    new Set([
      ...attempts.flatMap((attempt) => attempt.relayUrls),
      ...(retryRejected ? retryRelayUrls : []),
    ])
  );

  return {
    events,
    completionReason: finalAttempt.completionReason,
    attemptedRelayUrls,
    successfulEventRelayUrls: Array.from(
      new Set(events.flatMap((event) => mergedSourceRelayUrlsByEventId[event.id] ?? []))
    ),
    sourceRelayUrlsByEventId: mergedSourceRelayUrlsByEventId,
    attempts,
  };
};
