import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionDetailPage from "../page";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
  PostEvaluation,
  PostWithStats,
} from "@/types/discussion";
import type { DiscussionDetailModel } from "@/components/discussion/DiscussionDetailProvider";

const mockUseDiscussionMeta = jest.fn();
const mockUseDiscussionDetail = jest.fn();
const mockRouterPush = jest.fn();
const mockSignEvent = jest.fn();
const mockAuthUser: { pubkey: string | null; isLoggedIn: boolean } = {
  pubkey: "viewer",
  isLoggedIn: true,
};
const mockValidatePostForm = jest.fn<string[], [unknown]>(() => []);
const mockAnalyzeConsensus = jest.fn().mockResolvedValue({
  groupAwareConsensus: [],
  groupRepresentativeComments: [],
});

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr-test" }),
  usePathname: () => "/discussions/naddr-test",
  useRouter: () => ({ push: mockRouterPush }),
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

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: mockAuthUser,
    signEvent: mockSignEvent,
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
    validatePostForm: (formData: unknown) => mockValidatePostForm(formData),
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
    analyzeConsensus: (...args: unknown[]) => mockAnalyzeConsensus(...args),
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
    onEvaluate,
  }: {
    posts: PostWithStats[];
    onEvaluate: (postId: string, rating: "+" | "-") => Promise<void>;
  }) => (
    <div data-testid="evaluation-component">
      <span>Evaluation Component</span>
      <button
        type="button"
        aria-label="評価する"
        onClick={() => void onEvaluate("post-1", "+")}
      >
        評価する
      </button>
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
  PostPreview: ({
    onConfirm,
    onCancel,
  }: {
    onConfirm: () => void;
    onCancel: () => void;
  }) => (
    <div>
      Post Preview
      <button type="button" onClick={onCancel}>
        編集に戻る
      </button>
      <button type="button" onClick={onConfirm}>
        投稿を確定
      </button>
    </div>
  ),
}));

jest.mock("@/components/ui/Button", () => {
  return function MockButton({ children, ...props }: any) {
    return <button {...props}>{children}</button>;
  };
});

