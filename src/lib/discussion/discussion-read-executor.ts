import type { DiscussionReadPlan } from "@/lib/discussion/discussion-read-plan";
import { dedupeAndSortEvents } from "@/lib/nostr/event-deduplication";
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
  duplicateCount: number;
  elapsedMs: number;
}

export interface ExecuteDiscussionReadInput {
  plan: DiscussionReadPlan;
  relayUrls: string[];
  onAttemptComplete?: (attempt: RelayAttempt) => void;
}

export interface DiscussionReadResult {
  events: NostrEventDTO[];
  completionReason: CompletionReason;
  duplicateCount: number;
  elapsedMs: number;
  attemptedRelayUrls: string[];
  successfulEventRelayUrls: string[];
  sourceRelayUrlsByEventId: Record<string, string[]>;
  attempts: RelayAttempt[];
}

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
  events: dedupeAndSortEvents(completion.events),
  sourceRelayUrlsByEventId: completion.sourceRelayUrlsByEventId,
  duplicateCount: completion.duplicateCount,
  elapsedMs: completion.elapsedMs,
});

const getTransport = (
  transportOrGateway: DiscussionReadTransport | DiscussionReadGateway
): DiscussionReadTransport =>
  typeof transportOrGateway === "function"
    ? transportOrGateway
    : (filters, options) => transportOrGateway.queryWithCompletion(filters, options);

/** Executes at most two completion-aware reads over Provider-selected relay URLs. */
export const executeDiscussionRead = async (
  transportOrGateway: DiscussionReadTransport | DiscussionReadGateway,
  { plan, relayUrls: providerRelayUrls, onAttemptComplete }: ExecuteDiscussionReadInput
): Promise<DiscussionReadResult> => {
  const transport = getTransport(transportOrGateway);
  const relayUrls = Array.from(new Set(providerRelayUrls));
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
  const events = dedupeAndSortEvents(mergedEvents);
  const attemptedRelayUrls = Array.from(
    new Set([
      ...attempts.flatMap((attempt) => attempt.relayUrls),
      ...(retryRejected ? retryRelayUrls : []),
    ])
  );

  return {
    events,
    completionReason: finalAttempt.completionReason,
    duplicateCount: attempts.reduce((total, attempt) => total + attempt.duplicateCount, 0),
    elapsedMs: attempts.reduce((total, attempt) => total + attempt.elapsedMs, 0),
    attemptedRelayUrls,
    successfulEventRelayUrls: Array.from(
      new Set(events.flatMap((event) => mergedSourceRelayUrlsByEventId[event.id] ?? []))
    ),
    sourceRelayUrlsByEventId: mergedSourceRelayUrlsByEventId,
    attempts,
  };
};
