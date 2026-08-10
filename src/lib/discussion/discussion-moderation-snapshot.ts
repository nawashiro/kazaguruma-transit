import type { DiscussionReadStrategyConfig } from "@/lib/config/discussion-config";
import { executeDiscussionRead, type DiscussionReadTransport } from "@/lib/discussion/discussion-read-executor";
import type { DiscussionReadPlan } from "@/lib/discussion/discussion-read-plan";
import type { CompletionReason, Event, Filter, NostrService } from "@/lib/nostr/nostr-service";
import { rankRelayCandidates, type RelayCandidate } from "@/lib/discussion/relay-candidate-selector";
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
  input: { discussionId: string; hints?: string[]; recommended?: string[]; successful?: string[]; configured: string[]; defaults: string[]; until?: number; primaryTags?: string[] }
): Promise<DiscussionModerationSnapshot> => {
  const relayCandidates = rankRelayCandidates(input);
  const transport: DiscussionReadTransport = (filters, options) => service.getEventsWithCompletion(filters as Filter[], options);
  const candidates = {
    hints: input.hints,
    recommended: input.recommended,
    successful: input.successful,
    configured: input.configured,
    defaults: input.defaults,
  };
  const primaryPlan: DiscussionReadPlan = {
    target: "discussion-list",
    filters: [{
      kinds: [1111, 1],
      "#a": [input.discussionId],
      ...(input.primaryTags && input.primaryTags.length > 0 ? { "#t": input.primaryTags } : {}),
      limit: 10,
      until: input.until,
    }],
    relayHints: [],
    idleTimeoutMs: strategy.idleTimeoutMs,
    hardTimeoutMs: strategy.hardTimeoutMs,
  };
  const primary = await executeDiscussionRead(transport, { plan: primaryPlan, candidates });
  const primaryEvents = primary.events.filter((event) => !isModeratorRequestEvent(event));
  const postIds = primaryEvents.map((event) => event.id);
  const approvals = postIds.length === 0
    ? { ...primary, events: [], successfulEventRelayUrls: [], sourceRelayUrlsByEventId: {} }
    : await executeDiscussionRead(transport, {
      plan: {
        target: "discussion-approvals",
        filters: [{ kinds: [4550], "#a": [input.discussionId], "#e": postIds, limit: 10 }],
        relayHints: [],
        idleTimeoutMs: strategy.idleTimeoutMs,
        hardTimeoutMs: strategy.hardTimeoutMs,
      },
      candidates,
    });
  const completionReason = primary.completionReason !== "eose"
    ? primary.completionReason
    : approvals.completionReason;
  return createDiscussionModerationSnapshot({
    discussionId: input.discussionId,
    primaryEvents,
    approvalEvents: approvals.events,
    relayCandidates,
    attemptedRelayUrls: Array.from(new Set([...primary.attemptedRelayUrls, ...approvals.attemptedRelayUrls])),
    completionReason,
    successfulRelayUrls: Array.from(new Set([
      ...primary.successfulEventRelayUrls,
      ...approvals.successfulEventRelayUrls,
    ])),
  });
};
