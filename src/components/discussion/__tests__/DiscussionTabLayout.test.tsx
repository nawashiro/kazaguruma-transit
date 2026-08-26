import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
const mockPathname = jest.fn();
const mockParams = jest.fn();
const mockUseDiscussionDetail = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useParams: () => mockParams(),
}));

// Mock Nostr services and utilities
jest.mock("@/lib/nostr/nostr-service", () => ({
  getNostrServiceConfigKey: jest.fn(() => "test-config-key"),
  createNostrService: jest.fn(() => ({
    streamDiscussionMeta: jest.fn(() => jest.fn()), // Returns cleanup function
  })),
}));
jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: jest.fn(() => ({
    relays: [{ url: "wss://relay.example.com", read: true, write: false }],
    defaultTimeout: 500,
  })),
  getDiscussionReadStrategyConfig: jest.fn(() => ({

    idleTimeoutMs: 500,
    hardTimeoutMs: 1500,
    dedupWindowMs: 250,
  })),
}));
jest.mock("@/lib/test/test-data-loader", () => ({
  loadTestData: jest.fn(),
  isTestMode: jest.fn(() => false),
}));
jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: jest.fn(() => null), // Return null for basic tests
}));
jest.mock("@/lib/nostr/nostr-read-executor", () => ({
  executeNostrRead: jest.fn(),
}));
jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ user: { pubkey: null, isLoggedIn: false } }),
}));
jest.mock("@/components/discussion/DiscussionDetailProvider", () => ({
  useDiscussionDetail: () => mockUseDiscussionDetail(),
}));
jest.mock("@/lib/nostr/nostr-utils", () => ({
  parseDiscussionEvent: jest.fn(() => null),
  getAdminPubkeyHex: jest.fn(() => "admin-pubkey"),
  isModerator: jest.fn(() => false),
  npubToHex: jest.fn((pubkey: string) => pubkey),
}));
jest.mock("@/utils/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocking
import {
  DiscussionTabLayout,
} from "../DiscussionTabLayout";
import type { DiscussionDetailModel } from "@/components/discussion/DiscussionDetailProvider";
import { executeNostrRead } from "@/lib/nostr/nostr-read-executor";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import { parseDiscussionEvent } from "@/lib/nostr/nostr-utils";
import type { Discussion } from "@/types/discussion";

const discussionMetadata: Discussion = {
  id: "discussion-id",
  dTag: "topic",
  title: "テスト会話",
  description: "テスト説明",
  moderators: [],
  authorPubkey: "author-pubkey",
  createdAt: 1,
  event: {
    id: "discussion-event",
    kind: 34550,
    content: "",
    tags: [["d", "topic"]],
    created_at: 1,
    pubkey: "author-pubkey",
    sig: "signature",
  },
};

const detailSnapshot: NonNullable<DiscussionDetailModel["snapshot"]> = {
  discussion: discussionMetadata,
  posts: [],
  approvals: [],
  moderatorRequests: [],
  evaluations: [],
  userEvaluationIds: new Set<string>(),
  relayProvenance: { successfulRelayUrlsByPhase: {} },
};

const createDetailModel = (
  overrides: Partial<DiscussionDetailModel> = {},
): DiscussionDetailModel => ({
  state: "loading",
  snapshot: null,
  error: null,
  completionReason: null,
  relayProvenance: null,
  isFallback: false,
  reload: jest.fn(async () => undefined),
  addPost: jest.fn(),
  addApproval: jest.fn(),
  removeApproval: jest.fn(),
  ...overrides,
});

describe("DiscussionTabLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/discussions/naddr123");
    mockParams.mockReturnValue({ naddr: "naddr123" });
    mockUseDiscussionDetail.mockReturnValue(createDetailModel());
    jest.mocked(extractDiscussionFromNaddr).mockReturnValue(null);
    jest.mocked(parseDiscussionEvent).mockReturnValue(null);
    jest.mocked(executeNostrRead).mockResolvedValue({
      events: [],
      completionReason: "eose",
      duplicateCount: 0,
      elapsedMs: 0,
      attemptedRelayUrls: [],
      successfulEventRelayUrls: [],
      sourceRelayUrlsByEventId: {},
      attempts: [],
    });
  });

  describe("ARIA attributes", () => {
    it("renders tablist with proper role", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();
      expect(tablist).toHaveClass("tabs", "tabs-box");
    });

    it("renders tabs with proper role and aria-selected", () => {
      mockPathname.mockReturnValue("/discussions/naddr123");

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(3);

      // Main tab should be selected when on main path
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(tabs[0]).toHaveAttribute(
        "aria-controls",
        "discussion-content-panel",
      );
      expect(tabs[1]).toHaveAttribute("aria-selected", "false");
      expect(tabs[2]).toHaveAttribute("aria-selected", "false");
      expect(screen.getByRole("tabpanel")).toHaveAttribute(
        "aria-labelledby",
        "discussion-content-0-tab",
      );
    });

    it("renders and selects the all posts tab on the approval path", () => {
      mockPathname.mockReturnValue("/discussions/naddr123/approve");

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const allPostsTab = screen.getByRole("tab", { name: "すべての投稿" });
      expect(allPostsTab).toHaveAttribute(
        "href",
        "/discussions/naddr123/approve"
      );
      expect(allPostsTab).toHaveAttribute("aria-selected", "true");
    });

  it("does not expose the basic information tab to a non-creator", () => {
      mockPathname.mockReturnValue("/discussions/naddr123/edit");
      mockUseDiscussionDetail.mockReturnValue(
        createDetailModel({
          state: "ready",
          snapshot: detailSnapshot,
        }),
      );

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).toHaveAttribute("aria-selected", "false");
      expect(tabs[1]).toHaveAttribute("aria-selected", "false");
      expect(tabs).toHaveLength(3);
      expect(tabs[2]).toHaveAttribute("aria-selected", "false");
    });
  });

  describe("keyboard navigation", () => {
    it("handles ArrowRight key to focus next tab", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[0].focus();

      fireEvent.keyDown(tabs[0], { key: "ArrowRight" });

      expect(document.activeElement).toBe(tabs[1]);
    });

    it("handles ArrowLeft key to focus previous tab", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[2].focus();

      fireEvent.keyDown(tabs[2], { key: "ArrowLeft" });

      expect(document.activeElement).toBe(tabs[1]);
    });

    it("handles Home key to focus first tab", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[2].focus();

      fireEvent.keyDown(tabs[2], { key: "Home" });

      expect(document.activeElement).toBe(tabs[0]);
    });

    it("handles End key to focus last tab", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[0].focus();

      fireEvent.keyDown(tabs[0], { key: "End" });

      expect(document.activeElement).toBe(tabs[2]);
    });

    it("wraps around on ArrowRight from last tab", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[2].focus();

      fireEvent.keyDown(tabs[2], { key: "ArrowRight" });

      expect(document.activeElement).toBe(tabs[0]);
    });

    it("wraps around on ArrowLeft from first tab", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[0].focus();

      fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });

      expect(document.activeElement).toBe(tabs[2]);
    });
  });

  describe("active state styling", () => {
    it("applies active class to main tab when on main path", () => {
      mockPathname.mockReturnValue("/discussions/naddr123");

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).toHaveClass("tab-active");
      expect(tabs[1]).not.toHaveClass("tab-active");
      expect(tabs[2]).not.toHaveClass("tab-active");
    });

  });

  describe("renders children", () => {
    it("renders detail metadata from the detail provider", () => {
      mockUseDiscussionDetail.mockReturnValue(
        createDetailModel({
          state: "ready",
          snapshot: detailSnapshot,
        }),
      );

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>,
      );

      expect(
        screen.getByRole("heading", { level: 1, name: "テスト会話" }),
      ).toBeInTheDocument();
      expect(screen.getByText("あなたはユーザーです。")).toBeInTheDocument();
      expect(screen.getAllByRole("tab")).toHaveLength(3);
    });

    it("renders completed detail role guidance as a soft status banner", () => {
      mockUseDiscussionDetail.mockReturnValue(
        createDetailModel({
          state: "ready",
          snapshot: detailSnapshot,
        }),
      );

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>,
      );

      expect(screen.getByText("あなたはユーザーです。")).toBeInTheDocument();
      const status = screen.getByRole("status");
      expect(status).toHaveClass("alert", "alert-soft", "text-base-content!");
      expect(status.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
      expect(
        screen.getByText("ユーザーとして、新しい意見を投稿できます。"),
      ).toBeInTheDocument();
    });

    it("renders detail loading state while preserving navigation", () => {
      mockUseDiscussionDetail.mockReturnValue(createDetailModel());

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>,
      );

      expect(screen.getByText("会話情報を読み込み中...")).toBeInTheDocument();
      expect(screen.getAllByRole("tab")).toHaveLength(3);
    });

    it("renders detail partial state and reload action without legacy metadata", () => {
      const reload = jest.fn(async () => undefined);
      mockUseDiscussionDetail.mockReturnValue(
        createDetailModel({
          state: "partial",
          snapshot: detailSnapshot,
          completionReason: "idle-timeout",
          reload,
        }),
      );

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>,
      );

      expect(
        screen.getAllByText(
          "一部のrelayからの取得が完了していません。表示内容は暫定です。",
        ),
      ).toHaveLength(2);
      expect(screen.getAllByRole("tab")).toHaveLength(3);
      fireEvent.click(screen.getAllByRole("button", { name: "再読み込み" })[0]);
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("renders detail error and reload action without legacy metadata", () => {
      const reload = jest.fn(async () => undefined);
      mockUseDiscussionDetail.mockReturnValue(
        createDetailModel({
          state: "error",
          error: "詳細データの取得に失敗しました。",
          reload,
        }),
      );

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>,
      );

      expect(screen.getByText("詳細データの取得に失敗しました。")).toBeInTheDocument();
      expect(screen.getAllByRole("tab")).toHaveLength(3);
      fireEvent.click(screen.getByRole("button", { name: "再試行" }));
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("renders children content", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div data-testid="child-content">Child Content</div>
        </DiscussionTabLayout>
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("does not render a role card before discussion metadata is ready", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      expect(screen.queryByText("あなたはユーザーです。")).not.toBeInTheDocument();
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    });
  });

  describe("touch target size", () => {
    it("has minimum 44px height for touch targets", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs.forEach((tab) => {
        expect(tab).toHaveClass("min-h-[44px]");
      });
    });
  });
});
