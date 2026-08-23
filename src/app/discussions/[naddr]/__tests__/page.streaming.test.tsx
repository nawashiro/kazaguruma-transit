import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionDetailPage from "../page";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";
import type { PostWithStats } from "@/types/discussion";

const mockUseDiscussionMeta = jest.fn();
const mockUseDiscussionContentData = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr-test" }),
  usePathname: () => "/discussions/naddr-test",
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock DiscussionTabLayout to isolate page logic from layout
jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  DiscussionTabLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="discussion-tab-layout">{children}</div>
  ),
  useDiscussionMeta: () => mockUseDiscussionMeta(),
}));

jest.mock("@/components/discussion/DiscussionContentDataProvider", () => ({
  useDiscussionContentData: () => mockUseDiscussionContentData(),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { pubkey: "viewer", isLoggedIn: true },
    signEvent: jest.fn(),
  }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({
    relays: [
      { url: "wss://configured.example", read: true, write: false },
      { url: "wss://write-only.example", read: false, write: true },
    ],
    defaultTimeout: 500,
  }),
  getDiscussionReadStrategyConfig: () => ({

    idleTimeoutMs: 321,
    hardTimeoutMs: 987,
    dedupWindowMs: 250,
  }),
  DEFAULT_RELAYS: ["wss://default.example"],
}));

jest.mock("@/lib/nostr/naddr-utils", () => {
  const actual = jest.requireActual<typeof import("@/lib/nostr/naddr-utils")>(
    "@/lib/nostr/naddr-utils",
  );

  return {
    ...actual,
    extractDiscussionFromNaddr: jest.fn(() => ({
      dTag: "demo",
      authorPubkey: "author",
      discussionId: "34550:author:demo",
      relays: ["wss://hint.example"],
    })),
    normalizeDiscussionId: jest.fn((value: string) => value),
  };
});

jest.mock("@/lib/nostr/nostr-service", () => {
  const serviceMock = {
    getEvaluations: jest.fn(),
    createPostEvent: jest.fn(),
    createEvaluationEvent: jest.fn(),
    publishSignedEvent: jest.fn(),
  };

  return {
    createNostrService: () => serviceMock,
    __mock: serviceMock,
  };
});

const { __mock: serviceMock } = jest.requireMock("@/lib/nostr/nostr-service");

jest.mock("@/lib/nostr/discussion-ndk-gateway", () => {
  const gatewayMock = {
    queryWithCompletion: jest.fn(),
  };
  return {
    createDiscussionNdkGateway: () => gatewayMock,
    __mock: gatewayMock,
  };
});

const { __mock: gatewayMock } = jest.requireMock(
  "@/lib/nostr/discussion-ndk-gateway"
);

jest.mock("@/lib/discussion/discussion-known-data-cache", () => ({
  loadKnownDiscussionData: jest.fn(),
}));

const { loadKnownDiscussionData: loadKnownDiscussionDataMock } = jest.requireMock(
  "@/lib/discussion/discussion-known-data-cache"
);

jest.mock("@/lib/discussion/discussion-read-executor", () => {
  const executeDiscussionRead = jest.fn();
  return { executeDiscussionRead, __mock: { executeDiscussionRead } };
});

const { __mock: discussionReadExecutorMock } = jest.requireMock(
  "@/lib/discussion/discussion-read-executor"
);

