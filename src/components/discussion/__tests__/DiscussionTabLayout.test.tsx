import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
const mockPathname = jest.fn();
const mockParams = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useParams: () => mockParams(),
}));

const mockUseAuth = jest.fn();
jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Nostr services and utilities
jest.mock("@/lib/nostr/nostr-service", () => ({
  createNostrService: jest.fn(() => ({
    streamDiscussionMeta: jest.fn(() => jest.fn()), // Returns cleanup function
  })),
}));
jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: jest.fn(() => ({
    relays: ["wss://relay.example.com"],
  })),
}));
jest.mock("@/lib/test/test-data-loader", () => ({
  loadTestData: jest.fn(),
  isTestMode: jest.fn(() => true),
}));
jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: "test-dtag",
    authorPubkey: "author-pubkey",
    discussionId: "discussion-id",
  }),
}));
jest.mock("@/lib/nostr/nostr-utils", () => ({
  parseDiscussionEvent: jest.fn(() => null),
  getAdminPubkeyHex: () => "admin-pubkey",
  isAdmin: (userPubkey: string | null | undefined, adminPubkey: string) =>
    userPubkey === adminPubkey,
  isModerator: (
    userPubkey: string | null | undefined,
    moderators: string[],
    adminPubkey?: string
  ) => {
    if (!userPubkey) return false;
    if (adminPubkey && userPubkey === adminPubkey) return true;
    return moderators.includes(userPubkey);
  },
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
import { DiscussionTabLayout } from "../DiscussionTabLayout";

describe("DiscussionTabLayout", () => {
  const baseDiscussion = {
    id: "discussion-id",
    title: "Test Discussion",
    description: "Test Description",
    authorPubkey: "author-pubkey",
    dTag: "test-dtag",
    moderators: [{ pubkey: "moderator-pubkey" }],
    createdAt: 1,
  };
  const mockLoadTestData = jest.requireMock(
    "@/lib/test/test-data-loader"
  ).loadTestData as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/discussions/naddr123");
    mockParams.mockReturnValue({ naddr: "naddr123" });
    mockUseAuth.mockReturnValue({
      user: { pubkey: "regular-user", isLoggedIn: true },
    });
    mockLoadTestData.mockResolvedValue({ discussion: baseDiscussion });
  });

  const renderLayout = async () => {
    await act(async () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );
    });
    await waitFor(() => expect(mockLoadTestData).toHaveBeenCalledTimes(1));
  };

  describe("ARIA attributes", () => {
    it("renders tablist with proper role", async () => {
      await renderLayout();

      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();
    });

    it("renders tabs with proper role and aria-selected", async () => {
      mockPathname.mockReturnValue("/discussions/naddr123");

      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(2);

      // Main tab should be selected when on main path
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    });

    it("marks audit tab as selected when on audit path", async () => {
      mockPathname.mockReturnValue("/discussions/naddr123/audit");

      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).toHaveAttribute("aria-selected", "false");
      expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("keyboard navigation", () => {
    it("handles ArrowRight key to focus next tab", async () => {
      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      tabs[0].focus();

      fireEvent.keyDown(tabs[0], { key: "ArrowRight" });

      expect(document.activeElement).toBe(tabs[1]);
    });

    it("handles ArrowLeft key to focus previous tab", async () => {
      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      tabs[1].focus();

      fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });

      expect(document.activeElement).toBe(tabs[0]);
    });

    it("handles Home key to focus first tab", async () => {
      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      tabs[1].focus();

      fireEvent.keyDown(tabs[1], { key: "Home" });

      expect(document.activeElement).toBe(tabs[0]);
    });

    it("handles End key to focus last tab", async () => {
      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      tabs[0].focus();

      fireEvent.keyDown(tabs[0], { key: "End" });

      expect(document.activeElement).toBe(tabs[1]);
    });

    it("wraps around on ArrowRight from last tab", async () => {
      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      tabs[1].focus();

      fireEvent.keyDown(tabs[1], { key: "ArrowRight" });

      expect(document.activeElement).toBe(tabs[0]);
    });

    it("wraps around on ArrowLeft from first tab", async () => {
      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      tabs[0].focus();

      fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });

      expect(document.activeElement).toBe(tabs[1]);
    });
  });

  describe("active state styling", () => {
    it("applies active class to main tab when on main path", async () => {
      mockPathname.mockReturnValue("/discussions/naddr123");

      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).toHaveClass("btn-active");
      expect(tabs[1]).not.toHaveClass("btn-active");
    });

    it("applies active class to audit tab when on audit path", async () => {
      mockPathname.mockReturnValue("/discussions/naddr123/audit");

      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).not.toHaveClass("btn-active");
      expect(tabs[1]).toHaveClass("btn-active");
    });
  });

  describe("renders children", () => {
    it("renders children content", async () => {
      await act(async () => {
        render(
          <DiscussionTabLayout baseHref="/discussions/naddr123">
            <div data-testid="child-content">Child Content</div>
          </DiscussionTabLayout>
        );
      });

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });
  });

  describe("touch target size", () => {
    it("has minimum 44px height for touch targets", async () => {
      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      tabs.forEach((tab) => {
        expect(tab).toHaveClass("min-h-[44px]");
      });
    });
  });

  describe("role-based action tabs", () => {
    it("shows approve then edit tabs for creator", async () => {
      mockUseAuth.mockReturnValue({
        user: { pubkey: "author-pubkey", isLoggedIn: true },
      });

      await renderLayout();

      const tabs = screen.getAllByRole("tab");
      const labels = tabs.map((tab) => tab.textContent?.trim());
      expect(labels).toEqual([
        "会話",
        "監査ログ",
        "投稿承認管理",
        "会話を編集",
      ]);
      expect(
        screen.getByRole("tab", { name: "投稿承認管理" })
      ).toHaveAttribute("href", "/discussions/naddr123/approve");
      expect(screen.getByRole("tab", { name: "会話を編集" })).toHaveAttribute(
        "href",
        "/discussions/naddr123/edit"
      );
    });

    it("shows approve tab only for moderator", async () => {
      mockUseAuth.mockReturnValue({
        user: { pubkey: "moderator-pubkey", isLoggedIn: true },
      });

      await renderLayout();

      expect(
        screen.getByRole("tab", { name: "投稿承認管理" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("tab", { name: "会話を編集" })
      ).not.toBeInTheDocument();
    });
  });

  describe("role description block", () => {
    it("shows creator description for creator", async () => {
      mockUseAuth.mockReturnValue({
        user: { pubkey: "author-pubkey", isLoggedIn: true },
      });

      await renderLayout();

      expect(screen.getByText("あなたは作成者です。")).toBeInTheDocument();
      expect(
        screen.getByText("ユーザーとして、新しい意見を投稿できます。")
      ).toBeInTheDocument();
      expect(
        screen.getByText("モデレーターとして、投稿を承認できます。")
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "作成者として、会話を編集できます（説明を書く、モデレーターを指名するなど）。"
        )
      ).toBeInTheDocument();
    });

    it("shows moderator description for moderator", async () => {
      mockUseAuth.mockReturnValue({
        user: { pubkey: "moderator-pubkey", isLoggedIn: true },
      });

      await renderLayout();

      expect(screen.getByText("あなたはモデレーターです。")).toBeInTheDocument();
      expect(
        screen.getByText("ユーザーとして、新しい意見を投稿できます。")
      ).toBeInTheDocument();
      expect(
        screen.getByText("モデレーターとして、投稿を承認できます。")
      ).toBeInTheDocument();
    });

    it("shows user description for regular user", async () => {
      mockUseAuth.mockReturnValue({
        user: { pubkey: "regular-user", isLoggedIn: true },
      });

      await renderLayout();

      expect(screen.getByText("あなたはユーザーです。")).toBeInTheDocument();
      expect(
        screen.getByText("ユーザーとして、新しい意見を投稿できます。")
      ).toBeInTheDocument();
    });
  });
});
