import { fireEvent, render, screen } from "@testing-library/react";
import DiscussionsPage from "../page";

const pubkey = "a".repeat(64);
const pendingPubkey = "b".repeat(64);
const pendingDiscussionId = `34550:${pendingPubkey}:pending`;
const mockUseDiscussionManagement = jest.fn();
const mockExecuteNostrRead = jest.fn();
const mockManagementReload = jest.fn();
const mockManagementData = {
  posts: [
    {
      id: "listing-post",
      approved: true,
      approvalState: "approved",
      event: { tags: [["q", `34550:${pubkey}:demo`]] },
    },
    {
      id: "pending-listing-post",
      approved: false,
      approvalState: "unapproved",
      event: { tags: [["q", pendingDiscussionId]] },
    },
  ],
  referencedDiscussions: [
    {
      id: `34550:${pubkey}:demo`,
      authorPubkey: pubkey,
      dTag: "demo",
      title: "共有取得された会話",
      description: "説明",
      moderators: [],
      createdAt: 100,
    },
    {
      id: pendingDiscussionId,
      authorPubkey: pendingPubkey,
      dTag: "pending",
      title: "掲載前の保留会話",
      description: "管理画面だけで参照できる会話",
      moderators: [],
      createdAt: 99,
    },
  ],
  isModerationLoading: false,
  isReferencedDiscussionsLoading: false,
  completionReason: "eose" as "eose" | "idle-timeout",
  referencedDiscussionCompletionReason: "eose" as "eose" | "idle-timeout" | null,
  moderationError: null as string | null,
  reloadModeration: jest.fn(),
};

const createManagementModel = (overrides: Record<string, unknown> = {}) => ({
  state: "ready" as const,
  snapshot: {
    listDiscussion: null,
    listingPosts: [],
    listingApprovals: [],
    referencedDiscussions: [],
  },
  error: null,
  reload: mockManagementReload,
  ...overrides,
});

const projectLegacyManagementData = () => {
  const isPartial = [
    mockManagementData.completionReason,
    mockManagementData.referencedDiscussionCompletionReason,
  ].some((reason) => reason !== null && reason !== "eose");
  const state = mockManagementData.moderationError
    ? "error"
    : mockManagementData.isModerationLoading ||
        mockManagementData.isReferencedDiscussionsLoading
      ? "loading"
      : isPartial
        ? "partial"
        : "ready";

  return createManagementModel({
    state,
    snapshot: {
      listDiscussion: null,
      listingPosts: mockManagementData.posts,
      listingApprovals: [],
      referencedDiscussions: mockManagementData.referencedDiscussions,
    },
    error: mockManagementData.moderationError,
  });
};

