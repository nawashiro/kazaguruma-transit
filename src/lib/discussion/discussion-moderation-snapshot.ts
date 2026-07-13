import type { DiscussionReadStrategyConfig } from "@/lib/config/discussion-config";
import type { CompletionReason, Event, EventFetchCompletion, NostrService } from "@/lib/nostr/nostr-service";
import { rankRelayCandidates, type RelayCandidate, selectRelayCandidates } from "@/lib/discussion/relay-candidate-selector";
import { isModeratorRequestEvent } from "@/lib/discussion/moderator-request";

export type ApprovalState = "approved" | "unapproved" | "unknown";

export interface DiscussionModerationSnapshot {
  primaryEvents: Event[];
  approvalEvents: Event[];
  relayCandidates: RelayCandidate[];
  initialRelayUrls: string[];
  attemptedRelayUrls: string[];
  nextRelayUrls: string[];
  successfulRelayUrls: string[];
  completionReason: CompletionReason;
  approvalState: ApprovalState;
}

export interface DiscussionModerationReadInput {
  discussionId: string;
  primaryEvents: Event[];
  approvalEvents: Event[];
  relayCandidates: RelayCandidate[];
  attemptedRelayUrls: string[];
  completionReason: CompletionReason;
  successfulRelayUrls?: string[];
}

const isApprovalForPrimaryEvent = (approval: Event, primaryEventIds: Set<string>): boolean =>
  approval.kind === 4550 && primaryEventIds.has(approval.tags.find((tag) => tag[0] === "e")?.[1] ?? "");

const dedupeAndSortEvents = (events: Event[]): Event[] => {
  const byId = new Map(events.map((event) => [event.id, event]));
  return Array.from(byId.values()).sort((left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id));
};

export const createDiscussionModerationSnapshot = ({
  primaryEvents,
  approvalEvents,
  relayCandidates,
  attemptedRelayUrls,
  completionReason,
  successfulRelayUrls = [],
}: DiscussionModerationReadInput): DiscussionModerationSnapshot => {
  const primary = dedupeAndSortEvents(primaryEvents.filter((event) => !isModeratorRequestEvent(event)));
  const primaryEventIds = new Set(primary.map((event) => event.id));
  const approvals = dedupeAndSortEvents(approvalEvents.filter((event) => isApprovalForPrimaryEvent(event, primaryEventIds)));
  const initialRelayUrls = relayCandidates.slice(0, 3).map((candidate) => candidate.url);
  const nextRelayUrls = relayCandidates
    .filter((candidate) => !attemptedRelayUrls.includes(candidate.url))
    .slice(0, 3)
    .map((candidate) => candidate.url);
  const approvalState: ApprovalState = approvals.length > 0
    ? "approved"
    : completionReason !== "eose" || nextRelayUrls.length > 0
      ? "unknown"
      : "unapproved";
  return { primaryEvents: primary, approvalEvents: approvals, relayCandidates, initialRelayUrls, attemptedRelayUrls, nextRelayUrls, successfulRelayUrls, completionReason, approvalState };
};

export const loadDiscussionModerationSnapshot = async (
  service: Pick<NostrService, "getEventsWithCompletion">,
  strategy: DiscussionReadStrategyConfig,
  input: { discussionId: string; hints?: string[]; recommended?: string[]; successful?: string[]; configured: string[]; defaults: string[]; until?: number }
): Promise<DiscussionModerationSnapshot> => {
  const relayCandidates = rankRelayCandidates(input);
  const relayUrls = selectRelayCandidates({ ...input, limit: strategy.relayLimit }).map((candidate) => candidate.url);
  const options = { idleTimeoutMs: strategy.idleTimeoutMs, hardTimeoutMs: strategy.hardTimeoutMs, relayUrls };
  const primary = await service.getEventsWithCompletion([{ kinds: [1111, 1], "#a": [input.discussionId], limit: 10, until: input.until }], options);
  const primaryEvents = primary.events.filter((event) => !isModeratorRequestEvent(event));
  const postIds = primaryEvents.map((event) => event.id);
  const approvals: EventFetchCompletion = postIds.length === 0
    ? { ...primary, events: [], eventCount: 0 }
    : await service.getEventsWithCompletion([{ kinds: [4550], "#a": [input.discussionId], "#e": postIds, limit: 10 }], options);
  const completionReason = primary.completionReason !== "eose"
    ? primary.completionReason
    : approvals.completionReason;
  return createDiscussionModerationSnapshot({
    discussionId: input.discussionId,
    primaryEvents,
    approvalEvents: approvals.events,
    relayCandidates,
    attemptedRelayUrls: relayUrls,
    completionReason,
    successfulRelayUrls: Array.from(new Set(approvals.events.flatMap((event) => approvals.sourceRelayUrlsByEventId[event.id] ?? []))),
  });
};
