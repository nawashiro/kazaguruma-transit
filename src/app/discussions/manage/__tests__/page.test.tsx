import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionManagePage from "../page";

const mockUseAuth = jest.fn();
const mockUseDiscussionMeta = jest.fn();
const mockUseDiscussionManagement = jest.fn();
const mockExecuteNostrRead = jest.fn();
const mockManagementReload = jest.fn();
const mockDiscussionMetaReload = jest.fn();
const mockLegacyManagementReload = jest.fn();
const mockDiscussion = {
  id: "34550:author:discussion-d-tag",
  authorPubkey: "author",
  dTag: "discussion-d-tag",
  moderators: [{ pubkey: "moderator" }],
  createdAt: 1,
  title: "Title",
  description: "desc",
};
const managementModelDiscussion = {
  ...mockDiscussion,
  title: "新管理モデルの掲載会話",
};

const createManagementModel = (overrides: Record<string, unknown> = {}) => ({
  state: "ready" as const,
  snapshot: {
    listDiscussion: managementModelDiscussion,
    listingPosts: [],
    listingApprovals: [],
    referencedDiscussions: [],
  },
  error: null,
  reload: mockManagementReload,
  ...overrides,
});

const legacyOnlyDiscussion = {
  id: `34550:${"e".repeat(64)}:legacy-management-only`,
  authorPubkey: "e".repeat(64),
  dTag: "legacy-management-only",
  moderators: [],
  createdAt: 0,
  title: "旧管理データだけの投稿",
  description: "新しい管理モデルでは表示されない投稿",
};
const legacyOnlyPost = {
  id: "legacy-pending-post",
  content: "legacy pending post",
  authorPubkey: "legacy-poster",
  discussionId: mockDiscussion.id,
  createdAt: 2,
  approved: false,
  approvedBy: [],
  approvalState: "unapproved" as const,
  event: {
    id: "legacy-pending-post",
    pubkey: "legacy-poster",
    created_at: 2,
    kind: 1111,
    tags: [["a", mockDiscussion.id], ["q", legacyOnlyDiscussion.id]],
    content: "legacy pending post",
    sig: "legacy-sig",
  },
};
const legacyReadyManagementData = {
  posts: [legacyOnlyPost],
  approvals: [],
  referencedDiscussions: [legacyOnlyDiscussion],
  isModerationLoading: false,
  referencedDiscussionCompletionReason: "eose" as const,
  completionReason: "eose" as const,
  approvalState: "approved" as const,
  moderationError: null,
  reloadModeration: mockLegacyManagementReload,
  addApproval: jest.fn(),
  removeApproval: jest.fn(),
};
const legacyApprovedPost = {
  id: "post-approved",
  content: "approved post",
  authorPubkey: "poster",
  discussionId: mockDiscussion.id,
  createdAt: 2,
  approved: true,
  approvedBy: ["other-moderator"],
  approvalState: "approved" as const,
  event: {
    id: "post-approved",
    pubkey: "poster",
    created_at: 2,
    kind: 1111,
    tags: [["a", mockDiscussion.id], ["q", "34550:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:tag"]],
    content: "approved post",
    sig: "sig",
  },
};
const defaultLegacyManagementData = {
  posts: [legacyApprovedPost],
  approvals: [
    {
      id: "approval-event",
      postId: "post-approved",
      moderatorPubkey: "other-moderator",
    },
  ],
  referencedDiscussions: [],
  isModerationLoading: false,
  referencedDiscussionCompletionReason: "hard-timeout" as const,
  completionReason: "eose" as const,
  approvalState: "approved" as const,
  moderationError: null,
  reloadModeration: mockLegacyManagementReload,
  addApproval: jest.fn(),
  removeApproval: jest.fn(),
};
const mockLegacyManagementData = jest.fn(
  () => defaultLegacyManagementData as
    | typeof defaultLegacyManagementData
    | typeof legacyReadyManagementData,
);

const projectLegacyManagementData = () => {
  const legacyData = mockLegacyManagementData();
  const isPartial = [
    legacyData.completionReason,
    legacyData.referencedDiscussionCompletionReason,
  ].some((reason) => reason !== null && reason !== "eose");
  const state = legacyData.moderationError
    ? "error"
    : legacyData.isModerationLoading
      ? "loading"
      : isPartial
        ? "partial"
        : "ready";

  return createManagementModel({
    state,
    snapshot: {
      listDiscussion: mockDiscussion,
      listingPosts: legacyData.posts,
      listingApprovals: legacyData.approvals,
      referencedDiscussions: legacyData.referencedDiscussions,
    },
    error: legacyData.moderationError,
  });
};

