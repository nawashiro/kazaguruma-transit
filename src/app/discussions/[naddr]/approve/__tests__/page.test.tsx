import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PostApprovalPage from "../page";

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr-test" }),
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

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    discussionId: "34550:author:tag",
    authorPubkey: "author",
    dTag: "tag",
  }),
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const serviceMock = {
    streamEventsOnEvent: jest.fn(() => () => {}),
    streamApprovals: jest.fn(() => () => {}),
    getDiscussionPosts: jest.fn(),
    getDiscussions: jest.fn(),
  };
  return {
    createNostrService: () => serviceMock,
  };
});

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parseDiscussionEvent: () => ({
    id: "34550:author:tag",
    title: "Title",
    description: "desc",
    authorPubkey: "author",
    dTag: "tag",
    moderators: [],
    createdAt: 1,
  }),
  parsePostEvent: () => null,
  parseApprovalEvent: () => null,
  formatRelativeTime: () => "now",
  getAdminPubkeyHex: () => "admin",
}));

jest.mock("@/components/discussion/PermissionGuards", () => ({
  ModeratorCheck: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PermissionError: () => <div>Permission Error</div>,
}));

describe("PostApprovalPage - Back Link Removal", () => {
  it('does not render "会話に戻る" link', async () => {
    render(<PostApprovalPage />);

    await waitFor(() => {
      expect(screen.getByText("投稿承認管理")).toBeInTheDocument();
    });

    expect(screen.queryByText("会話に戻る")).not.toBeInTheDocument();
    expect(screen.queryByText("← 会話に戻る")).not.toBeInTheDocument();
  });
});
