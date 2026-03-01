import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Discussion } from "@/types/discussion";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr1test123" }),
  usePathname: () => "/discussions/naddr1test123/audit",
}));

const mockUseDiscussionMeta = jest.fn();
jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  useDiscussionMeta: () => mockUseDiscussionMeta(),
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
      discussion?: Discussion | null;
      discussionInfo?: { discussionId: string };
      initialVisibleCount?: number;
    },
    ref: React.Ref<{
      loadAuditData: () => void;
      retryLoadAuditData: () => void;
    }>
  ) {
    React.useImperativeHandle(ref, () => ({
      loadAuditData: jest.fn(),
      retryLoadAuditData: jest.fn(),
    }));
    return (
      <div data-testid="audit-log-section">
        <div data-testid="discussion-title">{props.discussion?.title}</div>
        <div data-testid="discussion-info">
          {props.discussionInfo?.discussionId}
        </div>
        <div data-testid="initial-visible-count">
          {props.initialVisibleCount}
        </div>
      </div>
    );
  }),
}));

// Import after mocking
import AuditPage from "../page";

describe("Discussion Detail Audit Page", () => {
  beforeEach(() => {
    mockUseDiscussionMeta.mockReturnValue({
      discussion: {
        id: "34550:test-pubkey:test-dtag",
        title: "会話タイトル",
        description: "説明",
        authorPubkey: "test-pubkey",
        dTag: "test-dtag",
        moderators: [],
        createdAt: 1,
        event: {
          id: "event-1",
          kind: 34550,
          pubkey: "test-pubkey",
          created_at: 1,
          tags: [["d", "test-dtag"]],
          content: "説明",
          sig: "sig",
        },
      },
      isLoading: false,
      error: null,
      completionReason: "eose",
      reload: jest.fn(),
    });
  });

  it("renders AuditLogSection component", () => {
    render(<AuditPage />);

    expect(screen.getByTestId("audit-log-section")).toBeInTheDocument();
  });

  it("passes discussion from layout meta to AuditLogSection", () => {
    render(<AuditPage />);

    expect(screen.getByTestId("discussion-title")).toHaveTextContent(
      "会話タイトル"
    );
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

  it("sets initial visible count to 10 for pagination", () => {
    render(<AuditPage />);
    expect(screen.getByTestId("initial-visible-count")).toHaveTextContent(
      "10"
    );
  });
});
