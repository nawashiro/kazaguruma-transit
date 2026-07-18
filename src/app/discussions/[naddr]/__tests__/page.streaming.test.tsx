import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionDetailPage from "../page";

const mockUseDiscussionMeta = jest.fn();
const mockUseDiscussionContentData = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr-test" }),
  usePathname: () => "/discussions/naddr-test",
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
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: "demo",
    authorPubkey: "author",
    discussionId: "34550:author:demo",
  }),
}));

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

jest.mock("@/lib/nostr/nostr-utils", () => ({
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
      tags: [["q", "34550:author:demo"]],
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
  parseEvaluationEvent: jest.fn((event) => ({
    id: event.id,
    postId: event.tags?.find((tag: string[]) => tag[0] === "e")?.[1] || "post-1",
    evaluatorPubkey: event.pubkey,
    rating: "+",
    discussionId: "34550:author:demo",
    createdAt: event.created_at,
    event,
  })),
  combinePostsWithStats: () => [],
  validatePostForm: () => [],
  formatRelativeTime: () => "now",
  getAdminPubkeyHex: () => "admin-pubkey",
}));

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
  EvaluationComponent: () => <div>Evaluation Component</div>,
}));

jest.mock("@/components/discussion/PermissionGuards", () => ({
  ModeratorCheck: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AdminCheck: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("@/components/discussion/LoginModal", () => ({
  __esModule: true,
  LoginModal: () => <div>Login Modal</div>,
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
    eventCount: events.length,
    elapsedMs: 10,
    startedAt: 1000,
    lastEventAt: 1000,
    eoseReceived: true,
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

  it("loads only evaluations after shared posts become available", async () => {
    mockUseDiscussionContentData.mockReturnValue({
      posts: [
        { id: "post-1", approved: true },
        { id: "post-2", approved: true },
      ],
      isLoading: false,
      error: null,
      addPost: jest.fn(),
    });
    gatewayMock.queryWithCompletion.mockImplementation((filters: Array<{ kinds?: number[] }>) => {
      const kinds = filters[0]?.kinds ?? [];
      if (kinds.includes(7)) {
        return Promise.resolve(withCompletion([
          { id: "eval-1", pubkey: "u1", tags: [["e", "post-1"]], created_at: 1 },
          { id: "eval-2", pubkey: "u2", tags: [["e", "post-1"]], created_at: 2 },
          { id: "eval-3", pubkey: "u3", tags: [["e", "post-2"]], created_at: 3 },
          { id: "eval-4", pubkey: "u4", tags: [["e", "post-2"]], created_at: 4 },
          { id: "eval-5", pubkey: "u5", tags: [["e", "post-1"]], created_at: 5 },
        ]));
      }
      return Promise.resolve(withCompletion([]));
    });
    serviceMock.getEvaluations.mockResolvedValue([]);

    render(<DiscussionDetailPage />);

    await waitFor(() =>
      expect(gatewayMock.queryWithCompletion).toHaveBeenCalled()
    );

    // 投稿・承認・メタデータは共有Providerの責務で、ページは評価だけを読む。
    await waitFor(() =>
      expect(gatewayMock.queryWithCompletion).toHaveBeenCalledTimes(1)
    );
    expect(gatewayMock.queryWithCompletion.mock.calls[0][0][0].kinds).toEqual([7]);

    expect(screen.getByText("意見グループ")).toBeInTheDocument();
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

  it("shows timeout warning instead of not-found when metadata read ends by timeout", async () => {
    mockUseDiscussionMeta.mockReturnValue({
      discussion: null,
      isLoading: false,
      completionReason: "idle-timeout" as const,
      error: null,
      reload: jest.fn(),
    });

    render(<DiscussionDetailPage />);

    expect(
      await screen.findByText(/会話データの取得に時間がかかっています/)
    ).toBeInTheDocument();
    expect(screen.queryByText("会話が見つかりません")).not.toBeInTheDocument();
  });
});
