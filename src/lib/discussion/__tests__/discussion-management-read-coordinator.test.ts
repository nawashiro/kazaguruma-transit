import path from "node:path";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";

jest.mock("@/lib/nostr/nostr-read-executor", () => ({
  executeNostrRead: jest.fn(),
}));

const { executeNostrRead } = jest.requireMock(
  "@/lib/nostr/nostr-read-executor",
) as { executeNostrRead: jest.Mock };

const mockPhaseTrace: string[] = [];
jest.mock("@/lib/discussion/discussion-reference-resolver", () => {
  const actual = jest.requireActual<
    typeof import("@/lib/discussion/discussion-reference-resolver")
  >("@/lib/discussion/discussion-reference-resolver");

  return {
    ...actual,
    resolveDiscussionReferences: jest.fn((tags: readonly string[][]) => {
      mockPhaseTrace.push("q-reference");
      return actual.resolveDiscussionReferences(tags);
    }),
  };
});

type CompletionReason = "eose" | "idle-timeout" | "hard-timeout";
type ManagementState = "loading" | "ready" | "partial" | "error";

type ManagementSnapshot = {
  listDiscussion: { id: string; title: string } | null;
  listingPosts: Array<{
    id: string;
    approved?: boolean;
    approvalState?: "approved" | "unapproved" | "unknown";
  }>;
  listingApprovals: Array<{ id: string; postId: string }>;
  referencedDiscussions: Array<{ id: string; title: string }>;
  relayProvenance?: {
    successfulRelayUrlsByPhase: Partial<
      Record<"metadata" | "content" | "approval" | "reference", string[]>
    >;
  };
};

type ManagementReadResult = {
  state: ManagementState;
  snapshot: ManagementSnapshot | null;
  error: string | null;
  relayProvenance: {
    successfulRelayUrlsByPhase: Partial<
      Record<"metadata" | "content" | "approval" | "reference", string[]>
    >;
  };
};

type ManagementReadInput = {
  gateway: { queryWithCompletion: jest.Mock };
  discussionId: string;
  authorPubkey: string;
  dTag: string;
  relayUrls: string[];
  strategy: {
    idleTimeoutMs: number;
    hardTimeoutMs: number;
    dedupWindowMs: number;
  };
  onSnapshotCommit?: (snapshot: ManagementSnapshot) => void;
};

type ManagementCoordinatorModule = {
  readDiscussionManagement?: (
    input: ManagementReadInput,
  ) => Promise<ManagementReadResult>;
};

const coordinatorPath = path.join(
  process.cwd(),
  "src/lib/discussion/discussion-management-read-coordinator",
);