const modelApprovedReferenceId = `34550:${"a".repeat(64)}:approved-management-model`;
const modelPendingReferenceId = `34550:${"b".repeat(64)}:pending-management-model`;
const modelApprovedReference = {
  id: modelApprovedReferenceId,
  authorPubkey: "a".repeat(64),
  dTag: "approved-management-model",
  moderators: [],
  createdAt: 200,
  title: "新モデルで承認済みの参照会話",
  description: "管理画面の承認済み参照",
};
const modelPendingReference = {
  id: modelPendingReferenceId,
  authorPubkey: "b".repeat(64),
  dTag: "pending-management-model",
  moderators: [],
  createdAt: 199,
  title: "新モデルで保留中の参照会話",
  description: "管理画面で保持する保留参照",
};
const modelApprovedPost = {
  id: "new-management-model-approved-post",
  content: "new management model approved post",
  authorPubkey: "c".repeat(64),
  discussionId: mockDiscussion.id,
  createdAt: 2,
  approved: true,
  approvedBy: ["other-moderator"],
  approvalState: "approved" as const,
  event: {
    id: "new-management-model-approved-post",
    pubkey: "c".repeat(64),
    created_at: 2,
    kind: 1111,
    tags: [["a", mockDiscussion.id], ["q", modelApprovedReferenceId]],
    content: "new management model approved post",
    sig: "new-management-model-approved-sig",
  },
};
const modelPendingPost = {
  id: "new-management-model-pending-post",
  content: "new management model pending post",
  authorPubkey: "d".repeat(64),
  discussionId: mockDiscussion.id,
  createdAt: 3,
  approved: false,
  approvedBy: [],
  approvalState: "unapproved" as const,
  event: {
    id: "new-management-model-pending-post",
    pubkey: "d".repeat(64),
    created_at: 3,
    kind: 1111,
    tags: [["a", mockDiscussion.id], ["q", modelPendingReferenceId]],
    content: "new management model pending post",
    sig: "new-management-model-pending-sig",
  },
};

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  useDiscussionMeta: () => mockUseDiscussionMeta(),
}));

jest.mock(
  "../../../../components/discussion/DiscussionManagementProvider",
  () => ({
    useDiscussionManagement: () => mockUseDiscussionManagement(),
  }),
  { virtual: true },
);

jest.mock("@/lib/nostr/nostr-read-executor", () => ({
  executeNostrRead: mockExecuteNostrRead,
}));

jest.mock("@/components/discussion/DiscussionManagementDataProvider", () => ({
  useDiscussionManagementData: () => mockLegacyManagementData(),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
  getDiscussionReadStrategyConfig: () => ({

    idleTimeoutMs: 500,
    hardTimeoutMs: 1500,
    dedupWindowMs: 250,
  }),
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const service = {
    getDiscussions: jest.fn().mockResolvedValue([
      {
        id: "discussion-event",
        pubkey: "author",
        created_at: 1,
        kind: 34550,
        tags: [
          ["d", "discussion-d-tag"],
          ["name", "Title"],
          ["p", "moderator", "", "moderator"],
        ],
        content: "desc",
        sig: "sig",
      },
    ]),
    getDiscussionPosts: jest.fn().mockResolvedValue([]),
    getApprovals: jest.fn().mockResolvedValue([]),
    getReferencedUserDiscussions: jest.fn().mockResolvedValue([]),
    getEventsWithCompletion: jest.fn((filters: Array<{ kinds?: number[] }>) => ({
      events: filters[0]?.kinds?.includes(34550)
        ? [{
            id: "discussion-event",
            pubkey: "author",
            created_at: 1,
            kind: 34550,
            tags: [["d", "discussion-d-tag"], ["name", "Title"]],
            content: "desc",
            sig: "sig",
          }]
        : filters[0]?.kinds?.includes(1111)
          ? [{
              id: "post-approved",
              pubkey: "poster",
              created_at: 2,
              kind: 1111,
              tags: [["a", "34550:author:discussion-d-tag"], ["q", "34550:ref:tag"]],
              content: "approved post",
              sig: "sig",
            }]
          : [{
              id: "approval-event",
              pubkey: "other-moderator",
              created_at: 3,
              kind: 4550,
              tags: [["a", "34550:author:discussion-d-tag"], ["e", "post-approved"], ["p", "poster"]],
              content: "",
              sig: "sig",
            }],
      completionReason: "eose",
      eventCount: 0,
      elapsedMs: 0,
      startedAt: 1,
      lastEventAt: 1,
      eoseReceived: true,
      relayUrls: [],
      duplicateCount: 0,
      sourceRelayUrlsByEventId: {},
    })),
    publishSignedEvent: jest.fn().mockResolvedValue(true),
    createApprovalEvent: jest.fn(),
    createRevocationEvent: jest.fn(),
  };

  return {
    createNostrService: () => service,
  };
});

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    discussionId: "34550:author:discussion-d-tag",
    authorPubkey: "author",
    dTag: "discussion-d-tag",
  }),
  buildNaddrFromRef: (ref: string) => ref,
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parseDiscussionEvent: jest.fn(() => ({
    id: "34550:author:discussion-d-tag",
    title: "Title",
    description: "desc",
    authorPubkey: "author",
    dTag: "discussion-d-tag",
    moderators: [{ pubkey: "moderator", relay: "" }],
    createdAt: 1,
  })),
  parsePostEvent: jest.fn((event) =>
    event.kind === 1111
      ? {
          id: event.id,
          content: event.content,
          authorPubkey: event.pubkey,
          discussionId: "34550:author:discussion-d-tag",
          createdAt: event.created_at,
          approved: true,
          approvedBy: ["other-moderator"],
          event,
        }
      : null
  ),
  parseApprovalEvent: jest.fn((event) =>
    event.kind === 4550
      ? {
          id: event.id,
          postId: "post-approved",
          postAuthorPubkey: "poster",
          moderatorPubkey: "other-moderator",
          discussionId: "34550:author:discussion-d-tag",
          createdAt: event.created_at,
          event,
        }
      : null
  ),
  formatRelativeTime: () => "now",
  buildNaddrFromDiscussion: (d: { id: string }) => d.id,
  npubToHex: (pubkey: string) => pubkey,
}));

