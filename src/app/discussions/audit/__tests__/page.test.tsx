import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/discussions/audit",
  useParams: () => ({ naddr: undefined }), // No naddr for discussion list page
}));

// Mock naddr utils
jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: "list",
    authorPubkey: "list-admin",
    discussionId: "34550:list-admin:list",
  }),
}));

// Mock DiscussionListTabLayout
jest.mock("@/components/discussion/DiscussionListTabLayout", () => ({
  DiscussionListTabLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="discussion-list-tab-layout">{children}</div>
  ),
}));

// Mock AuditLogSection
jest.mock("@/components/discussion/AuditLogSection", () => ({
  AuditLogSection: React.forwardRef(function MockAuditLogSection(
    props: {
      isDiscussionList?: boolean;
      discussionInfo?: { discussionId: string };
    },
    ref: React.Ref<{ loadAuditData: () => void }>
  ) {
    React.useImperativeHandle(ref, () => ({
      loadAuditData: jest.fn(),
    }));
    return (
      <div data-testid="audit-log-section">
        <div data-testid="is-discussion-list">
          {String(props.isDiscussionList)}
        </div>
        <div data-testid="discussion-info">
          {props.discussionInfo?.discussionId}
        </div>
      </div>
    );
  }),
}));

// Set environment variable
process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1discussionlist";

// Import after mocking
import AuditPage from "../page";

describe("Discussion List Audit Page", () => {
  it("renders AuditLogSection component", () => {
    render(<AuditPage />);

    expect(screen.getByTestId("audit-log-section")).toBeInTheDocument();
  });

  it("passes isDiscussionList=true to AuditLogSection", () => {
    render(<AuditPage />);

    expect(screen.getByTestId("is-discussion-list")).toHaveTextContent("true");
  });

  it("passes discussionInfo from DISCUSSION_LIST_NADDR", () => {
    render(<AuditPage />);

    expect(screen.getByTestId("discussion-info")).toHaveTextContent(
      "34550:list-admin:list"
    );
  });
});
