import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PostApprovalPage from "../page";
import type { Discussion } from "@/types/discussion";

const useAuthMock = jest.fn();
const mockUseDiscussionMeta = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr-test" }),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  useDiscussionMeta: () => mockUseDiscussionMeta(),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    discussionId: "34550:author:tag",
    authorPubkey: "author",
    dTag: "tag",
  }),
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const serviceMock = {
    streamEventsOnEvent: jest.fn((_filters, handlers) => {
      handlers.onEose?.([
        {
          id: "discussion-event",
          pubkey: "author",
          kind: 34550,
          created_at: 1,
          tags: [
            ["d", "tag"],
            ["name", "Title"],
          ],
          content: "desc",
          sig: "sig",
        },
        {
          id: "post-1",
          pubkey: "poster",
          kind: 1111,
          created_at: 2,
          tags: [["a", "34550:author:tag"]],
          content: "pending post",
          sig: "sig",
        },
        {
          id: "post-approved",
          pubkey: "poster",
          kind: 1111,
          created_at: 3,
          tags: [["a", "34550:author:tag"]],
          content: "approved post",
          sig: "sig",
        },
      ]);
      return () => {};
    }),
    streamApprovals: jest.fn((_id, handlers) => {
      handlers.onEose?.([]);
      return () => {};
    }),
  };
  return {
    createNostrService: () => serviceMock,
    __mock: serviceMock,
  };
});

const { __mock: serviceMock } = jest.requireMock("@/lib/nostr/nostr-service");

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parseDiscussionEvent: (event: any) =>
    event.kind === 34550
      ? {
          id: "34550:author:tag",
          title: "Title",
          description: "desc",
          authorPubkey: "author",
          dTag: "tag",
          moderators: [{ pubkey: "moderator-1" }],
          createdAt: 1,
          event,
        }
      : null,
  parsePostEvent: (event: any) =>
    event.kind === 1111
      ? {
          id: event.id,
          content: event.content,
          authorPubkey: "poster",
          discussionId: "34550:author:tag",
          createdAt: event.created_at,
          approved: event.id === "post-approved",
          event,
        }
      : null,
  parseApprovalEvent: () => null,
  formatRelativeTime: () => "now",
  getAdminPubkeyHex: () => "admin",
  isModerator: () => false,
}));

describe("PostApprovalPage streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const layoutDiscussion: Discussion = {
      id: "34550:author:tag",
      title: "Title",
      description: "desc",
      authorPubkey: "author",
      dTag: "tag",
      moderators: [{ pubkey: "moderator-1" }],
      createdAt: 1,
      event: {
        id: "discussion-event",
        pubkey: "author",
        kind: 34550,
        created_at: 1,
        tags: [
          ["d", "tag"],
          ["name", "Title"],
        ],
        content: "desc",
        sig: "sig",
      },
    };
    mockUseDiscussionMeta.mockReturnValue({
      discussion: layoutDiscussion,
      isLoading: false,
      error: null,
      completionReason: "eose",
      reload: jest.fn(),
    });
  });

  it("uses streaming APIs instead of blocking fetches", async () => {
    useAuthMock.mockReturnValue({
      user: { pubkey: "author", isLoggedIn: true },
      signEvent: jest.fn(),
    });

    render(<PostApprovalPage />);

    await waitFor(() =>
      expect(serviceMock.streamEventsOnEvent).toHaveBeenCalled()
    );
    expect(serviceMock.streamApprovals).toHaveBeenCalled();
  });

  it("shows disabled approval action with reason for non-moderator users", async () => {
    useAuthMock.mockReturnValue({
      user: { pubkey: "viewer", isLoggedIn: true },
      signEvent: jest.fn(),
    });

    render(<PostApprovalPage />);

    const button = await screen.findByRole("button", { name: "承認" });
    expect(button).toBeDisabled();
    expect(
      screen.getByText("この会話の作成者またはモデレーターのみ承認操作できます。")
    ).toBeInTheDocument();
  });

  it("shows disabled revoke action with reason for non-moderator users", async () => {
    useAuthMock.mockReturnValue({
      user: { pubkey: "viewer", isLoggedIn: true },
      signEvent: jest.fn(),
    });

    render(<PostApprovalPage />);

    const approvedTab = await screen.findByRole("tab", { name: "承認済みタブを開く" });
    fireEvent.click(approvedTab);

    const revokeButton = await screen.findByRole("button", { name: "承認を撤回" });
    expect(revokeButton).toBeDisabled();
    expect(
      screen.getByText("この会話の作成者またはモデレーターのみ承認操作できます。")
    ).toBeInTheDocument();
  });

  it("does not duplicate the parent discussion navigation or headings", async () => {
    useAuthMock.mockReturnValue({
      user: { pubkey: "author", isLoggedIn: true },
      signEvent: jest.fn(),
    });

    render(<PostApprovalPage />);

    await screen.findByRole("button", { name: "承認" });

    expect(screen.queryByRole("link", { name: /会話に戻る/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "投稿承認管理" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "承認待ち投稿" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "承認済み投稿" })).not.toBeInTheDocument();
  });

  it("renders approval filters with daisyUI tabs-box classes", async () => {
    useAuthMock.mockReturnValue({
      user: { pubkey: "author", isLoggedIn: true },
      signEvent: jest.fn(),
    });

    render(<PostApprovalPage />);

    const tablist = await screen.findByRole("tablist");
    expect(tablist).toHaveClass("tabs", "tabs-box");
    expect(screen.getByRole("tab", { name: "承認待ちタブを開く" })).toHaveClass(
      "tab",
      "tab-active"
    );
    expect(screen.getByRole("tab", { name: "承認済みタブを開く" })).toHaveClass("tab");
  });
});
