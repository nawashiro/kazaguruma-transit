import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionsPage from "../page";
import type { StreamEventsOptions } from "@/lib/nostr/nostr-service";

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { pubkey: "viewer", isLoggedIn: true },
  }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: "list",
    authorPubkey: "admin",
    discussionId: "34550:admin:list",
  }),
  buildNaddrFromDiscussion: () => "naddr1test",
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const serviceMock = {
    streamApprovals: jest.fn(),
    streamReferencedUserDiscussions: jest.fn(),
    streamEventsOnEvent: jest.fn(),
  };

  return {
    createNostrService: () => serviceMock,
    __mock: serviceMock,
  };
});

const { __mock: serviceMock } = jest.requireMock("@/lib/nostr/nostr-service");

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
  parseApprovalEvent: jest.fn((event) => ({
    id: event.id,
    postId: "post-1",
    postAuthorPubkey: "author",
    moderatorPubkey: "mod",
    discussionId: "34550:admin:list",
    createdAt: event.created_at,
    event,
  })),
  parsePostEvent: jest.fn((_post, approvals) => ({
    id: approvals[0]?.postId || "post-1",
    content: "approved post",
    authorPubkey: "author",
    discussionId: "34550:admin:list",
    createdAt: 100,
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
  formatRelativeTime: () => "now",
}));

jest.mock("@/components/discussion/AuditLogSection", () => ({
  AuditLogSection: () => <div>Audit Log</div>,
}));

describe("DiscussionsPage streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1discussionlist";
  });

  it("waits for approvals EOSE before streaming discussions and renders OnEvent updates", async () => {
    let approvalHandlers: StreamEventsOptions | undefined;
    let discussionHandlers: StreamEventsOptions | undefined;

    serviceMock.streamApprovals.mockImplementation(
      (_discussionId: string, handlers: StreamEventsOptions) => {
        approvalHandlers = handlers;
        return () => {};
      }
    );

    serviceMock.streamReferencedUserDiscussions.mockImplementation(
      (_refs: string[], handlers: StreamEventsOptions) => {
        discussionHandlers = handlers;
        return () => {};
      }
    );

    render(<DiscussionsPage />);

    await waitFor(() =>
      expect(serviceMock.streamApprovals).toHaveBeenCalled()
    );
    expect(serviceMock.streamEventsOnEvent).not.toHaveBeenCalled();

    const approvalEvent = {
      id: "approval-1",
      pubkey: "mod",
      kind: 4550,
      created_at: 123,
      tags: [["a", "34550:admin:list"]],
      content: JSON.stringify({
        tags: [["q", "34550:author:demo"]],
      }),
      sig: "sig",
    };

    await act(async () => {
      approvalHandlers?.onEose?.([approvalEvent]);
    });

    expect(serviceMock.streamReferencedUserDiscussions).toHaveBeenCalledWith(
      ["34550:author:demo"],
      expect.any(Object)
    );

    const discussionEvent = {
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
    };

    await act(async () => {
      discussionHandlers?.onEvent?.([discussionEvent], discussionEvent);
    });

    expect(
      await screen.findByText("Streamed Discussion")
    ).toBeInTheDocument();
  });
});
