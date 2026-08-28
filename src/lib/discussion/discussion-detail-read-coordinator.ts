import type { DiscussionReadStrategyConfig } from "@/lib/config/discussion-config";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";
import {
  executeNostrRead,
  type NostrReadGateway,
  type NostrReadResult,
  type NostrReadPlan,
} from "@/lib/nostr/nostr-read-executor";
import {
  parseApprovalEvent,
  parseDiscussionEvent,
  parseEvaluationEvent,
  parsePostEvent,
} from "@/lib/nostr/nostr-utils";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
  PostEvaluation,
} from "@/types/discussion";
import { isModeratorRequestEvent } from "@/lib/discussion/moderator-request";

export type DiscussionDetailPhase =
  | "metadata"
  | "content"
  | "approval"
  | "evaluation";

export type DiscussionDetailState = "loading" | "ready" | "partial" | "error";

export interface ModeratorRequest {
  id: string;
  applicantPubkey: string;
  createdAt: number;
  reason: string;
  event: NostrEventDTO;
}

export interface DiscussionDetailRelayProvenance {
  successfulRelayUrlsByPhase: Partial<
    Record<DiscussionDetailPhase, string[]>
  >;
}

export interface DiscussionDetailSnapshot {
  discussion: Discussion | null;
  posts: DiscussionPost[];
  approvals: PostApproval[];
  moderatorRequests: ModeratorRequest[];
  evaluations: PostEvaluation[];
  userEvaluationIds: Set<string>;
  relayProvenance: DiscussionDetailRelayProvenance;
}

export interface DiscussionDetailReadResult {
  state: DiscussionDetailState;
  snapshot: DiscussionDetailSnapshot | null;
  error: string | null;
  completionReason: NostrReadResult["completionReason"] | null;
  relayProvenance: DiscussionDetailRelayProvenance;
}

export interface DiscussionDetailReadInput {
  gateway: NostrReadGateway;
  discussionId: string;
  authorPubkey: string;
  dTag: string;
  relayUrls: string[];
  strategy: Pick<
    DiscussionReadStrategyConfig,
    "idleTimeoutMs" | "hardTimeoutMs"
  > & { dedupWindowMs?: number };
  userPubkey?: string | null;
  onSnapshotCommit?: (snapshot: DiscussionDetailSnapshot) => void;
  /** Optional generation predicate used by route owners to reject stale commits. */
  isCurrent?: () => boolean;
}

const emptyReadResult = (
  completionReason: NostrReadResult["completionReason"] | null,
): NostrReadResult => ({
  events: [],
  completionReason: completionReason ?? "eose",
  duplicateCount: 0,
  elapsedMs: 0,
  attemptedRelayUrls: [],
  successfulEventRelayUrls: [],
  sourceRelayUrlsByEventId: {},
  attempts: [],
});

const dedupeEvents = (events: NostrEventDTO[]): NostrEventDTO[] => {
  const byId = new Map(events.map((event) => [event.id, event]));
  return Array.from(byId.values()).sort(
    (left, right) =>
      right.created_at - left.created_at || left.id.localeCompare(right.id),
  );
};

const createPlan = (
  phase: DiscussionDetailPhase,
  input: DiscussionDetailReadInput,
  postIds: string[],
): NostrReadPlan => {
  const common = {
    idleTimeoutMs: input.strategy.idleTimeoutMs,
    hardTimeoutMs: input.strategy.hardTimeoutMs,
  };

  switch (phase) {
    case "metadata":
      return {
        ...common,
        target: "discussion-meta",
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
        target: "discussion-content",
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
        target: "discussion-approvals",
        filters: [
          {
            kinds: [4550],
            "#a": [input.discussionId],
            "#e": postIds,
            limit: 50,
          },
        ],
      };
    case "evaluation":
      return {
        ...common,
        target: "discussion-evaluations",
        filters: [
          {
            kinds: [7],
            "#e": postIds,
            limit: 100,
          },
        ],
      };
  }
};

const hasKnownPostReference = (
  event: NostrEventDTO,
  discussionId: string,
): boolean =>
  event.tags.some(
    (tag) => (tag[0] === "a" || tag[0] === "A") && tag[1] === discussionId,
  );

const toModeratorRequest = (event: NostrEventDTO): ModeratorRequest => ({
  id: event.id,
  applicantPubkey: event.pubkey,
  createdAt: event.created_at,
  reason: event.content,
  event,
});

const parseDetailPost = (
  event: NostrEventDTO,
  discussionId: string,
  approvals: PostApproval[],
): DiscussionPost | null => {
  const parsed = parsePostEvent(event, approvals);
  if (parsed) return parsed;
  if (
    (event.kind !== 1111 && event.kind !== 1) ||
    isModeratorRequestEvent(event) ||
    !hasKnownPostReference(event, discussionId)
  ) {
    return null;
  }
  return {
    id: event.id,
    content: event.content,
    authorPubkey: event.pubkey,
    discussionId,
    createdAt: event.created_at,
    approved: approvals.some((approval) => approval.postId === event.id),
    approvedBy: approvals
      .filter((approval) => approval.postId === event.id)
      .map((approval) => approval.moderatorPubkey),
    approvedAt: approvals.find((approval) => approval.postId === event.id)?.createdAt,
    event,
  };
};

