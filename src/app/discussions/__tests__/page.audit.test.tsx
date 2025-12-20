import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionsPage from "../page";

// eslint-disable-next-line no-var
var loadAuditDataMock: jest.Mock;

jest.mock("@/components/discussion/AuditLogSection", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  loadAuditDataMock = jest.fn();

  const AuditLogSection = React.forwardRef(function AuditLogSectionMock(
    _props: Record<string, never>,
    ref: React.ForwardedRef<{ loadAuditData: () => void }>
  ) {
    React.useImperativeHandle(ref, () => ({
      loadAuditData: loadAuditDataMock,
    }));
    return <div>Audit Log</div>;
  });

  AuditLogSection.displayName = "AuditLogSectionMock";

  return {
    __esModule: true,
    AuditLogSection,
    __mock: {
      loadAuditDataMock,
    },
  };
});

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
    streamApprovals: jest.fn().mockReturnValue(() => {}),
    streamReferencedUserDiscussions: jest.fn().mockReturnValue(() => {}),
    streamEventsOnEvent: jest.fn().mockReturnValue(() => {}),
  };

  return {
    createNostrService: () => serviceMock,
  };
});

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parseDiscussionEvent: jest.fn(),
  parseApprovalEvent: jest.fn(),
  parsePostEvent: jest.fn(),
  formatRelativeTime: () => "now",
}));

describe("DiscussionsPage audit tab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1discussionlist";
    loadAuditDataMock?.mockClear();
  });

  it("loads audit data after switching to the audit tab", async () => {
    render(<DiscussionsPage />);

    fireEvent.click(screen.getByRole("tab", { name: "監査ログを開く" }));

    await waitFor(() => expect(loadAuditDataMock).toHaveBeenCalledTimes(1));
  });
});
