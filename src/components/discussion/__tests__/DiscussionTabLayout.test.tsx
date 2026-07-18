import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
const mockPathname = jest.fn();
const mockParams = jest.fn();
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
    relays: ["wss://relay.example.com"],
  })),
}));
jest.mock("@/lib/test/test-data-loader", () => ({
  loadTestData: jest.fn(),
  isTestMode: jest.fn(() => false),
}));
jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => null, // Return null for basic tests
}));
jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ user: { pubkey: null, isLoggedIn: false } }),
}));
jest.mock("@/lib/nostr/nostr-utils", () => ({
  parseDiscussionEvent: jest.fn(() => null),
  getAdminPubkeyHex: jest.fn(() => "admin-pubkey"),
  isModerator: jest.fn(() => false),
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
  useDiscussionMeta,
} from "../DiscussionTabLayout";

function DiscussionMetaProbe() {
  const meta = useDiscussionMeta();
  return <div>{meta?.isLoading ? "loading" : meta?.error ?? "ready"}</div>;
}

describe("DiscussionTabLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/discussions/naddr123");
    mockParams.mockReturnValue({ naddr: "naddr123" });
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
    it("不正なNADDRでは読み込みを終了してエラー状態にする", async () => {
      render(
        <DiscussionTabLayout
          baseHref="/discussions/moderator"
          naddr="invalid"
          showNavigation={false}
        >
          <DiscussionMetaProbe />
        </DiscussionTabLayout>,
      );

      expect(
        await screen.findByText("会話情報の指定が正しくありません。"),
      ).toBeInTheDocument();
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
