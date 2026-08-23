import type { DiscussionReadStrategyConfig } from "@/lib/config/discussion-config";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";
import {
  executeNostrRead,
  type NostrReadGateway,
  type NostrReadPlan,
  type NostrReadResult,
} from "@/lib/nostr/nostr-read-executor";
import { isModeratorRequestEvent } from "@/lib/discussion/moderator-request";
import { resolveDiscussionReferences } from "@/lib/discussion/discussion-reference-resolver";
import {
  parseApprovalEvent,
  parseDiscussionEvent,
  parsePostEvent,
} from "@/lib/nostr/nostr-utils";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
} from "@/types/discussion";

export type DiscussionManagementPhase =
  | "metadata"
  | "content"
  | "approval"
  | "reference";

export type DiscussionManagementState = "loading" | "ready" | "partial" | "error";

export interface ManagementModeratorRequest {
  id: string;
  applicantPubkey: string;
  createdAt: number;
  reason: string;
  event: NostrEventDTO;
}

export interface DiscussionManagementRelayProvenance {
  successfulRelayUrlsByPhase: Partial<
    Record<DiscussionManagementPhase, string[]>
  >;
}

export interface DiscussionManagementSnapshot {
  listDiscussion: Discussion | null;
  listingPosts: DiscussionPost[];
  listingApprovals: PostApproval[];
  referencedDiscussions: Discussion[];
  /** Listing moderator applications are consumed by the public management route. */
  moderatorRequests?: ManagementModeratorRequest[];
  relayProvenance?: DiscussionManagementRelayProvenance;
}

export interface DiscussionManagementReadResult {
  state: DiscussionManagementState;
  snapshot: DiscussionManagementSnapshot | null;
  error: string | null;
  completionReason: NostrReadResult["completionReason"] | null;
  relayProvenance: DiscussionManagementRelayProvenance;
}

export interface DiscussionManagementReadInput {
  gateway: NostrReadGateway;
  discussionId: string;
  authorPubkey: string;
  dTag: string;
  relayUrls: string[];
  strategy: Pick<
    DiscussionReadStrategyConfig,
    "idleTimeoutMs" | "hardTimeoutMs"
  > & { dedupWindowMs?: number };
  onSnapshotCommit?: (snapshot: DiscussionManagementSnapshot) => void;
  /** Optional generation predicate used by the provider to reject stale commits. */
  isCurrent?: () => boolean;
}

const createPlan = (
  phase: DiscussionManagementPhase,
  input: DiscussionManagementReadInput,
  postIds: string[],
  references: Array<{ authorPubkey: string; dTag: string }>,
): NostrReadPlan => {
  const common = {
    idleTimeoutMs: input.strategy.idleTimeoutMs,
    hardTimeoutMs: input.strategy.hardTimeoutMs,
  };

  switch (phase) {
    case "metadata":
      return {
        ...common,
        target: "discussion-list-metadata",
        filters: [
          {
            kinds: [34550],
            authors: [input.authorPubkey],
            "#d": [input.dTag],
            limit: 1,
          },
        ],
      };
    case "content":
      return {
        ...common,
        target: "discussion-list-content",
        filters: [
          {
            kinds: [1111, 1],
            "#a": [input.discussionId],
            limit: 50,
          },
        ],
      };
    case "approval":
      return {
        ...common,
        target: "discussion-list-approval",
        filters: [
          {
            kinds: [4550],
            "#a": [input.discussionId],
            "#e": postIds,
            limit: 50,
          },
        ],
      };
    case "reference":
      return {
        ...common,
        target: "discussion-references",
        filters: references.map(({ authorPubkey, dTag }) => ({
          kinds: [34550],
          authors: [authorPubkey],
          "#d": [dTag],
          limit: 1,
        })),
      };
  }
};

const dedupeEventsInOrder = (events: NostrEventDTO[]): NostrEventDTO[] => {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
};

