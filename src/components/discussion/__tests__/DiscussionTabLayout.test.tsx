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
      expect(tabs).toHaveLength(4);

      // Main tab should be selected when on main path
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(tabs[1]).toHaveAttribute("aria-selected", "false");
      expect(tabs[2]).toHaveAttribute("aria-selected", "false");
      expect(tabs[3]).toHaveAttribute("aria-selected", "false");
    });

    it("marks audit tab as selected when on audit path", () => {
      mockPathname.mockReturnValue("/discussions/naddr123/audit");

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).toHaveAttribute("aria-selected", "false");
      expect(tabs[1]).toHaveAttribute("aria-selected", "true");
      expect(tabs[2]).toHaveAttribute("aria-selected", "false");
      expect(tabs[3]).toHaveAttribute("aria-selected", "false");
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
      expect(tabs).toHaveLength(4);
      expect(tabs[2]).toHaveAttribute("aria-selected", "false");
      expect(tabs[3]).toHaveAttribute("aria-selected", "false");
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
      tabs[3].focus();

      fireEvent.keyDown(tabs[3], { key: "ArrowLeft" });

      expect(document.activeElement).toBe(tabs[2]);
    });

    it("handles Home key to focus first tab", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[3].focus();

      fireEvent.keyDown(tabs[3], { key: "Home" });

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

      expect(document.activeElement).toBe(tabs[3]);
    });

    it("wraps around on ArrowRight from last tab", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[3].focus();

      fireEvent.keyDown(tabs[3], { key: "ArrowRight" });

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

      expect(document.activeElement).toBe(tabs[3]);
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

    it("applies active class to audit tab when on audit path", () => {
      mockPathname.mockReturnValue("/discussions/naddr123/audit");

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).not.toHaveClass("tab-active");
      expect(tabs[1]).toHaveClass("tab-active");
      expect(tabs[2]).not.toHaveClass("tab-active");
    });
  });

  describe("renders children", () => {
    it("renders children content", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div data-testid="child-content">Child Content</div>
        </DiscussionTabLayout>
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
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
