import path from "node:path";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";

jest.mock("@/lib/nostr/nostr-read-executor", () => ({
  executeNostrRead: jest.fn(),
}));

const { executeNostrRead } = jest.requireMock(
  "@/lib/nostr/nostr-read-executor",
) as { executeNostrRead: jest.Mock };

type ReadCompletionReason = "eose" | "idle-timeout" | "hard-timeout";
type DetailState = "loading" | "ready" | "partial" | "error";

type DetailSnapshot = {
  discussion: { id: string; title: string } | null;
  posts: Array<{ id: string; approvalState?: "approved" | "unapproved" | "unknown" }>;
  approvals: Array<{ id: string; postId: string }>;
  moderatorRequests: Array<{ id: string }>;
  evaluations: Array<{ id: string; postId: string; evaluatorPubkey: string }>;
  userEvaluationIds: Set<string>;
  relayProvenance: {
    successfulRelayUrlsByPhase: Partial<
      Record<"metadata" | "content" | "approval" | "evaluation", string[]>
    >;
  };
};

type DetailReadResult = {
  state: DetailState;
  snapshot: DetailSnapshot | null;
  error: string | null;
  relayProvenance: DetailSnapshot["relayProvenance"];
};

type DetailReadInput = {
  gateway: {
    queryWithCompletion: jest.Mock;
  };
  discussionId: string;
  authorPubkey: string;
  dTag: string;
  relayUrls: string[];
  strategy: {
    idleTimeoutMs: number;
    hardTimeoutMs: number;
    dedupWindowMs: number;
  };
  userPubkey: string;
  onSnapshotCommit?: (snapshot: DetailSnapshot) => void;
};

type DetailCoordinatorModule = {
  readDiscussionDetail?: (
    input: DetailReadInput,
  ) => Promise<DetailReadResult>;
};

const coordinatorPath = path.join(
  process.cwd(),
  "src/lib/discussion/discussion-detail-read-coordinator",
);

const loadCoordinator = (): DetailCoordinatorModule => {
  try {
    const loaded = jest.requireActual(coordinatorPath) as unknown;
    if (!loaded || typeof loaded !== "object") {
      throw new Error("The detail coordinator module did not export an object");
    }
    return loaded as DetailCoordinatorModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Cannot find module") && message.includes("discussion-detail-read-coordinator")) {
      throw new Error(
        "T011/T012 RED: discussion-detail-read-coordinator public module is not implemented",
      );
    }
    throw error;
  }
};

const event = (input: {
  id: string;
  kind: number;
  pubkey: string;
  content: string;
  tags: string[][];
  createdAt: number;
}): NostrEventDTO => ({
  id: input.id,
  kind: input.kind,
  pubkey: input.pubkey,
  content: input.content,
  tags: input.tags,
  created_at: input.createdAt,
  sig: `${input.id}-signature`,
});

const metadataEvent = event({
  id: "metadata-1",
  kind: 34550,
  pubkey: "author",
  content: "説明",
  tags: [["d", "topic"], ["name", "共有会話"]],
  createdAt: 1,
});
const postEvent = event({
  id: "post-1",
  kind: 1111,
  pubkey: "poster",
  content: "本文",
  tags: [["a", "34550:author:topic"]],
  createdAt: 2,
});
const moderatorRequestEvent = event({
  id: "moderator-request-1",
  kind: 1111,
  pubkey: "applicant",
  content: "申請理由",
  tags: [["a", "34550:author:topic"], ["t", "moderator-request"]],
  createdAt: 3,
});
const approvalEvent = event({
  id: "approval-1",
  kind: 4550,
  pubkey: "moderator",
  content: "",
  tags: [
    ["a", "34550:author:topic"],
    ["e", "post-1"],
    ["p", "poster"],
  ],
  createdAt: 4,
});
const viewerEvaluationEvent = event({
  id: "evaluation-viewer",
  kind: 7,
  pubkey: "viewer",
  content: "+",
  tags: [["a", "34550:author:topic"], ["e", "post-1"]],
  createdAt: 5,
});
const otherEvaluationEvent = event({
  id: "evaluation-other",
  kind: 7,
  pubkey: "other-user",
  content: "-",
  tags: [["a", "34550:author:topic"], ["e", "post-1"]],
  createdAt: 6,
});

