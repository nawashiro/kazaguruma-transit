import React from "react";
import { render, waitFor } from "@testing-library/react";
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

const serviceMock = {
  streamEventsOnEvent: jest.fn(() => () => {}),
  streamApprovals: jest.fn(() => () => {}),
  getDiscussionPosts: jest.fn(),
  getDiscussions: jest.fn(),
};

jest.mock("@/lib/nostr/nostr-service", () => ({
  createNostrService: () => serviceMock,
}));

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

describe("PostApprovalPage streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses streaming APIs instead of blocking fetches", async () => {
    render(<PostApprovalPage />);

    await waitFor(() =>
      expect(serviceMock.streamEventsOnEvent).toHaveBeenCalled()
    );
    expect(serviceMock.getDiscussionPosts).not.toHaveBeenCalled();
    expect(serviceMock.getDiscussions).not.toHaveBeenCalled();
  });
});
