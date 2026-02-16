import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr1test123" }),
  usePathname: () => "/discussions/naddr1test123/audit",
}));

// Mock naddr utils
jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: "test-dtag",
    authorPubkey: "test-pubkey",
    discussionId: "34550:test-pubkey:test-dtag",
  }),
}));

// Mock AuditLogSection
jest.mock("@/components/discussion/AuditLogSection", () => ({
  AuditLogSection: React.forwardRef(function MockAuditLogSection(
    props: {
      loadDiscussionIndependently?: boolean;
      discussionInfo?: { discussionId: string };
    },
    ref: React.Ref<{ loadAuditData: () => void }>
  ) {
    React.useImperativeHandle(ref, () => ({
      loadAuditData: jest.fn(),
    }));
    return (
      <div data-testid="audit-log-section">
        <div data-testid="load-independently">
          {String(props.loadDiscussionIndependently)}
        </div>
        <div data-testid="discussion-info">
          {props.discussionInfo?.discussionId}
        </div>
      </div>
    );
  }),
}));

// Import after mocking
import AuditPage from "../page";

describe("Discussion Detail Audit Page", () => {
  it("renders AuditLogSection component", () => {
    render(<AuditPage />);

    expect(screen.getByTestId("audit-log-section")).toBeInTheDocument();
  });

  it("passes loadDiscussionIndependently=true to AuditLogSection", () => {
    render(<AuditPage />);

    expect(screen.getByTestId("load-independently")).toHaveTextContent("true");
  });

  it("passes discussionInfo extracted from naddr params", () => {
    render(<AuditPage />);

    expect(screen.getByTestId("discussion-info")).toHaveTextContent(
      "34550:test-pubkey:test-dtag"
    );
  });

  it("does not render heading (moved to layout)", () => {
    render(<AuditPage />);

    // The "監査ログ" heading should not be in the page content
    // (It's now shown in the layout as the discussion title)
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