const relayUrls = [
  "wss://relay-one.example",
  "wss://relay-two.example",
  "wss://relay-three.example",
];

const result = (
  events: NostrEventDTO[],
  completionReason: ReadCompletionReason = "eose",
  successfulRelayUrl = relayUrls[0],
) => ({
  events,
  completionReason,
  duplicateCount: 0,
  elapsedMs: 1,
  attemptedRelayUrls: relayUrls,
  successfulEventRelayUrls: events.length > 0 ? [successfulRelayUrl] : [],
  sourceRelayUrlsByEventId: Object.fromEntries(
    events.map((item) => [item.id, [successfulRelayUrl]]),
  ),
  attempts: [],
});

const baseInput = (
  onSnapshotCommit?: (snapshot: DetailSnapshot) => void,
): DetailReadInput => ({
  gateway: { queryWithCompletion: jest.fn() },
  discussionId: "34550:author:topic",
  authorPubkey: "author",
  dTag: "topic",
  relayUrls,
  strategy: { idleTimeoutMs: 100, hardTimeoutMs: 300, dedupWindowMs: 0 },
  userPubkey: "viewer",
  onSnapshotCommit,
});

const readDetail = async (
  input: DetailReadInput,
): Promise<DetailReadResult> => {
  const coordinator = loadCoordinator();
  if (typeof coordinator.readDiscussionDetail !== "function") {
    throw new Error(
      "T011/T012 RED: readDiscussionDetail is not a public coordinator export",
    );
  }
  return coordinator.readDiscussionDetail(input);
};

type ReadPlanFilter = {
  kinds?: number[];
  "#a"?: string[];
  "#e"?: string[];
  "#t"?: string[];
  limit?: number;
};

type ReadPlan = {
  target?: string;
  filters?: ReadPlanFilter[];
};

const planFromCall = (call: unknown[]): ReadPlan => {
  const input = call[1] as { plan?: ReadPlan };
  return input.plan ?? {};
};

const phaseFromCall = (call: unknown[]): string => {
  const plan = planFromCall(call);
  const target = plan.target;
  if (target === "discussion-meta") return "metadata";
  if (target === "discussion-evaluations") return "evaluation";
  if (target === "discussion-approvals") return "approval";

  const kinds = plan.filters?.[0]?.kinds ?? [];
  if (kinds.includes(34550)) return "metadata";
  if (kinds.includes(1111) || kinds.includes(1)) return "content";
  if (kinds.includes(4550)) return "approval";
  if (kinds.includes(7)) return "evaluation";
  return "unknown";
};

