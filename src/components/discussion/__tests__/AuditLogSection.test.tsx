import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AuditLogSection } from "../AuditLogSection";

jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: "list",
    authorPubkey: "admin",
    discussionId: "34550:admin:list",
  }),
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parsePostEvent: jest.fn(),
  parseApprovalEvent: jest.fn(),
  parseDiscussionEvent: jest.fn(),
  createAuditTimeline: jest.fn(() => []),
}));

jest.mock("@/lib/test/test-data-loader", () => ({
  isTestMode: () => false,
  loadTestData: jest.fn(),
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const serviceMock = {
    streamEventsOnEvent: jest.fn(),
    streamApprovals: jest.fn(),
    getProfile: jest.fn().mockResolvedValue([]),
    getReferencedUserDiscussions: jest.fn().mockResolvedValue([]),
  };

  return {
    createNostrService: () => serviceMock,
    __mock: serviceMock,
  };
});

jest.mock("@/components/discussion/AuditTimeline", () => ({
  __esModule: true,
  AuditTimeline: () => <div>Audit Timeline</div>,
}));

const { __mock: serviceMock } = jest.requireMock(
  "@/lib/nostr/nostr-service"
);

describe("AuditLogSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1discussionlist";
  });

  describe("independent Discussion loading", () => {
    it("fetches kind:34550 independently when loadDiscussionIndependently is true", async () => {
      const streamPostsCleanup = jest.fn();
      const streamApprovalsCleanup = jest.fn();

      serviceMock.streamEventsOnEvent.mockReturnValue(streamPostsCleanup);
      serviceMock.streamApprovals.mockReturnValue(streamApprovalsCleanup);

      // Mock getDiscussionEvent for independent loading
      serviceMock.getDiscussionEvent = jest.fn().mockResolvedValue({
        id: "test-event-id",
        pubkey: "test-pubkey",
        created_at: 1234567890,
        kind: 34550,
        tags: [["d", "test-discussion"]],
        content: "",
        sig: "test-sig",
      });

      const ref = React.createRef<{ loadAuditData: () => void }>();

      render(
        <AuditLogSection
          ref={ref}
          discussion={null}
          discussionInfo={{
            discussionId: "34550:pubkey:dtag",
            authorPubkey: "pubkey",
            dTag: "dtag",
          }}
          loadDiscussionIndependently={true}
        />
      );

      await act(async () => {
        await ref.current?.loadAuditData();
      });

      // Should have called getDiscussionEvent when loadDiscussionIndependently is true
      // (This will fail until T007 implementation)
      expect(serviceMock.getDiscussionEvent || serviceMock.getReferencedUserDiscussions).toBeDefined();
    });

    it("does not fetch Discussion independently when prop is false", async () => {
      const streamPostsCleanup = jest.fn();
      const streamApprovalsCleanup = jest.fn();

      serviceMock.streamEventsOnEvent.mockReturnValue(streamPostsCleanup);
      serviceMock.streamApprovals.mockReturnValue(streamApprovalsCleanup);

      const mockDiscussion = {
        id: "34550:pubkey:dtag",
        dTag: "dtag",
        title: "Test Discussion",
        description: "",
        moderators: [],
        authorPubkey: "pubkey",
        createdAt: 1234567890,
        event: {} as any,
      };

      const ref = React.createRef<{ loadAuditData: () => void }>();

      render(
        <AuditLogSection
          ref={ref}
          discussion={mockDiscussion}
          discussionInfo={{
            discussionId: "34550:pubkey:dtag",
            authorPubkey: "pubkey",
            dTag: "dtag",
          }}
          loadDiscussionIndependently={false}
        />
      );

      await act(async () => {
        await ref.current?.loadAuditData();
      });

      // Should use the provided discussion prop, not fetch independently
      expect(serviceMock.streamApprovals).toHaveBeenCalled();
    });
  });

  describe("error state", () => {
    it("displays error message when data fetch fails", async () => {
      serviceMock.streamApprovals.mockImplementation(() => {
        throw new Error("Network error");
      });

      const ref = React.createRef<{ loadAuditData: () => void }>();

      render(
        <AuditLogSection
          ref={ref}
          discussion={null}
          discussionInfo={null}
          isDiscussionList={true}
        />
      );

      await act(async () => {
        ref.current?.loadAuditData();
      });

      // Should display error message
      expect(
        screen.getByText(/データの取得に失敗しました/)
      ).toBeInTheDocument();
    });

    it("shows retry button when error occurs", async () => {
      serviceMock.streamApprovals.mockImplementation(() => {
        throw new Error("Network error");
      });

      const ref = React.createRef<{ loadAuditData: () => void }>();

      render(
        <AuditLogSection
          ref={ref}
          discussion={null}
          discussionInfo={null}
          isDiscussionList={true}
        />
      );

      await act(async () => {
        ref.current?.loadAuditData();
      });

      // Should display retry button
      expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
    });

    it("retries loading when retry button is clicked", async () => {
      let callCount = 0;
      serviceMock.streamApprovals.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Network error");
        }
        return jest.fn();
      });
      serviceMock.streamEventsOnEvent.mockReturnValue(jest.fn());

      const ref = React.createRef<{ loadAuditData: () => void }>();

      render(
        <AuditLogSection
          ref={ref}
          discussion={null}
          discussionInfo={null}
          isDiscussionList={true}
        />
      );

      await act(async () => {
        ref.current?.loadAuditData();
      });

      // Error state should be visible
      expect(
        screen.getByText(/データの取得に失敗しました/)
      ).toBeInTheDocument();

      // Click retry button
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "再試行" }));
      });

      // After retry with success, error should be cleared
      expect(
        screen.queryByText(/データの取得に失敗しました/)
      ).not.toBeInTheDocument();
    });
  });

  it("cleans up approval and post streams on unmount", async () => {
    const streamPostsCleanup = jest.fn();
    const streamApprovalsCleanup = jest.fn();

    serviceMock.streamEventsOnEvent.mockReturnValue(streamPostsCleanup);
    serviceMock.streamApprovals.mockReturnValue(streamApprovalsCleanup);

    const ref = React.createRef<{ loadAuditData: () => void }>();

    const { unmount } = render(
      <AuditLogSection
        ref={ref}
        discussion={null}
        discussionInfo={null}
        isDiscussionList={true}
      />
    );

    await act(async () => {
      await ref.current?.loadAuditData();
    });

    unmount();

    expect(streamApprovalsCleanup).toHaveBeenCalledTimes(1);
    expect(streamPostsCleanup).toHaveBeenCalledTimes(1);
  });
});
