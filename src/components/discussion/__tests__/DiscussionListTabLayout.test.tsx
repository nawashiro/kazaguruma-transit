import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next/navigation
const mockPathname = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Import after mocking
import { DiscussionListTabLayout } from "../DiscussionListTabLayout";

describe("DiscussionListTabLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/discussions");
  });

  describe("ARIA attributes", () => {
    it("renders tablist with proper role", () => {
      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();
    });

    it("renders tabs with proper role and aria-selected", () => {
      mockPathname.mockReturnValue("/discussions");

      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(2);

      // Main tab should be selected when on main path
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    });

    it("marks audit tab as selected when on audit path", () => {
      mockPathname.mockReturnValue("/discussions/audit");

      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).toHaveAttribute("aria-selected", "false");
      expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("keyboard navigation", () => {
    it("handles ArrowRight key to focus next tab", () => {
      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[0].focus();

      fireEvent.keyDown(tabs[0], { key: "ArrowRight" });

      expect(document.activeElement).toBe(tabs[1]);
    });

    it("handles ArrowLeft key to focus previous tab", () => {
      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[1].focus();

      fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });

      expect(document.activeElement).toBe(tabs[0]);
    });

    it("handles Home key to focus first tab", () => {
      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[1].focus();

      fireEvent.keyDown(tabs[1], { key: "Home" });

      expect(document.activeElement).toBe(tabs[0]);
    });

    it("handles End key to focus last tab", () => {
      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[0].focus();

      fireEvent.keyDown(tabs[0], { key: "End" });

      expect(document.activeElement).toBe(tabs[1]);
    });

    it("wraps around on ArrowRight from last tab", () => {
      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[1].focus();

      fireEvent.keyDown(tabs[1], { key: "ArrowRight" });

      expect(document.activeElement).toBe(tabs[0]);
    });

    it("wraps around on ArrowLeft from first tab", () => {
      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs[0].focus();

      fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });

      expect(document.activeElement).toBe(tabs[1]);
    });
  });

  describe("active state styling", () => {
    it("applies active class to main tab when on main path", () => {
      mockPathname.mockReturnValue("/discussions");

      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).toHaveClass("btn-active");
      expect(tabs[1]).not.toHaveClass("btn-active");
    });

    it("applies active class to audit tab when on audit path", () => {
      mockPathname.mockReturnValue("/discussions/audit");

      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]).not.toHaveClass("btn-active");
      expect(tabs[1]).toHaveClass("btn-active");
    });
  });

  describe("renders children", () => {
    it("renders children content", () => {
      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div data-testid="child-content">Child Content</div>
        </DiscussionListTabLayout>
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });
  });

  describe("touch target size", () => {
    it("has minimum 44px height for touch targets", () => {
      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const tabs = screen.getAllByRole("tab");
      tabs.forEach((tab) => {
        expect(tab).toHaveClass("min-h-[44px]");
      });
    });
  });

  describe("tab labels", () => {
    it("displays correct tab labels for discussion list", () => {
      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      expect(screen.getByText("会話一覧")).toBeInTheDocument();
      expect(screen.getByText("監査ログ")).toBeInTheDocument();
    });
  });

  describe("header elements", () => {
    it("displays title and description above tabs", () => {
      render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      // タイトルが表示される
      const title = screen.getByRole("heading", { level: 1, name: "意見交換" });
      expect(title).toBeInTheDocument();

      // 説明が表示される
      expect(
        screen.getByText(
          "意見交換を行うために自由に利用していい場所です。誰でも新しい会話を作成できます。"
        )
      ).toBeInTheDocument();
    });

    it("renders header elements before tab navigation", () => {
      const { container } = render(
        <DiscussionListTabLayout baseHref="/discussions">
          <div>Content</div>
        </DiscussionListTabLayout>
      );

      const title = screen.getByRole("heading", { level: 1 });
      const tablist = screen.getByRole("tablist");

      // タイトルがタブリストより前に表示される
      const titleIndex = Array.from(container.querySelectorAll("*")).indexOf(
        title
      );
      const tablistIndex = Array.from(container.querySelectorAll("*")).indexOf(
        tablist
      );

      expect(titleIndex).toBeLessThan(tablistIndex);
    });
  });
});