jest.mock("@/lib/nostr/nostr-utils", () => {
  const actual = jest.requireActual<typeof import("@/lib/nostr/nostr-utils")>(
    "@/lib/nostr/nostr-utils",
  );

  return {
    ...actual,
    parseDiscussionEvent: jest.fn((event) => ({
      id: `34550:${event.pubkey}:${event.tags?.find((tag: string[]) => tag[0] === "d")?.[1] || ""}`,
      title: event.tags?.find((tag: string[]) => tag[0] === "name")?.[1] || "Untitled",
      description: event.content,
      authorPubkey: event.pubkey,
      dTag: event.tags?.find((tag: string[]) => tag[0] === "d")?.[1] || "",
      moderators: [],
      createdAt: event.created_at,
      event,
    })),
    parsePostEvent: jest.fn((_post, approvals) => ({
      id: approvals[0]?.postId || "post-1",
      content: "approved post",
      authorPubkey: "author",
      discussionId: "34550:author:demo",
      createdAt: approvals[0]?.createdAt || 100,
      approved: true,
      event: {
        id: "post-event",
        pubkey: "author",
        kind: 1,
        created_at: 100,
        tags: [["a", "34550:author:demo"]],
        content: "post",
        sig: "sig",
      },
    })),
    parseApprovalEvent: jest.fn((event) => ({
      id: event.id,
      postId: event.tags?.find((tag: string[]) => tag[0] === "e")?.[1] || "post-1",
      postAuthorPubkey: "author",
      moderatorPubkey: "mod",
      discussionId: "34550:author:demo",
      createdAt: event.created_at,
      event,
    })),
    // Keep the page-level call observable while exercising the real NIP-25 parser.
    parseEvaluationEvent: jest.fn((event) => actual.parseEvaluationEvent(event)),
    combinePostsWithStats: jest.fn(
      (posts: Array<{ id: string; approved?: boolean }>, evaluations: Array<{ id: string; postId: string; rating: "+" | "-" }>): PostWithStats[] =>
        posts.map((post) => {
          const postEvaluations = evaluations.filter((evaluation) => evaluation.postId === post.id);
          const positive = postEvaluations.filter((evaluation) => evaluation.rating === "+").length;
          const negative = postEvaluations.filter((evaluation) => evaluation.rating === "-").length;
          const total = positive + negative;
          return {
            ...post,
            content: `post content ${post.id}`,
            authorPubkey: "author",
            discussionId: "34550:author:demo",
            createdAt: 100,
            approved: post.approved ?? true,
            event: {
              id: post.id,
              pubkey: "author",
              kind: 1111,
              created_at: 100,
              tags: [["a", "34550:author:demo"]],
              content: `post content ${post.id}`,
              sig: "sig",
            },
            evaluationStats: {
              positive,
              negative,
              total,
              score: total > 0 ? (positive - negative) / total : 0,
            },
            evaluationIds: postEvaluations.map((evaluation) => evaluation.id),
          } as PostWithStats & { evaluationIds: string[] };
        }),
    ),
    validatePostForm: () => [],
    formatRelativeTime: () => "now",
    getAdminPubkeyHex: () => "admin-pubkey",
  };
});

const { parseEvaluationEvent: parseEvaluationEventMock, combinePostsWithStats: combinePostsWithStatsMock } =
  jest.requireMock("@/lib/nostr/nostr-utils");

jest.mock("@/lib/test/test-data-loader", () => ({
  isTestMode: () => false,
  loadTestData: () => ({}),
}));

jest.mock("@/lib/evaluation/evaluation-service", () => ({
  evaluationService: {
    analyzeConsensus: jest
      .fn()
      .mockResolvedValue({ groupAwareConsensus: [], groupRepresentativeComments: [] }),
  },
}));

global.fetch = jest.fn().mockResolvedValue({
  json: jest.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
});

jest.mock("@/components/discussion/EvaluationComponent", () => ({
  __esModule: true,
  EvaluationComponent: ({
    posts,
  }: {
    posts: PostWithStats[];
  }) => (
    <div data-testid="evaluation-component">
      <span>Evaluation Component</span>
      {posts.map((post) => (
        <article key={post.id} data-testid={`evaluation-post-${post.id}`}>
          <span>{post.content}</span>
          <span data-testid={`evaluation-total-${post.id}`}>
            {post.evaluationStats.total}
          </span>
        </article>
      ))}
    </div>
  ),
}));