type DetailSnapshotFixture = {
  discussion: Discussion | null;
  posts: DiscussionPost[];
  approvals: PostApproval[];
  moderatorRequests: Array<{
    id: string;
    applicantPubkey: string;
    createdAt: number;
    reason: string;
    event: NostrEventDTO;
  }>;
  evaluations: PostEvaluation[];
  userEvaluationIds: Set<string>;
  relayProvenance: {
    successfulRelayUrlsByPhase: Partial<
      Record<"metadata" | "content" | "approval" | "evaluation", string[]>
    >;
  };
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
  relayProvenance: { successfulRelayUrlsByPhase: {} },
};
const createDetailModel = (
  overrides: Partial<DiscussionDetailModel> = {},
): DiscussionDetailModel => ({
  state: "ready",
  snapshot: detailSnapshotFixture,
  error: null,
  completionReason: "eose",
  relayProvenance: detailSnapshotFixture.relayProvenance,
  isFallback: false,
  reload: jest.fn(async () => undefined),
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
    // The route fixture is supplied only by the public detail model.
    mockUseDiscussionMeta.mockReturnValue(undefined);
  });

  it("shows loading state until the detail snapshot completes", async () => {
    mockUseDiscussionDetail.mockReturnValue(
      createDetailModel({ state: "loading" }),
    );
    gatewayMock.queryWithCompletion.mockResolvedValue(withCompletion([]));
    serviceMock.getEvaluations.mockResolvedValue([]);

    const { rerender } = render(<DiscussionDetailPage />);

    const loadingText = await screen.findByText("会話データを読み込み中...");
    expect(loadingText).toBeInTheDocument();
    expect(loadingText.closest('[role="status"]')).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(
      screen.queryByText("Evaluation Component")
    ).not.toBeInTheDocument();

    mockUseDiscussionDetail.mockReturnValue(createDetailModel());
    rerender(<DiscussionDetailPage />);

    await waitFor(() =>
      expect(
        screen.queryByText("評価データを読み込み中...")
      ).not.toBeInTheDocument()
    );
    expect(screen.getByText("Evaluation Component")).toBeInTheDocument();
  });

  it("uses evaluations from the final detail snapshot without a page-owned read", async () => {
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

    render(<DiscussionDetailPage />);

    expect(screen.queryByText("会話が見つかりません")).not.toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/読み込み中/);
  });

  it("shows a reload action while preserving posts from a partial content read", async () => {
    const reload = jest.fn();
    mockUseDiscussionDetail.mockReturnValue(
      createDetailModel({
        state: "partial",
        completionReason: "idle-timeout",
        reload,
      }),
    );

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
    mockUseDiscussionDetail.mockReturnValue(
      createDetailModel({ reload }),
    );

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
    mockUseDiscussionDetail.mockReturnValue(
      createDetailModel({
        state: "partial",
        snapshot: null,
        completionReason: "idle-timeout",
        reload,
      }),
    );

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
    expect(errorTexts).toHaveLength(1);
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

describe("DiscussionDetailPage unauthenticated public actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser.pubkey = null;
    mockAuthUser.isLoggedIn = false;
    mockUseDiscussionDetail.mockReturnValue(createDetailModel());
    mockUseDiscussionMeta.mockReturnValue(undefined);
    mockValidatePostForm.mockReturnValue([]);
  });

  afterEach(() => {
    mockAuthUser.pubkey = "viewer";
    mockAuthUser.isLoggedIn = true;
  });

  it("renders post validation errors as an assertive soft alert list", async () => {
    mockAuthUser.pubkey = "authenticated-user";
    mockAuthUser.isLoggedIn = true;
    mockValidatePostForm.mockReturnValue(["投稿内容の検証に失敗しました。"]);

    render(<DiscussionDetailPage />);

    fireEvent.change(await screen.findByRole("textbox", { name: /投稿内容/ }), {
      target: { value: "投稿本文" },
    });
    fireEvent.click(screen.getByRole("button", { name: "プレビュー" }));
    fireEvent.click(await screen.findByRole("button", { name: "投稿を確定" }));
    fireEvent.click(screen.getByRole("button", { name: "編集に戻る" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
    expect(alert.querySelector("ul")).not.toBeNull();
    expect(alert).toHaveTextContent("投稿内容の検証に失敗しました。");
  });

  it("routes an unauthenticated post action to login without opening a modal or signing", async () => {
    const view = render(<DiscussionDetailPage />);

    fireEvent.change(await screen.findByRole("textbox", { name: /投稿内容/ }), {
      target: { value: "投稿本文" },
    });
    fireEvent.click(screen.getByRole("button", { name: "プレビュー" }));
    fireEvent.click(await screen.findByRole("button", { name: "投稿を確定" }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledTimes(1);
    });
    const target = new URL(
      mockRouterPush.mock.calls[0][0] as string,
      "https://kazaguruma.invalid",
    );
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("returnTo")).toBe("/discussions/naddr-test");
    expect(target.searchParams.get("reason")).toBe(
      "投稿するにはログインが必要です。",
    );
    expect(target.searchParams.has("action")).toBe(false);
    expect(target.searchParams.has("payload")).toBe(false);
    expect(target.searchParams.has("draft")).toBe(false);
    expect(screen.queryByTestId("login-modal")).not.toBeInTheDocument();
    expect(mockSignEvent).not.toHaveBeenCalled();
    expect(serviceMock.publishSignedEvent).not.toHaveBeenCalled();
    expect(serviceMock.createPostEvent).not.toHaveBeenCalled();
    expect(mockAnalyzeConsensus).not.toHaveBeenCalled();

    mockAuthUser.pubkey = "authenticated-user";
    mockAuthUser.isLoggedIn = true;
    view.rerender(<DiscussionDetailPage />);
    await waitFor(() => {
      expect(mockSignEvent).not.toHaveBeenCalled();
      expect(serviceMock.createPostEvent).not.toHaveBeenCalled();
      expect(serviceMock.publishSignedEvent).not.toHaveBeenCalled();
    });
  });

  it("routes an unauthenticated evaluation action to login without evaluation side effects", async () => {
    const view = render(<DiscussionDetailPage />);

    fireEvent.click(await screen.findByRole("button", { name: "評価する" }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledTimes(1);
    });
    const target = new URL(
      mockRouterPush.mock.calls[0][0] as string,
      "https://kazaguruma.invalid",
    );
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("returnTo")).toBe("/discussions/naddr-test");
    expect(target.searchParams.get("reason")).toBe(
      "投稿を評価するにはログインが必要です。",
    );
    expect(target.searchParams.has("action")).toBe(false);
    expect(target.searchParams.has("payload")).toBe(false);
    expect(target.searchParams.has("draft")).toBe(false);
    expect(screen.queryByTestId("login-modal")).not.toBeInTheDocument();
    expect(mockSignEvent).not.toHaveBeenCalled();
    expect(serviceMock.publishSignedEvent).not.toHaveBeenCalled();
    expect(serviceMock.createEvaluationEvent).not.toHaveBeenCalled();
    expect(mockAnalyzeConsensus).not.toHaveBeenCalled();

    mockAuthUser.pubkey = "authenticated-user";
    mockAuthUser.isLoggedIn = true;
    view.rerender(<DiscussionDetailPage />);
    await waitFor(() => {
      expect(mockSignEvent).not.toHaveBeenCalled();
      expect(serviceMock.createEvaluationEvent).not.toHaveBeenCalled();
      expect(serviceMock.publishSignedEvent).not.toHaveBeenCalled();
    });
  });

  it("renders post read errors as soft alert content", async () => {
    mockUseDiscussionDetail.mockReturnValue(
      createDetailModel({ error: "投稿・評価データの取得に失敗しました。" }),
    );

    render(<DiscussionDetailPage />);

    const errorTexts = await screen.findAllByText(
      "投稿・評価データの取得に失敗しました。",
    );
    expect(errorTexts.length).toBeGreaterThan(0);
    for (const errorText of errorTexts) {
      const postsStatus = errorText.closest<HTMLElement>('[role="status"]');
      expect(postsStatus).not.toBeNull();
      if (!postsStatus) {
        throw new Error(
          "Expected the post read error to be rendered in a status container",
        );
      }
      expect(postsStatus).toHaveAttribute("aria-live", "polite");
      expect(postsStatus).toHaveClass(
        "alert",
        "alert-error",
        "alert-soft",
        "text-base-content!",
      );
      expect(postsStatus).toHaveTextContent(
        "投稿・評価データの取得に失敗しました。",
      );
    }
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
