import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
    user: { pubkey: "author", isLoggedIn: true },
    signEvent: jest.fn(),
  }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
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
    streamEventsOnEvent: jest.fn(() => () => {}),
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
  parsePostEvent: jest.fn(() => null),
  parseApprovalEvent: jest.fn(() => null),
  formatRelativeTime: () => "now",
  buildNaddrFromDiscussion: (d: any) => d.id,
}));

describe("DiscussionManagePage", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR =
      "naddr1discussionlistplaceholder";
    jest.clearAllMocks();
  });

  it("does not flash a permission error before data streams in", async () => {
    render(<DiscussionManagePage />);

    expect(
      screen.queryByText("アクセス権限がありません")
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText("投稿承認管理")).toBeInTheDocument()
    );
  });
});