const parseDetailApproval = (
  event: NostrEventDTO,
  discussionId: string,
): PostApproval | null => {
  const parsed = parseApprovalEvent(event);
  if (parsed) return parsed;
  if (event.kind !== 4550 || !hasKnownPostReference(event, discussionId)) {
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

const parseDetailEvaluation = (
  event: NostrEventDTO,
  discussionId: string,
): PostEvaluation | null => {
  const parsed = parseEvaluationEvent(event);
  if (parsed) return parsed;
  if (event.kind !== 7) return null;
  const postId = event.tags.find((tag) => tag[0] === "e")?.[1];
  if (!postId || !hasKnownPostReference(event, discussionId)) return null;
  return {
    id: event.id,
    postId,
    evaluatorPubkey: event.pubkey,
    rating: event.content.trim() === "-" ? "-" : "+",
    discussionId,
    createdAt: event.created_at,
    event,
  };
};

const addPhaseProvenance = (
  provenance: DiscussionDetailRelayProvenance,
  phase: DiscussionDetailPhase,
  result: NostrReadResult,
): void => {
  provenance.successfulRelayUrlsByPhase[phase] = [
    ...result.successfulEventRelayUrls,
  ];
};

const isPartialResult = (
  results: Partial<Record<DiscussionDetailPhase, NostrReadResult>>,
): boolean =>
  Object.values(results).some(
    (result) => result !== undefined && result.completionReason !== "eose",
  );

/**
 * Reads one discussion detail in domain order and publishes only its final snapshot.
 * Relay communication and retry behavior remain owned by executeNostrRead.
 */
export const readDiscussionDetail = async (
  input: DiscussionDetailReadInput,
): Promise<DiscussionDetailReadResult> => {
  const relayProvenance: DiscussionDetailRelayProvenance = {
    successfulRelayUrlsByPhase: {},
  };
  const results: Partial<Record<DiscussionDetailPhase, NostrReadResult>> = {};

  try {
    const readPhase = async (
      phase: DiscussionDetailPhase,
      postIds: string[],
    ): Promise<NostrReadResult> => {
      const result = await executeNostrRead(input.gateway, {
        plan: createPlan(phase, input, postIds),
        relayUrls: input.relayUrls,
      });
      results[phase] = result;
      addPhaseProvenance(relayProvenance, phase, result);
      return result;
    };

    const metadata = await readPhase("metadata", []);
    const content = await readPhase("content", []);
    const contentEvents = dedupeEvents(
      content.events.filter((event) =>
        hasKnownPostReference(event, input.discussionId),
      ),
    );
    const postIds = contentEvents
      .filter((event) => !isModeratorRequestEvent(event))
      .map((event) => event.id);

    const approval = await readPhase("approval", postIds);
    const evaluation = await readPhase("evaluation", postIds);

    const discussionEvents = metadata.events.filter(
      (event) =>
        event.kind === 34550 &&
        event.pubkey === input.authorPubkey &&
        event.tags.some((tag) => tag[0] === "d" && tag[1] === input.dTag),
    );
    const discussions = discussionEvents
      .map(parseDiscussionEvent)
      .filter((discussion): discussion is Discussion => discussion !== null);
    const discussion = discussions.reduce<Discussion | null>(
      (latest, candidate) =>
        !latest || candidate.createdAt > latest.createdAt ? candidate : latest,
      null,
    );

    const approvalEvents = approval.events.filter(
      (event) => event.kind === 4550,
    );
    const approvals = approvalEvents
      .map((event) => parseDetailApproval(event, input.discussionId))
      .filter((item): item is PostApproval => item !== null)
      .filter((item) => postIds.includes(item.postId));

    const posts = contentEvents
      .filter((event) => !isModeratorRequestEvent(event))
      .map((event) => parseDetailPost(event, input.discussionId, approvals))
      .filter((post): post is DiscussionPost => post !== null)
      .map((post) => ({
        ...post,
        approvalState: (approvals.some((approvalItem) => approvalItem.postId === post.id)
          ? "approved"
          : approval.completionReason === "eose"
            ? "unapproved"
            : "unknown") as DiscussionPost["approvalState"],
      }));

    const moderatorRequests = contentEvents
      .filter((event) => isModeratorRequestEvent(event))
      .map(toModeratorRequest);

    const evaluations = evaluation.events
      .map((event) => parseDetailEvaluation(event, input.discussionId))
      .filter((item): item is PostEvaluation => item !== null)
      .filter((item) => postIds.includes(item.postId));
    const userEvaluationIds = new Set(
      evaluations
        .filter((item) => item.evaluatorPubkey === (input.userPubkey ?? null))
        .map((item) => item.id),
    );

    const snapshot: DiscussionDetailSnapshot = {
      discussion,
      posts,
      approvals,
      moderatorRequests,
      evaluations,
      userEvaluationIds,
      relayProvenance,
    };

    const state: DiscussionDetailState = isPartialResult(results)
      ? "partial"
      : "ready";
    const completionReason = [
      metadata.completionReason,
      content.completionReason,
      approval.completionReason,
      evaluation.completionReason,
    ].find((reason) => reason !== "eose") ?? "eose";

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

export { emptyReadResult };