const loadCoordinator = (): ManagementCoordinatorModule => {
  try {
    const loaded = jest.requireActual(coordinatorPath) as unknown;
    if (!loaded || typeof loaded !== "object") {
      throw new Error("The management coordinator module did not export an object");
    }
    return loaded as ManagementCoordinatorModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Cannot find module") &&
      message.includes("discussion-management-read-coordinator")
    ) {
      throw new Error(
        "T025 RED: discussion-management-read-coordinator public module is not implemented",
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

const listAuthor = "a".repeat(64);
const referenceAuthorOne = "b".repeat(64);
const referenceAuthorTwo = "c".repeat(64);
const referenceAuthorPending = "d".repeat(64);
const listDiscussionId = `34550:${listAuthor}:listing`;
const referenceOneId = `34550:${referenceAuthorOne}:topic-one`;
const referenceTwoId = `34550:${referenceAuthorTwo}:topic-two`;
const pendingReferenceId = `34550:${referenceAuthorPending}:pending-topic`;

const listMetadataEvent = event({
  id: "list-metadata-1",
  kind: 34550,
  pubkey: listAuthor,
  content: "掲載対象の投稿を管理する会話",
  tags: [
    ["d", "listing"],
    ["name", "掲載一覧"],
    ["description", "掲載対象"],
  ],
  createdAt: 1,
});
const approvedListingPostOne = event({
  id: "listing-post-1",
  kind: 1111,
  pubkey: "e".repeat(64),
  content: "一件目",
  tags: [
    ["a", listDiscussionId],
    ["q", referenceOneId],
    ["q", referenceOneId],
  ],
  createdAt: 2,
});
const approvedListingPostTwo = event({
  id: "listing-post-2",
  kind: 1111,
  pubkey: "f".repeat(64),
  content: "二件目",
  tags: [
    ["a", listDiscussionId],
    ["q", referenceOneId],
    ["q", referenceTwoId],
  ],
  createdAt: 3,
});
const pendingListingPost = event({
  id: "listing-post-pending",
  kind: 1111,
  pubkey: "1".repeat(64),
  content: "未承認",
  tags: [
    ["a", listDiscussionId],
    ["q", pendingReferenceId],
  ],
  createdAt: 4,
});
const approvalOne = event({
  id: "listing-approval-1",
  kind: 4550,
  pubkey: "2".repeat(64),
  content: "",
  tags: [
    ["a", listDiscussionId],
    ["e", approvedListingPostOne.id],
    ["p", approvedListingPostOne.pubkey],
  ],
  createdAt: 5,
});
const approvalTwo = event({
  id: "listing-approval-2",
  kind: 4550,
  pubkey: "3".repeat(64),
  content: "",
  tags: [
    ["a", listDiscussionId],
    ["e", approvedListingPostTwo.id],
    ["p", approvedListingPostTwo.pubkey],
  ],
  createdAt: 6,
});
const referencedMetadataOne = event({
  id: "reference-metadata-1",
  kind: 34550,
  pubkey: referenceAuthorOne,
  content: "一つ目の説明",
  tags: [["d", "topic-one"], ["name", "参照先一"]],
  createdAt: 7,
});
const referencedMetadataTwo = event({
  id: "reference-metadata-2",
  kind: 34550,
  pubkey: referenceAuthorTwo,
  content: "二つ目の説明",
  tags: [["d", "topic-two"], ["name", "参照先二"]],
  createdAt: 8,
});
// Management keeps pending q references so manage can render them; the public
// page owns visibility filtering for the published list.
const pendingReferencedMetadata = event({
  id: "reference-metadata-pending",
  kind: 34550,
  pubkey: referenceAuthorPending,
  content: "保留中の参照説明",
  tags: [["d", "pending-topic"], ["name", "保留中の参照先"]],
  createdAt: 9,
});

const relayUrls = [
  "wss://relay-one.example",
  "wss://relay-two.example",
  "wss://relay-three.example",
];

const result = (
  events: NostrEventDTO[],
  completionReason: CompletionReason = "eose",
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
  onSnapshotCommit?: (snapshot: ManagementSnapshot) => void,
): ManagementReadInput => ({
  gateway: { queryWithCompletion: jest.fn() },
  discussionId: listDiscussionId,
  authorPubkey: listAuthor,
  dTag: "listing",
  relayUrls,
  strategy: { idleTimeoutMs: 100, hardTimeoutMs: 300, dedupWindowMs: 0 },
  onSnapshotCommit,
});

const phaseFromCall = (call: unknown[]): string => {
  const plan = (
    call[1] as {
      plan?: {
        target?: string;
        filters?: Array<{ kinds?: number[]; authors?: string[]; "#a"?: string[] }>;
      };
    }
  )?.plan;
  const target = plan?.target ?? "";
  const kinds = plan?.filters?.[0]?.kinds ?? [];

  if (target.includes("reference")) return "referenced-metadata";
  if (
    target.includes("list") &&
    !target.includes("content") &&
    !target.includes("approval")
  ) {
    return "list-metadata";
  }
  if (target === "discussion-meta" && kinds.includes(34550)) {
    return "list-metadata";
  }
  if (kinds.includes(1111) || kinds.includes(1) || target.includes("content")) {
    return "listing-content";
  }
  if (kinds.includes(4550) || target.includes("approval")) {
    return "approval";
  }
  if (kinds.includes(34550)) return "referenced-metadata";
  return "unknown";
};

const readManagement = async (
  input: ManagementReadInput,
): Promise<ManagementReadResult> => {
  const coordinator = loadCoordinator();
  if (typeof coordinator.readDiscussionManagement !== "function") {
    throw new Error(
      "T025 RED: readDiscussionManagement is not a public coordinator export",
    );
  }
  return coordinator.readDiscussionManagement(input);
};

describe("readDiscussionManagement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPhaseTrace.length = 0;
  });

  it("reads list metadata, listing content, approval, q references, and referenced metadata in order", async () => {
    executeNostrRead.mockImplementation(async (_gateway: unknown, input: unknown) => {
      const phase = phaseFromCall([null, input]);
      mockPhaseTrace.push(phase);
      switch (phase) {
        case "list-metadata":
          return result([listMetadataEvent]);
        case "listing-content":
          return result([
            approvedListingPostOne,
            approvedListingPostTwo,
            pendingListingPost,
          ]);
        case "approval":
          return result([approvalOne, approvalTwo]);
        case "referenced-metadata":
          return result([
            referencedMetadataOne,
            referencedMetadataTwo,
            pendingReferencedMetadata,
          ]);
        default:
          return result([]);
      }
    });

    const commit = jest.fn<void, [ManagementSnapshot]>();
    const readResult = await readManagement(baseInput(commit));

    expect(executeNostrRead).toHaveBeenCalledTimes(4);
    expect(mockPhaseTrace).toEqual([
      "list-metadata",
      "listing-content",
      "approval",
      "q-reference",
      "referenced-metadata",
    ]);
    expect(readResult.state).toBe("ready");
    expect(readResult.error).toBeNull();
    expect(readResult.snapshot).toMatchObject({
      listDiscussion: { id: listDiscussionId, title: "掲載一覧" },
      listingPosts: expect.arrayContaining([
        expect.objectContaining({ id: approvedListingPostOne.id, approved: true }),
        expect.objectContaining({ id: approvedListingPostTwo.id, approved: true }),
      ]),
      listingApprovals: [
        expect.objectContaining({ id: approvalOne.id, postId: approvedListingPostOne.id }),
        expect.objectContaining({ id: approvalTwo.id, postId: approvedListingPostTwo.id }),
      ],
      referencedDiscussions: [
        expect.objectContaining({ id: referenceOneId, title: "参照先一" }),
        expect.objectContaining({ id: referenceTwoId, title: "参照先二" }),
        expect.objectContaining({
          id: pendingReferenceId,
          title: "保留中の参照先",
        }),
      ],
    });
    expect(readResult.snapshot?.listingPosts).toHaveLength(3);
    expect(readResult.snapshot?.referencedDiscussions).toHaveLength(3);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(readResult.snapshot);
    expect(commit.mock.invocationCallOrder[0]).toBeGreaterThan(
      Math.max(...executeNostrRead.mock.invocationCallOrder),
    );

    const referenceCall = executeNostrRead.mock.calls[3] as unknown[];
    const referencePlan = (
      referenceCall[1] as {
        plan?: { filters?: Array<Record<string, unknown>> };
      }
    ).plan;
    expect(referencePlan?.filters).toHaveLength(3);
    expect(referencePlan?.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ authors: [referenceAuthorOne], "#d": ["topic-one"] }),
        expect.objectContaining({ authors: [referenceAuthorTwo], "#d": ["topic-two"] }),
        expect.objectContaining({
          authors: [referenceAuthorPending],
          "#d": ["pending-topic"],
        }),
      ]),
    );
  });

  it("keeps successful relay provenance scoped to each management phase and session", async () => {
    executeNostrRead.mockImplementation(async (_gateway: unknown, input: unknown) => {
      const phase = phaseFromCall([null, input]);
      switch (phase) {
        case "list-metadata":
          return result([listMetadataEvent], "eose", relayUrls[0]);
        case "listing-content":
          return result([approvedListingPostOne], "eose", relayUrls[1]);
        case "approval":
          return result([approvalOne], "eose", relayUrls[2]);
        case "referenced-metadata":
          return result(
            [referencedMetadataOne],
            "eose",
            "wss://relay-reference.example",
          );
        default:
          return result([]);
      }
    });

    const readResult = await readManagement(baseInput());
    const expected = {
      metadata: [relayUrls[0]],
      content: [relayUrls[1]],
      approval: [relayUrls[2]],
      reference: ["wss://relay-reference.example"],
    };

    expect(readResult.relayProvenance.successfulRelayUrlsByPhase).toEqual(expected);
    expect(readResult.snapshot?.relayProvenance?.successfulRelayUrlsByPhase).toEqual(
      expected,
    );
    expect(
      readResult.relayProvenance.successfulRelayUrlsByPhase.metadata,
    ).not.toContain(relayUrls[1]);
  });

  it("keeps a partial empty listing provisional instead of committing a ready empty list", async () => {
    executeNostrRead.mockImplementation(async () => {
      const callNumber = executeNostrRead.mock.calls.length;
      if (callNumber === 1) return result([listMetadataEvent]);
      if (callNumber === 2) return result([], "idle-timeout");
      return result([]);
    });
    const commit = jest.fn<void, [ManagementSnapshot]>();

    const readResult = await readManagement(baseInput(commit));

    expect(readResult.state).toBe("partial");
    expect(readResult.snapshot).toMatchObject({
      listDiscussion: { id: listDiscussionId },
      listingPosts: [],
      listingApprovals: [],
      referencedDiscussions: [],
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(readResult.snapshot?.listingPosts).toEqual([]);
    expect(readResult.snapshot?.referencedDiscussions).toEqual([]);
    expect(readResult.relayProvenance.successfulRelayUrlsByPhase).toEqual({
      metadata: [relayUrls[0]],
      content: [],
      approval: [],
    });
  });

  it("retains completed phase provenance when a later management phase errors", async () => {
    executeNostrRead
      .mockResolvedValueOnce(result([listMetadataEvent], "eose", relayUrls[0]))
      .mockRejectedValueOnce(new Error("listing content relay failed"));

    const readResult = await readManagement(baseInput());

    expect(readResult.state).toBe("error");
    expect(readResult.error).toContain("listing content relay failed");
    expect(readResult.snapshot).toBeNull();
    expect(readResult.relayProvenance.successfulRelayUrlsByPhase).toEqual({
      metadata: [relayUrls[0]],
    });
  });

  it("keeps caller-provided relay hints on every management phase read", async () => {
    executeNostrRead.mockImplementation(async (_gateway: unknown, input: unknown) => {
      const phase = phaseFromCall([null, input]);
      switch (phase) {
        case "list-metadata":
          return result([listMetadataEvent]);
        case "listing-content":
          return result([approvedListingPostOne]);
        case "approval":
          return result([approvalOne]);
        case "referenced-metadata":
          return result([referencedMetadataOne]);
        default:
          return result([]);
      }
    });

    const relayUrlsWithHint = ["wss://naddr-hint.example", ...relayUrls];
    const readResult = await readManagement({
      ...baseInput(),
      relayUrls: relayUrlsWithHint,
    });

    expect(readResult.state).toBe("ready");
    expect(executeNostrRead).toHaveBeenCalledTimes(4);
    for (const call of executeNostrRead.mock.calls) {
      const transportInput = call[1] as { relayUrls: string[] };
      expect(transportInput.relayUrls).toEqual(relayUrlsWithHint);
    }
  });
});