describe("readDiscussionDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads metadata, content, approval, and evaluation in order before one final snapshot commit", async () => {
    executeNostrRead
      .mockResolvedValueOnce(result([metadataEvent]))
      .mockResolvedValueOnce(result([postEvent, moderatorRequestEvent]))
      .mockResolvedValueOnce(result([approvalEvent]))
      .mockResolvedValueOnce(result([viewerEvaluationEvent, otherEvaluationEvent]));
    const commit = jest.fn<void, [DetailSnapshot]>();

    const readResult = await readDetail(baseInput(commit));

    expect(executeNostrRead).toHaveBeenCalledTimes(4);
    expect(executeNostrRead.mock.calls.map(phaseFromCall)).toEqual([
      "metadata",
      "content",
      "approval",
      "evaluation",
    ]);
    expect(readResult.state).toBe("ready");
    expect(readResult.error).toBeNull();
    expect(readResult.snapshot).toMatchObject({
      discussion: { id: "34550:author:topic", title: "共有会話" },
      posts: [expect.objectContaining({ id: "post-1" })],
      approvals: [expect.objectContaining({ id: "approval-1", postId: "post-1" })],
      evaluations: [
        expect.objectContaining({ id: "evaluation-viewer" }),
        expect.objectContaining({ id: "evaluation-other" }),
      ],
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(readResult.snapshot);
    expect(commit.mock.invocationCallOrder[0]).toBeGreaterThan(
      Math.max(...executeNostrRead.mock.invocationCallOrder),
    );
  });

  it("keeps successful relay provenance scoped to each detail phase and session", async () => {
    executeNostrRead
      .mockResolvedValueOnce(result([metadataEvent], "eose", relayUrls[0]))
      .mockResolvedValueOnce(result([postEvent], "eose", relayUrls[1]))
      .mockResolvedValueOnce(result([approvalEvent], "eose", relayUrls[2]))
      .mockResolvedValueOnce(
        result([viewerEvaluationEvent], "eose", "wss://relay-evaluation.example"),
      );

    const readResult = await readDetail(baseInput());
    const expected = {
      metadata: [relayUrls[0]],
      content: [relayUrls[1]],
      approval: [relayUrls[2]],
      evaluation: ["wss://relay-evaluation.example"],
    };

    expect(readResult.relayProvenance.successfulRelayUrlsByPhase).toEqual(expected);
    expect(readResult.snapshot?.relayProvenance.successfulRelayUrlsByPhase).toEqual(
      expected,
    );
    expect(
      readResult.relayProvenance.successfulRelayUrlsByPhase.metadata,
    ).not.toContain(relayUrls[1]);
  });

  it("keeps known posts in a partial snapshot and does not finalize an unconfirmed approval", async () => {
    executeNostrRead
      .mockResolvedValueOnce(result([metadataEvent]))
      .mockResolvedValueOnce(result([postEvent]))
      .mockResolvedValueOnce(result([], "idle-timeout"))
      .mockResolvedValueOnce(result([viewerEvaluationEvent], "idle-timeout"));

    const readResult = await readDetail(baseInput());

    expect(readResult.state).toBe("partial");
    expect(readResult.snapshot?.posts).toEqual([
      expect.objectContaining({ id: "post-1", approvalState: "unknown" }),
    ]);
    expect(readResult.snapshot?.approvals).toEqual([]);
    expect(readResult.error).toBeNull();
    expect(readResult.relayProvenance.successfulRelayUrlsByPhase).toEqual({
      metadata: [relayUrls[0]],
      content: [relayUrls[0]],
      approval: [],
      evaluation: [relayUrls[0]],
    });
  });

  it("returns an error state when a phase rejects instead of committing a ready snapshot", async () => {
    executeNostrRead
      .mockResolvedValueOnce(result([metadataEvent]))
      .mockRejectedValueOnce(new Error("content relay failed"));
    const commit = jest.fn<void, [DetailSnapshot]>();

    const readResult = await readDetail(baseInput(commit));

    expect(readResult.state).toBe("error");
    expect(readResult.error).toContain("content relay failed");
    expect(commit).not.toHaveBeenCalled();
    expect(executeNostrRead).toHaveBeenCalledTimes(2);
    expect(readResult.relayProvenance.successfulRelayUrlsByPhase).toEqual({
      metadata: [relayUrls[0]],
    });
  });

  it("separates moderator requests from posts and derives viewer evaluation IDs from evaluations", async () => {
    executeNostrRead
      .mockResolvedValueOnce(result([metadataEvent]))
      .mockResolvedValueOnce(result([postEvent, moderatorRequestEvent]))
      .mockResolvedValueOnce(result([approvalEvent]))
      .mockResolvedValueOnce(result([viewerEvaluationEvent, otherEvaluationEvent]));

    const readResult = await readDetail(baseInput());
    const snapshot = readResult.snapshot;

    expect(snapshot?.posts.map((post) => post.id)).toEqual(["post-1"]);
    expect(snapshot?.moderatorRequests.map((request) => request.id)).toEqual([
      "moderator-request-1",
    ]);
    expect(snapshot?.userEvaluationIds).toEqual(new Set(["evaluation-viewer"]));

    const calls = executeNostrRead.mock.calls as unknown[][];
    const plans = calls.map(planFromCall);
    expect(plans).toHaveLength(4);
    expect(calls.map(phaseFromCall)).toEqual([
      "metadata",
      "content",
      "approval",
      "evaluation",
    ]);
    expect(
      plans
        .flatMap((plan) => plan.filters ?? [])
        .some((filter) => filter["#t"]?.includes("moderator-request")),
    ).toBe(false);
    expect(plans[1]?.filters?.[0]).toEqual(
      expect.objectContaining({
        kinds: expect.arrayContaining([1111]),
        "#a": ["34550:author:topic"],
      }),
    );
  });
});