describe("DiscussionManagePage", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR =
      "naddr1discussionlistplaceholder";
    jest.clearAllMocks();
    mockUseDiscussionManagement.mockReset();
    mockManagementReload.mockReset();
    mockExecuteNostrRead.mockReset();
    mockLegacyManagementReload.mockReset();
    mockLegacyManagementData.mockReset();
    mockLegacyManagementData.mockReturnValue(defaultLegacyManagementData);
    mockUseDiscussionManagement.mockImplementation(projectLegacyManagementData);
    mockUseDiscussionMeta.mockReturnValue({
      discussion: mockDiscussion,
      isLoading: false,
      error: null,
      reload: mockDiscussionMetaReload,
    });
    mockUseAuth.mockReturnValue({
      user: { pubkey: "viewer", isLoggedIn: true },
      signEvent: jest.fn(),
    });
  });

  it("allows viewers to see the moderation tabs without an access error", async () => {
    render(<DiscussionManagePage />);

    expect(
      screen.queryByText("アクセス権限がありません")
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "承認待ちタブを開く" })
      ).toBeInTheDocument()
    );
  });

  it("shows discussion metadata errors as a soft alert with reload", () => {
    mockUseDiscussionMeta.mockReturnValue({
      discussion: null,
      isLoading: false,
      error: "掲載一覧の会話情報が見つかりませんでした。",
      reload: mockDiscussionMetaReload,
    });

    render(<DiscussionManagePage />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(status).toHaveTextContent("掲載一覧の会話情報が見つかりませんでした。");
    expect(status).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(mockDiscussionMetaReload).toHaveBeenCalledTimes(1);
  });

  it("shows moderator guidance above the tabs for viewers", async () => {
    render(<DiscussionManagePage />);

    await screen.findByRole("tab", { name: "承認待ちタブを開く" });

    expect(
      screen.getByText(
        "掲載依頼を承認するにはモデレーターになる必要があります。"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "モデレーターになる" })
    ).toHaveAttribute(
      "href",
      "/discussions/moderator#become-moderator"
    );
  });

  it("moves and activates approval tabs with horizontal arrow keys", async () => {
    render(<DiscussionManagePage />);

    const pendingTab = await screen.findByRole("tab", {
      name: "承認待ちタブを開く",
    });
    const approvedTab = screen.getByRole("tab", {
      name: "承認済みタブを開く",
    });

    expect(pendingTab).toHaveAttribute("tabindex", "0");
    expect(approvedTab).toHaveAttribute("tabindex", "-1");

    pendingTab.focus();
    fireEvent.keyDown(pendingTab, { key: "ArrowLeft" });

    expect(approvedTab).toHaveFocus();
    expect(approvedTab).toHaveAttribute("aria-selected", "true");
    expect(approvedTab).toHaveAttribute("tabindex", "0");
    expect(pendingTab).toHaveAttribute("tabindex", "-1");
    expect(approvedTab).toHaveAttribute(
      "aria-controls",
      screen.getByRole("tabpanel").id
    );

    fireEvent.keyDown(approvedTab, { key: "ArrowRight" });

    expect(pendingTab).toHaveFocus();
    expect(pendingTab).toHaveAttribute("aria-selected", "true");
  });

  it.each(["author", "moderator"])(
    "hides moderator guidance from authorized user %s",
    async (pubkey) => {
      mockUseAuth.mockReturnValue({
        user: { pubkey, isLoggedIn: true },
        signEvent: jest.fn(),
      });

      render(<DiscussionManagePage />);

      await screen.findByRole("tab", { name: "承認待ちタブを開く" });
      expect(
        screen.queryByText(
          "掲載依頼を承認するにはモデレーターになる必要があります。"
        )
      ).not.toBeInTheDocument();
    }
  );

  it("keeps a missing canonical reference pending until its definition read reaches EOSE", async () => {
    render(<DiscussionManagePage />);

    const approvedTab = await screen.findByRole("tab", {
      name: "承認済みタブを開く",
    });
    fireEvent.click(approvedTab);

    expect(await screen.findByText(/会話の参照を取得中です/)).toBeInTheDocument();
    expect(screen.queryByText(/会話が見つかりません/)).not.toBeInTheDocument();
  });

  it("retains pending q references through the new management model", () => {
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({
        snapshot: {
          listDiscussion: managementModelDiscussion,
          listingPosts: [modelPendingPost, modelApprovedPost],
          listingApprovals: [],
          referencedDiscussions: [modelPendingReference, modelApprovedReference],
        },
      }),
    );

    render(<DiscussionManagePage />);

    expect(mockUseDiscussionManagement).toHaveBeenCalledTimes(1);
    expect(screen.getByText("新モデルで保留中の参照会話")).toBeInTheDocument();
    expect(screen.queryByText("新モデルで承認済みの参照会話")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "承認済みタブを開く" }));

    expect(screen.getByText("新モデルで承認済みの参照会話")).toBeInTheDocument();
  });

  it("keeps the revoke action visible when another moderator approved the post", async () => {
    render(<DiscussionManagePage />);

    const approvedTab = await screen.findByRole("tab", {
      name: "承認済みタブを開く",
    });
    fireEvent.click(approvedTab);
    await waitFor(() =>
      expect(approvedTab).toHaveAttribute("aria-selected", "true")
    );

    const revokeButton = await screen.findByRole("button", {
      name: "承認を撤回",
    });
    expect(revokeButton).toBeDisabled();
  });

  it("renders a ready empty management list from the shared snapshot", () => {
    mockLegacyManagementData.mockReturnValue(legacyReadyManagementData);
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({
        state: "ready",
        snapshot: {
          listDiscussion: managementModelDiscussion,
          listingPosts: [],
          listingApprovals: [],
          referencedDiscussions: [],
        },
      }),
    );

    render(<DiscussionManagePage />);

    expect(mockUseDiscussionManagement).toHaveBeenCalledTimes(1);
    expect(screen.getByText("承認待ちの投稿はありません")).toBeInTheDocument();
    expect(screen.queryByText("旧管理データだけの投稿")).not.toBeInTheDocument();
    expect(mockExecuteNostrRead).not.toHaveBeenCalled();
  });

  it("does not conclude an empty management list while the shared snapshot is partial", () => {
    mockLegacyManagementData.mockReturnValue(legacyReadyManagementData);
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({
        state: "partial",
        snapshot: {
          listDiscussion: managementModelDiscussion,
          listingPosts: [],
          listingApprovals: [],
          referencedDiscussions: [],
        },
      }),
    );

    render(<DiscussionManagePage />);

    expect(mockUseDiscussionManagement).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("承認待ちの投稿はありません")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("旧管理データだけの投稿")).not.toBeInTheDocument();
    expect(mockExecuteNostrRead).not.toHaveBeenCalled();
  });

  it("reloads the shared management snapshot rather than starting a page-owned read", () => {
    mockLegacyManagementData.mockReturnValue(legacyReadyManagementData);
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({
        state: "partial",
        snapshot: {
          listDiscussion: managementModelDiscussion,
          listingPosts: [],
          listingApprovals: [],
          referencedDiscussions: [],
        },
      }),
    );

    render(<DiscussionManagePage />);
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(mockUseDiscussionManagement).toHaveBeenCalledTimes(1);
    expect(mockManagementReload).toHaveBeenCalledTimes(1);
    expect(mockDiscussionMetaReload).not.toHaveBeenCalled();
    expect(mockLegacyManagementReload).not.toHaveBeenCalled();
    expect(mockExecuteNostrRead).not.toHaveBeenCalled();
  });
});
