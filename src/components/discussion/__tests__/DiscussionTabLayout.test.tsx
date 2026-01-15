import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
const mockPathname = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Import after mocking
import { DiscussionTabLayout } from "../DiscussionTabLayout";

describe("DiscussionTabLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/discussions/naddr123");
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
    });

    it("renders tabs with proper role and aria-selected", () => {
      mockPathname.mockReturnValue("/discussions/naddr123");

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(2);

      // Main tab should be selected when on main path
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(tabs[1]).toHaveAttribute("aria-selected", "false");
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
      tabs[1].focus();

      fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });

      expect(document.activeElement).toBe(tabs[0]);
    });

    it("handles Home key to focus first tab", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[1].focus();

      fireEvent.keyDown(tabs[1], { key: "Home" });

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

      expect(document.activeElement).toBe(tabs[1]);
    });

    it("wraps around on ArrowRight from last tab", () => {
      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[1].focus();

      fireEvent.keyDown(tabs[1], { key: "ArrowRight" });

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

      expect(document.activeElement).toBe(tabs[1]);
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
      expect(tabs[0]).toHaveClass("btn-active");
      expect(tabs[1]).not.toHaveClass("btn-active");
    });

    it("applies active class to audit tab when on audit path", () => {
      mockPathname.mockReturnValue("/discussions/naddr123/audit");

      render(
        <DiscussionTabLayout baseHref="/discussions/naddr123">
          <div>Content</div>
        </DiscussionTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).not.toHaveClass("btn-active");
      expect(tabs[1]).toHaveClass("btn-active");
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
