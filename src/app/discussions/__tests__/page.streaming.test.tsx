import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionsPage from "../page";
import type { NdkSubscribeHandlers } from "@/lib/nostr/discussion-ndk-gateway";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/discussions",
}));

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

jest.mock("@/lib/nostr/discussion-ndk-gateway", () => {
  const gatewayMock = {
    subscribe: jest.fn(),
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
    let approvalHandlers: NdkSubscribeHandlers | undefined;
    let discussionHandlers: NdkSubscribeHandlers | undefined;

    gatewayMock.subscribe
      .mockImplementationOnce(
        (_filters: unknown, handlers: NdkSubscribeHandlers) => {
          approvalHandlers = handlers;
          return { close: () => undefined };
        }
      )
      .mockImplementationOnce(
        (_filters: unknown, handlers: NdkSubscribeHandlers) => {
          discussionHandlers = handlers;
          return { close: () => undefined };
        }
      );

    render(<DiscussionsPage />);

    await waitFor(() =>
      expect(gatewayMock.subscribe).toHaveBeenCalled()
    );
    expect(gatewayMock.subscribe).toHaveBeenCalledWith(
      [{ kinds: [4550], "#a": ["34550:admin:list"] }],
      expect.any(Object)
    );

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

    expect(gatewayMock.subscribe).toHaveBeenNthCalledWith(
      2,
      [
        {
          kinds: [34550],
          authors: ["author"],
          "#d": ["demo"],
          limit: 1,
        },
      ],
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
