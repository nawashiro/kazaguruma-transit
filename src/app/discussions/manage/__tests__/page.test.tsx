import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionManagePage from "../page";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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
  getDiscussionReadStrategyConfig: () => ({
    relayLimit: 3,
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
  buildNaddrFromDiscussion: (d: any) => d.id,
  npubToHex: (pubkey: string) => pubkey,
}));

describe("DiscussionManagePage", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR =
      "naddr1discussionlistplaceholder";
    jest.clearAllMocks();
  });

  it("allows viewers to see the moderation tabs without an access error", async () => {
    render(<DiscussionManagePage />);

    expect(
      screen.queryByText("アクセス権限がありません")
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "承認待ち" })).toBeInTheDocument()
    );
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
});