const modelApprovedDiscussionId = `34550:${"c".repeat(64)}:approved-model`;
const modelPendingDiscussionId = `34550:${"d".repeat(64)}:pending-model`;
const modelApprovedDiscussion = {
  id: modelApprovedDiscussionId,
  authorPubkey: "c".repeat(64),
  dTag: "approved-model",
  title: "新モデルで承認済みの会話",
  description: "新モデルの公開参照",
  moderators: [],
  createdAt: 200,
};
const modelPendingDiscussion = {
  id: modelPendingDiscussionId,
  authorPubkey: "d".repeat(64),
  dTag: "pending-model",
  title: "新モデルで保留中の会話",
  description: "新モデルの保留参照",
  moderators: [],
  createdAt: 199,
};
const modelApprovedPost = {
  id: "new-model-approved-post",
  approved: true,
  approvalState: "approved" as const,
  event: { tags: [["q", modelApprovedDiscussionId]] },
};
const modelPendingPost = {
  id: "new-model-pending-post",
  approved: false,
  approvalState: "unapproved" as const,
  event: { tags: [["q", modelPendingDiscussionId]] },
};

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ user: { pubkey: "viewer", isLoggedIn: true } }),
}));
jest.mock("@/lib/config/discussion-config", () => ({ isDiscussionsEnabled: () => true }));
jest.mock("@/components/discussion/DiscussionListTabLayout", () => ({
  DiscussionListTabLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock(
  "../../../components/discussion/DiscussionManagementProvider",
  () => ({
    useDiscussionManagement: () => mockUseDiscussionManagement(),
  }),
  { virtual: true },
);
jest.mock("@/lib/nostr/nostr-read-executor", () => ({
  executeNostrRead: mockExecuteNostrRead,
}));
jest.mock("@/lib/nostr/naddr-utils", () => ({ buildNaddrFromDiscussion: () => "naddr1test" }));
jest.mock("@/lib/nostr/nostr-utils", () => ({ formatRelativeTime: () => "たった今" }));

describe("DiscussionsPage shared data", () => {
  beforeEach(() => {
    mockManagementData.posts = [
      {
        id: "listing-post",
        approved: true,
        approvalState: "approved",
        event: { tags: [["q", `34550:${pubkey}:demo`]] },
      },
      {
        id: "pending-listing-post",
        approved: false,
        approvalState: "unapproved",
        event: { tags: [["q", pendingDiscussionId]] },
      },
    ];
    mockManagementData.referencedDiscussions = [{
      id: `34550:${pubkey}:demo`, authorPubkey: pubkey, dTag: "demo", title: "共有取得された会話",
      description: "説明", moderators: [], createdAt: 100,
    }, {
      id: pendingDiscussionId, authorPubkey: pendingPubkey, dTag: "pending", title: "掲載前の保留会話",
      description: "管理画面だけで参照できる会話", moderators: [], createdAt: 99,
    }];
    mockManagementData.completionReason = "eose";
    mockManagementData.referencedDiscussionCompletionReason = "eose";
    mockManagementData.moderationError = null;
    mockManagementData.reloadModeration.mockReset();
    mockUseDiscussionManagement.mockReset();
    mockUseDiscussionManagement.mockImplementation(projectLegacyManagementData);
    mockManagementReload.mockReset();
    mockExecuteNostrRead.mockReset();
  });

  it("announces shared management loading with a polite status", () => {
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({ state: "loading", snapshot: null }),
    );

    render(<DiscussionsPage />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/読み込み中/);
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("renders only approved q references from the new management model", () => {
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({
        snapshot: {
          listDiscussion: null,
          listingPosts: [modelApprovedPost, modelPendingPost],
          listingApprovals: [],
          referencedDiscussions: [modelApprovedDiscussion, modelPendingDiscussion],
        },
      }),
    );

    render(<DiscussionsPage />);
    expect(mockUseDiscussionManagement).toHaveBeenCalledTimes(1);
    expect(screen.getByText("新モデルで承認済みの会話")).toBeInTheDocument();
    expect(screen.queryByText("新モデルで保留中の会話")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /新モデルで承認済みの会話/ })).toHaveAttribute("href", "/discussions/naddr1test");
  });

  it("does not render an empty-state conclusion after a partial referenced-definition read", () => {
    mockManagementData.referencedDiscussions = [];
    mockManagementData.referencedDiscussionCompletionReason = "idle-timeout";
    render(<DiscussionsPage />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("会話一覧を完全に取得できませんでした");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveClass(
      "alert",
      "alert-warning",
      "alert-soft",
      "text-base-content!",
    );
    expect(screen.queryByText("会話がまだありません。")).not.toBeInTheDocument();
  });

  it("offers a reload action for a partial referenced-definition read", () => {
    mockManagementData.referencedDiscussions = [];
    mockManagementData.referencedDiscussionCompletionReason = "idle-timeout";
    render(<DiscussionsPage />);

    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(mockManagementReload).toHaveBeenCalledTimes(1);
  });

  it("does not conclude empty when the primary listing read is partial", () => {
    mockManagementData.posts = [{
      id: "partial-post",
      approved: true,
      approvalState: "unknown",
      event: { tags: [["q", `34550:${pubkey}:missing`]] },
    }];
    mockManagementData.referencedDiscussions = [];
    mockManagementData.completionReason = "idle-timeout";
    mockManagementData.referencedDiscussionCompletionReason = null;
    render(<DiscussionsPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "会話一覧を完全に取得できませんでした",
    );
    expect(screen.queryByText("会話がまだありません。")).not.toBeInTheDocument();
  });

  it("renders a moderation load error as a soft alert with its message", () => {
    mockManagementData.moderationError = "会話一覧の取得に失敗しました。";
    render(<DiscussionsPage />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("会話一覧の取得に失敗しました。");
    expect(status).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers a reload action for a moderation load error", () => {
    mockManagementData.moderationError = "会話一覧の取得に失敗しました。";
    render(<DiscussionsPage />);

    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(mockManagementReload).toHaveBeenCalledTimes(1);
  });

  it("renders a ready empty list from the shared management snapshot", () => {
    mockManagementData.posts = [{
      id: "legacy-only-post",
      approved: true,
      approvalState: "approved",
      event: { tags: [["q", pendingDiscussionId]] },
    }];
    mockManagementData.referencedDiscussions = [{
      id: pendingDiscussionId,
      authorPubkey: pendingPubkey,
      dTag: "pending",
      title: "旧管理データだけの会話",
      description: "新モデルでは表示されない旧データ",
      moderators: [],
      createdAt: 98,
    }];
    mockManagementData.completionReason = "eose";
    mockManagementData.referencedDiscussionCompletionReason = "eose";
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({
        state: "ready",
        snapshot: {
          listDiscussion: {
            id: "management-ready-empty-sentinel",
            title: "新モデルのready空一覧",
          },
          listingPosts: [],
          listingApprovals: [],
          referencedDiscussions: [],
        },
      }),
    );

    render(<DiscussionsPage />);

    expect(mockUseDiscussionManagement).toHaveBeenCalledTimes(1);
    expect(screen.getByText("会話がまだありません。")).toBeInTheDocument();
    expect(screen.queryByText("旧管理データだけの会話")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mockExecuteNostrRead).not.toHaveBeenCalled();
  });

  it("suppresses the empty-list conclusion while the shared management snapshot is partial", () => {
    mockManagementData.posts = [{
      id: "legacy-only-post",
      approved: true,
      approvalState: "approved",
      event: { tags: [["q", pendingDiscussionId]] },
    }];
    mockManagementData.referencedDiscussions = [{
      id: pendingDiscussionId,
      authorPubkey: pendingPubkey,
      dTag: "pending",
      title: "旧管理データだけの会話",
      description: "新モデルでは表示されない旧データ",
      moderators: [],
      createdAt: 98,
    }];
    mockManagementData.completionReason = "eose";
    mockManagementData.referencedDiscussionCompletionReason = "eose";
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({
        state: "partial",
        snapshot: {
          listDiscussion: {
            id: "management-partial-empty-sentinel",
            title: "新モデルのpartial空一覧",
          },
          listingPosts: [],
          listingApprovals: [],
          referencedDiscussions: [],
        },
      }),
    );

    render(<DiscussionsPage />);

    expect(mockUseDiscussionManagement).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "会話一覧を完全に取得できませんでした",
    );
    expect(screen.queryByText("会話がまだありません。")).not.toBeInTheDocument();
    expect(screen.queryByText("旧管理データだけの会話")).not.toBeInTheDocument();
    expect(mockExecuteNostrRead).not.toHaveBeenCalled();
  });

  it("reloads the shared management snapshot instead of a page-owned read", () => {
    mockManagementData.posts = [{
      id: "legacy-only-post",
      approved: true,
      approvalState: "approved",
      event: { tags: [["q", pendingDiscussionId]] },
    }];
    mockManagementData.referencedDiscussions = [{
      id: pendingDiscussionId,
      authorPubkey: pendingPubkey,
      dTag: "pending",
      title: "旧管理データだけの会話",
      description: "新モデルでは表示されない旧データ",
      moderators: [],
      createdAt: 98,
    }];
    mockManagementData.completionReason = "eose";
    mockManagementData.referencedDiscussionCompletionReason = "eose";
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({
        state: "partial",
        snapshot: {
          listDiscussion: {
            id: "management-reload-sentinel",
            title: "新モデルのreload状態",
          },
          listingPosts: [],
          listingApprovals: [],
          referencedDiscussions: [],
        },
      }),
    );

    render(<DiscussionsPage />);
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(mockUseDiscussionManagement).toHaveBeenCalledTimes(1);
    expect(mockManagementReload).toHaveBeenCalledTimes(1);
    expect(mockManagementData.reloadModeration).not.toHaveBeenCalled();
    expect(mockExecuteNostrRead).not.toHaveBeenCalled();
  });
});
