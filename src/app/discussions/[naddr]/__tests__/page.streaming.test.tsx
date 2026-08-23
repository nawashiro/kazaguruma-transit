import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionDetailPage from "../page";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";
import type {
  Discussion,
  DiscussionPost,
  PostEvaluation,
  PostWithStats,
} from "@/types/discussion";

const mockUseDiscussionMeta = jest.fn();
const mockUseDiscussionContentData = jest.fn();
const mockUseDiscussionDetail = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr-test" }),
  usePathname: () => "/discussions/naddr-test",
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock(
  "@/components/discussion/DiscussionDetailProvider",
  () => ({ useDiscussionDetail: () => mockUseDiscussionDetail() }),
);

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

jest.mock("@/lib/nostr/nostr-read-executor", () => {
  const executeNostrRead = jest.fn();
  return { executeNostrRead, __mock: { executeNostrRead } };
});

const { __mock: discussionReadExecutorMock } = jest.requireMock(
  "@/lib/nostr/nostr-read-executor"
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

const { combinePostsWithStats: combinePostsWithStatsMock } =
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

type DetailSnapshotFixture = {
  discussion: Discussion | null;
  posts: DiscussionPost[];
  approvals: Array<{ id: string; postId: string }>;
  moderatorRequests: Array<{
    id: string;
    applicantPubkey: string;
    createdAt: number;
    reason: string;
    event: NostrEventDTO;
  }>;
  evaluations: PostEvaluation[];
  userEvaluationIds: Set<string>;
};

type DetailModelFixture = {
  state: "loading" | "ready" | "partial" | "error";
  snapshot: DetailSnapshotFixture | null;
  error: string | null;
  reload: jest.Mock;
  addPost: jest.Mock;
  addApproval: jest.Mock;
  removeApproval: jest.Mock;
};

const detailDiscussion: Discussion = {
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
    tags: [["d", "demo"], ["name", "Streamed Discussion"]],
    content: "Streaming description",
    sig: "sig",
  },
};
const detailPost: DiscussionPost = {
  id: "post-1",
  content: "approved post",
  authorPubkey: "author",
  discussionId: "34550:author:demo",
  createdAt: 100,
  approved: true,
  approvalState: "approved",
  event: {
    id: "post-1",
    pubkey: "author",
    kind: 1111,
    created_at: 100,
    tags: [["a", "34550:author:demo"]],
    content: "approved post",
    sig: "sig",
  },
};
const detailEvaluation: PostEvaluation = {
  id: "eval-1",
  postId: "post-1",
  evaluatorPubkey: "u1",
  rating: "+",
  discussionId: "34550:author:demo",
  createdAt: 1,
  event: {
    id: "eval-1",
    pubkey: "u1",
    kind: 7,
    content: "+",
    tags: [["e", "post-1"], ["a", "34550:author:demo"]],
    created_at: 1,
    sig: "sig",
  },
};
const detailSnapshotFixture: DetailSnapshotFixture = {
  discussion: detailDiscussion,
  posts: [detailPost],
  approvals: [],
  moderatorRequests: [],
  evaluations: [detailEvaluation],
  userEvaluationIds: new Set(["eval-1"]),
};
const createDetailModel = (
  overrides: Partial<DetailModelFixture> = {},
): DetailModelFixture => ({
  state: "ready",
  snapshot: detailSnapshotFixture,
  error: null,
  reload: jest.fn(),
  addPost: jest.fn(),
  addApproval: jest.fn(),
  removeApproval: jest.fn(),
  ...overrides,
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

  const withNostrReadResult = (events: any[]) => ({
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
    mockUseDiscussionDetail.mockReturnValue(createDetailModel());
    discussionReadExecutorMock.executeNostrRead.mockResolvedValue(
      withNostrReadResult([]),
    );
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
      completionReason: null,
      reload: jest.fn(),
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
    const loadingText = await screen.findByText("評価データを読み込み中...");
    expect(loadingText).toBeInTheDocument();
    expect(loadingText.closest('[role="status"]')).toHaveAttribute(
      "aria-live",
      "polite",
    );
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

  it("uses evaluations from the final detail snapshot without a page-owned read", async () => {
    mockUseDiscussionContentData.mockReturnValue({
      posts: [detailPost],
      isLoading: false,
      error: null,
      addPost: jest.fn(),
    });
    mockUseDiscussionDetail.mockReturnValue(createDetailModel());

    render(<DiscussionDetailPage />);

    expect(discussionReadExecutorMock.executeNostrRead).not.toHaveBeenCalled();
    expect(gatewayMock.queryWithCompletion).not.toHaveBeenCalled();
    expect(serviceMock.getEvaluations).not.toHaveBeenCalled();
    expect(combinePostsWithStatsMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "post-1", approved: true })],
      [expect.objectContaining({ id: "eval-1", postId: "post-1", rating: "+" })],
    );
    expect(await screen.findByTestId("evaluation-total-post-1")).toHaveTextContent("1");

    expect(screen.getByText("意見グループ")).toBeInTheDocument();
  });

  it("does not restart a page-owned evaluation read when the detail snapshot rerenders", async () => {
    mockUseDiscussionContentData.mockReturnValue({
      posts: [{ id: "post-1", approved: true }],
      isLoading: false,
      error: null,
      addPost: jest.fn(),
    });
    mockUseDiscussionDetail.mockReturnValue(createDetailModel());

    const { rerender } = render(<DiscussionDetailPage />);
    await waitFor(() => expect(screen.getByText("Evaluation Component")).toBeInTheDocument());
    rerender(<DiscussionDetailPage />);

    expect(discussionReadExecutorMock.executeNostrRead).not.toHaveBeenCalled();
    expect(gatewayMock.queryWithCompletion).not.toHaveBeenCalled();
    expect(serviceMock.getEvaluations).not.toHaveBeenCalled();
  });

  it("keeps loading UI while the new detail model is loading (cold start/direct access)", () => {
    mockUseDiscussionDetail.mockReturnValue(
      createDetailModel({ state: "loading" }),
    );
    mockUseDiscussionMeta.mockReturnValue({
      discussion: detailDiscussion,
      isLoading: false,
      completionReason: "eose" as const,
      error: null,
      reload: jest.fn(),
    });

    render(<DiscussionDetailPage />);

    expect(screen.queryByText("会話が見つかりません")).not.toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/読み込み中/);
  });

  it("shows a reload action while preserving posts from a partial content read", async () => {
    const reload = jest.fn();
    mockUseDiscussionDetail.mockReturnValue(
      createDetailModel({ state: "partial" }),
    );
    mockUseDiscussionContentData.mockReturnValue({
      posts: [{ id: "post-1", approved: true }],
      isLoading: false,
      error: null,
      completionReason: "idle-timeout" as const,
      reload,
      addPost: jest.fn(),
    });

    render(<DiscussionDetailPage />);

    const statusText = await screen.findByText(
      "一部のrelayからの取得が完了していません。表示内容は暫定です。",
    );
    expect(statusText.closest('[role="status"]')).not.toBeNull();
    expect(statusText.closest('[role="status"]')).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(screen.getByText("post content post-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not show a content reload status after an EOSE completion", async () => {
    const reload = jest.fn();
    mockUseDiscussionDetail.mockReturnValue(createDetailModel());
    mockUseDiscussionContentData.mockReturnValue({
      posts: [{ id: "post-1", approved: true }],
      isLoading: false,
      error: null,
      completionReason: "eose" as const,
      reload,
      addPost: jest.fn(),
    });

    render(<DiscussionDetailPage />);

    expect(await screen.findByText("post content post-1")).toBeInTheDocument();
    expect(
      screen.queryByText("一部のrelayからの取得が完了していません。表示内容は暫定です。"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "再読み込み" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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

  it("announces a shared detail error and exposes its reload boundary", async () => {
    const reload = jest.fn();
    mockUseDiscussionDetail.mockReturnValue(
      createDetailModel({
        state: "error",
        snapshot: null,
        error: "詳細データの取得に失敗しました。",
        reload,
      }),
    );

    render(<DiscussionDetailPage />);

    const errorTexts = await screen.findAllByText("詳細データの取得に失敗しました。");
    expect(errorTexts).toHaveLength(2);
    for (const errorText of errorTexts) {
      expect(errorText.closest('[role="status"]')).toHaveAttribute(
        "aria-live",
        "polite",
      );
    }
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