const hasDiscussionReference = (
  event: NostrEventDTO,
  discussionId: string,
): boolean =>
  event.tags.some(
    (tag) => (tag[0] === "a" || tag[0] === "A") && tag[1] === discussionId,
  );

const toModeratorRequest = (
  event: NostrEventDTO,
): ManagementModeratorRequest => ({
  id: event.id,
  applicantPubkey: event.pubkey,
  createdAt: event.created_at,
  reason: event.content,
  event,
});

const parseListingApproval = (
  event: NostrEventDTO,
  discussionId: string,
): PostApproval | null => {
  const approval = parseApprovalEvent(event);
  if (
    approval &&
    approval.discussionId === discussionId
  ) {
    return approval;
  }

  if (event.kind !== 4550 || !hasDiscussionReference(event, discussionId)) {
    return null;
  }

  const postId = event.tags.find((tag) => tag[0] === "e")?.[1];
  const postAuthorPubkey = event.tags.find((tag) => tag[0] === "p")?.[1];
  if (!postId || !postAuthorPubkey) return null;

  return {
    id: event.id,
    postId,
    postAuthorPubkey,
    moderatorPubkey: event.pubkey,
    discussionId,
    createdAt: event.created_at,
    event,
  };
};

const parseListingPost = (
  event: NostrEventDTO,
  discussionId: string,
  approvals: PostApproval[],
  approvalCompletionReason: NostrReadResult["completionReason"],
): DiscussionPost | null => {
  const parsed = parsePostEvent(event, approvals);
  if (
    parsed &&
    parsed.discussionId === discussionId
  ) {
    return {
      ...parsed,
      approvalState: approvals.some((approval) => approval.postId === parsed.id)
        ? "approved"
        : approvalCompletionReason === "eose"
          ? "unapproved"
          : "unknown",
    };
  }

  if (
    (event.kind !== 1111 && event.kind !== 1) ||
    isModeratorRequestEvent(event) ||
    !hasDiscussionReference(event, discussionId)
  ) {
    return null;
  }

  const approved = approvals.filter((approval) => approval.postId === event.id);
  return {
    id: event.id,
    content: event.content,
    authorPubkey: event.pubkey,
    discussionId,
    createdAt: event.created_at,
    approved: approved.length > 0,
    approvedBy: approved.map((approval) => approval.moderatorPubkey),
    approvedAt:
      approved.length > 0
        ? Math.min(...approved.map((approval) => approval.createdAt))
        : undefined,
    approvalState:
      approved.length > 0
        ? "approved"
        : approvalCompletionReason === "eose"
          ? "unapproved"
          : "unknown",
    event,
  };
};

const addPhaseProvenance = (
  provenance: DiscussionManagementRelayProvenance,
  phase: DiscussionManagementPhase,
  result: NostrReadResult,
): void => {
  provenance.successfulRelayUrlsByPhase[phase] = [
    ...result.successfulEventRelayUrls,
  ];
};

const isPartialResult = (
  results: Partial<Record<DiscussionManagementPhase, NostrReadResult>>,
): boolean =>
  Object.values(results).some(
    (result) => result !== undefined && result.completionReason !== "eose",
  );

const latestDiscussion = (
  events: NostrEventDTO[],
  expectedId: string,
): Discussion | null => {
  const discussions = events
    .map(parseDiscussionEvent)
    .filter((discussion): discussion is Discussion =>
      discussion !== null && discussion.id === expectedId,
    );
  return discussions.reduce<Discussion | null>(
    (latest, candidate) =>
      !latest || candidate.createdAt > latest.createdAt ? candidate : latest,
    null,
  );
};