jest.mock("@/components/discussion/PermissionGuards", () => ({
  ModeratorCheck: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AdminCheck: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("@/components/discussion/PostPreview", () => ({
  __esModule: true,
  PostPreview: () => <div>Post Preview</div>,
}));

jest.mock("@/components/ui/Button", () => {
  return function MockButton({ children, ...props }: any) {
    return <button {...props}>{children}</button>;
  };
});

describe("DiscussionDetailPage streaming", () => {
  const withCompletion = (events: any[]) => ({
    events,
    completionReason: "eose",
    duplicateCount: 0,
    eventCount: events.length,
    elapsedMs: 10,
    startedAt: 1000,
    lastEventAt: 1000,
    eoseReceived: true,
    relayUrls: [],
    sourceRelayUrlsByEventId: {},
  });

  const withDiscussionReadResult = (events: any[]) => ({
    events,
    completionReason: "eose",
    duplicateCount: 0,
    elapsedMs: 10,
    attemptedRelayUrls: [
      "wss://hint.example",
      "wss://successful.example",
      "wss://configured.example",
      "wss://default.example",
    ],
    successfulEventRelayUrls: ["wss://successful.example"],
    sourceRelayUrlsByEventId: Object.fromEntries(
      events.map((event) => [event.id, ["wss://successful.example"]]),
    ),
    attempts: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDiscussionMeta.mockReturnValue({
      discussion: {
        id: "34550:author:demo",
        title: "Streamed Discussion",
        description: "Streaming description",
        authorPubkey: "author",
        dTag: "demo",
        moderators: [],
        createdAt: 999,
        event: {
          id: "discussion-1",
          pubkey: "author",
          kind: 34550,
          created_at: 999,
          tags: [
            ["d", "demo"],
            ["name", "Streamed Discussion"],
          ],
          content: "Streaming description",
          sig: "sig",
        },
      },
      isLoading: false,
      completionReason: "eose" as const,
      error: null,
      reload: jest.fn(),
    });
    mockUseDiscussionContentData.mockReturnValue({
      posts: [],
      isLoading: false,
      error: null,
      addPost: jest.fn(),
    });
  });

  it("shows loading state until the shared content read completes", async () => {
    mockUseDiscussionContentData.mockReturnValue({
      posts: [],
      isLoading: true,
      error: null,
      addPost: jest.fn(),
    });
    gatewayMock.queryWithCompletion.mockResolvedValue(withCompletion([]));
    serviceMock.getEvaluations.mockResolvedValue([]);

    const { rerender } = render(<DiscussionDetailPage />);

    // Title is now displayed in the layout, not in page content
    // Check for loading state instead to verify streaming works
    expect(
      await screen.findByText("評価データを読み込み中...")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Evaluation Component")
    ).not.toBeInTheDocument();

    mockUseDiscussionContentData.mockReturnValue({
      posts: [],
      isLoading: false,
      error: null,
      addPost: jest.fn(),
    });
    rerender(<DiscussionDetailPage />);

    await waitFor(() =>
      expect(
        screen.queryByText("評価データを読み込み中...")
      ).not.toBeInTheDocument()
    );
    expect(screen.getByText("Evaluation Component")).toBeInTheDocument();
  });

  it("loads evaluations through the executor with the complete read contract", async () => {
    mockUseDiscussionContentData.mockReturnValue({
      posts: [
        { id: "post-1", approved: true },
      ],
      isLoading: false,
      error: null,
      addPost: jest.fn(),
    });
    const evaluationEvent: NostrEventDTO = {
      id: "eval-1",
      pubkey: "u1",
      kind: 7,
      content: "+",
      tags: [["e", "post-1"], ["a", "34550:author:demo"]],
      created_at: 1,
      sig: "sig",
    };
    loadKnownDiscussionDataMock.mockReturnValue({
      version: 1,
      savedAt: Date.now(),
      metadata: null,
      eventIds: [],
      attemptedRelayUrls: ["wss://old-attempt.example"],
      successfulEventRelayUrls: ["wss://successful.example"],
      successfulRelays: [],
    });
    discussionReadExecutorMock.executeDiscussionRead.mockResolvedValue(
      withDiscussionReadResult([evaluationEvent]),
    );
    gatewayMock.queryWithCompletion.mockRejectedValue(
      new Error("evaluation reads must not call the gateway from the page"),
    );
    serviceMock.getEvaluations.mockResolvedValue([]);

    render(<DiscussionDetailPage />);

    await waitFor(() =>
      expect(discussionReadExecutorMock.executeDiscussionRead).toHaveBeenCalledWith(
        gatewayMock,
        expect.objectContaining({
          plan: {
            target: "discussion-evaluations",
            filters: [
              {
                kinds: [7],
                "#e": ["post-1"],
                limit: 100,
              },
            ],
            idleTimeoutMs: 321,
            hardTimeoutMs: 987,
          },
          relayUrls: [
            "wss://hint.example",
            "wss://successful.example",
            "wss://configured.example",
            "wss://default.example",
          ],
        }),
      ),
    );

    expect(gatewayMock.queryWithCompletion).not.toHaveBeenCalled();
    expect(parseEvaluationEventMock).toHaveBeenCalledWith(evaluationEvent);
    expect(combinePostsWithStatsMock).toHaveBeenCalledWith(
      [{ id: "post-1", approved: true }],
      [expect.objectContaining({ id: "eval-1", postId: "post-1" })],
    );
    expect(await screen.findByTestId("evaluation-total-post-1")).toHaveTextContent("1");

    expect(screen.getByText("意見グループ")).toBeInTheDocument();
  });

  it("ignores a stale evaluation read after the posts generation changes", async () => {
    let currentPosts: Array<{ id: string; approved: boolean }> = [
      { id: "post-1", approved: true },
    ];
    const firstEvaluationEvent: NostrEventDTO = {
      id: "eval-1",
      pubkey: "u1",
      kind: 7,
      content: "+",
      tags: [["e", "post-1"], ["a", "34550:author:demo"]],
      created_at: 1,
      sig: "sig",
    };
    const secondEvaluationEvent: NostrEventDTO = {
      id: "eval-2",
      pubkey: "u2",
      kind: 7,
      content: "+",
      tags: [["e", "post-2"], ["a", "34550:author:demo"]],
      created_at: 2,
      sig: "sig",
    };
    type ReadResult = ReturnType<typeof withDiscussionReadResult>;
    let resolveFirst!: (result: ReadResult) => void;
    const firstRead = new Promise<ReadResult>((resolve) => {
      resolveFirst = resolve;
    });

    mockUseDiscussionContentData.mockImplementation(() => ({
      posts: currentPosts,
      isLoading: false,
      error: null,
      addPost: jest.fn(),
    }));
    loadKnownDiscussionDataMock.mockReturnValue({
      version: 1,
      savedAt: Date.now(),
      metadata: null,
      eventIds: [],
      attemptedRelayUrls: [],
      successfulEventRelayUrls: [],
      successfulRelays: [],
    });
    serviceMock.getEvaluations.mockResolvedValue([]);

    // The executor sequence is the contract under test. The gateway sequence
    // keeps this stale-result assertion isolated from the separate migration
    // RED that verifies the page no longer calls the gateway directly.
    discussionReadExecutorMock.executeDiscussionRead
      .mockImplementationOnce(() => firstRead)
      .mockResolvedValueOnce(withDiscussionReadResult([secondEvaluationEvent]));
    gatewayMock.queryWithCompletion
      .mockImplementationOnce(() => firstRead)
      .mockResolvedValueOnce(withDiscussionReadResult([secondEvaluationEvent]));

    const { rerender } = render(<DiscussionDetailPage />);

    currentPosts = [{ id: "post-2", approved: true }];
    rerender(<DiscussionDetailPage />);

    expect(
      await screen.findByTestId("evaluation-total-post-2"),
    ).toHaveTextContent("1");
    expect(
      parseEvaluationEventMock.mock.calls.map((call: unknown[]) => call[0]),
    ).toEqual([secondEvaluationEvent]);

    await act(async () => {
      resolveFirst(withDiscussionReadResult([firstEvaluationEvent]));
      await firstRead;
    });

    expect(
      parseEvaluationEventMock.mock.calls.map((call: unknown[]) => call[0]),
    ).toEqual([secondEvaluationEvent]);
    expect(parseEvaluationEventMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("evaluation-total-post-1")).not.toBeInTheDocument();
  });

  it("keeps loading UI while metadata read is in progress (cold start/direct access)", () => {
    mockUseDiscussionMeta.mockReturnValue({
      discussion: null,
      isLoading: true,
      completionReason: null,
      error: null,
      reload: jest.fn(),
    });

    render(<DiscussionDetailPage />);

    expect(screen.queryByText("会話が見つかりません")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows timeout warning as a polite soft status instead of not-found", async () => {
    const reload = jest.fn();
    mockUseDiscussionMeta.mockReturnValue({
      discussion: null,
      isLoading: false,
      completionReason: "idle-timeout" as const,
      error: null,
      reload,
    });

    render(<DiscussionDetailPage />);

    const warningText = await screen.findByText(/会話データの取得に時間がかかっています/);
    const status = warningText.closest<HTMLElement>('[role="status"]');
    expect(status).not.toBeNull();
    if (!status) {
      throw new Error('Expected the metadata timeout to be rendered as a status');
    }
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveClass(
      "alert",
      "alert-warning",
      "alert-soft",
      "text-base-content!",
    );
    expect(status).toHaveTextContent(/会話データの取得に時間がかかっています/);
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
    expect(screen.queryByText("会話が見つかりません")).not.toBeInTheDocument();
  });
});
