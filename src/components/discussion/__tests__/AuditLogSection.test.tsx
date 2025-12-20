import React from "react";
import { render, act } from "@testing-library/react";
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