const parseReferencedDiscussions = (
  events: NostrEventDTO[],
  references: Array<{ discussionId: string }>,
): Discussion[] => {
  const byId = new Map<string, Discussion>();
  for (const event of events) {
    const discussion = parseDiscussionEvent(event);
    if (!discussion || !references.some((reference) => reference.discussionId === discussion.id)) {
      continue;
    }
    const current = byId.get(discussion.id);
    if (!current || discussion.createdAt > current.createdAt) {
      byId.set(discussion.id, discussion);
    }
  }
  return references
    .map((reference) => byId.get(reference.discussionId))
    .filter((discussion): discussion is Discussion => discussion !== undefined);
};

/**
 * Reads the listing lifecycle in domain order and commits one final snapshot.
 * Pending posts and their q references remain in the management snapshot;
 * public visibility filtering is owned by the public list selector.
 */
export const readDiscussionManagement = async (
  input: DiscussionManagementReadInput,
): Promise<DiscussionManagementReadResult> => {
  const relayProvenance: DiscussionManagementRelayProvenance = {
    successfulRelayUrlsByPhase: {},
  };
  const results: Partial<Record<DiscussionManagementPhase, NostrReadResult>> = {};

  try {
    const readPhase = async (
      phase: DiscussionManagementPhase,
      postIds: string[] = [],
      references: Array<{ authorPubkey: string; dTag: string }> = [],
    ): Promise<NostrReadResult> => {
      const result = await executeNostrRead(input.gateway, {
        plan: createPlan(phase, input, postIds, references),
        relayUrls: input.relayUrls,
      });
      results[phase] = result;
      addPhaseProvenance(relayProvenance, phase, result);
      return result;
    };

    const metadata = await readPhase("metadata");
    const content = await readPhase("content");
    const contentEvents = dedupeEventsInOrder(
      content.events.filter((event) =>
        hasDiscussionReference(event, input.discussionId),
      ),
    );
    const postIds = contentEvents
      .filter((event) => !isModeratorRequestEvent(event))
      .map((event) => event.id);

    const approval = await readPhase("approval", postIds);
    const approvals = dedupeEventsInOrder(approval.events)
      .map((event) => parseListingApproval(event, input.discussionId))
      .filter((item): item is PostApproval => item !== null)
      .filter((item) => postIds.includes(item.postId));

    const listingPosts = contentEvents
      .filter((event) => !isModeratorRequestEvent(event))
      .map((event) =>
        parseListingPost(
          event,
          input.discussionId,
          approvals,
          approval.completionReason,
        ),
      )
      .filter((post): post is DiscussionPost => post !== null);
    const moderatorRequests = contentEvents
      .filter((event) => isModeratorRequestEvent(event))
      .map(toModeratorRequest);

    const referenceResolution = resolveDiscussionReferences(
      contentEvents.flatMap((event) => event.tags),
    );
    const reference = referenceResolution.references.length > 0
      ? await readPhase(
          "reference",
          [],
          referenceResolution.references,
        )
      : null;
    const referencedDiscussions = reference
      ? parseReferencedDiscussions(reference.events, referenceResolution.references)
      : [];

    const snapshot: DiscussionManagementSnapshot = {
      listDiscussion: latestDiscussion(
        metadata.events,
        input.discussionId,
      ),
      listingPosts,
      listingApprovals: approvals,
      referencedDiscussions,
      moderatorRequests,
      relayProvenance,
    };
    const state: DiscussionManagementState = isPartialResult(results)
      ? "partial"
      : "ready";
    const completionReason = Object.values(results).find(
      (result) => result.completionReason !== "eose",
    )?.completionReason ?? "eose";

    if (input.isCurrent?.() === false) {
      return {
        state,
        snapshot: null,
        error: null,
        completionReason,
        relayProvenance,
      };
    }

    input.onSnapshotCommit?.(snapshot);
    return {
      state,
      snapshot,
      error: null,
      completionReason,
      relayProvenance,
    };
  } catch (error) {
    return {
      state: "error",
      snapshot: null,
      error: error instanceof Error ? error.message : String(error),
      completionReason: null,
      relayProvenance,
    };
  }
};
