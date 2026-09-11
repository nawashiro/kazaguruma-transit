import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationCategoryNavigation from "../LocationCategoryNavigation";

type LocationCategory = {
  category: string;
  "category:en": string;
};

const usePathname = jest.fn(() => "/locations/city_office_and_branch_offices");
const useSearchParams = jest.fn(() => new URLSearchParams());

jest.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useSearchParams: () => useSearchParams(),
}));

jest.mock("next/link", () => {
  const MockLink = React.forwardRef<
    HTMLAnchorElement,
    React.PropsWithChildren<
      React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
    >
  >(({ children, ...props }, ref) => (
    <a ref={ref} {...props}>
      {children}
    </a>
  ));
  MockLink.displayName = "MockLink";

  return {
    __esModule: true,
    default: MockLink,
  };
});

const categories: readonly LocationCategory[] = [
  {
    category: "区役所・出張所",
    "category:en": "city_office_and_branch_offices",
  },
  {
    category: "自然環境公園",
    "category:en": "natural environment park",
  },
  {
    category: "図書館",
    "category:en": "libraries",
  },
  {
    category: "区内の公園・緑地・自然環境に関する長いカテゴリ名",
    "category:en": "long-natural-environment-category",
  },
];

const LOCATION_CATEGORY_PANEL_ID = "location-category-panel";

function renderNavigation(
  pathname = "/locations/city_office_and_branch_offices",
  searchParams = new URLSearchParams(),
) {
  usePathname.mockReturnValue(pathname);
  useSearchParams.mockReturnValue(searchParams);

  return render(<LocationCategoryNavigation categories={categories} />);
}

describe("LocationCategoryNavigation visual active state", () => {
  beforeEach(() => {
    usePathname.mockReset();
    usePathname.mockReturnValue("/locations/city_office_and_branch_offices");
    useSearchParams.mockReset();
    useSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("applies the active background only to the current category tab", () => {
    renderNavigation("/locations/natural%20environment%20park");

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(categories.length);

    const currentTab = screen.getByRole("tab", { name: "自然環境公園" });
    expect(currentTab.tagName).toBe("A");
    expect(currentTab).toHaveClass("tab-active", "bg-base-100");
    expect(currentTab).toHaveAttribute("aria-selected", "true");
    expect(currentTab).toHaveAttribute("aria-current", "page");
    expect(currentTab).toHaveAttribute(
      "aria-controls",
      LOCATION_CATEGORY_PANEL_ID,
    );
    expect(currentTab).toHaveAttribute("tabindex", "0");

    tabs
      .filter((tab) => tab !== currentTab)
      .forEach((tab) => {
        expect(tab.tagName).toBe("A");
        expect(tab).toHaveAttribute("aria-selected", "false");
        expect(tab).toHaveAttribute("tabindex", "-1");
        expect(tab).not.toHaveClass("tab-active", "bg-base-100");
        expect(tab).not.toHaveAttribute("aria-current");
        expect(tab).toHaveAttribute(
          "aria-controls",
          LOCATION_CATEGORY_PANEL_ID,
        );
      });
  });

  it("exposes discussion-style tab semantics while keeping native category Links", () => {
    renderNavigation("/locations/natural%20environment%20park");

    const tablist = screen.getByRole("tablist", { name: "場所カテゴリ" });
    expect(tablist.tagName).toBe("NAV");
    expect(tablist).toHaveAttribute("role", "tablist");
    expect(tablist).toHaveClass("tabs", "tabs-box");

    const tabRow = tablist.querySelector<HTMLElement>("ul") ?? tablist;
    expect(tabRow).toHaveClass("flex", "flex-wrap");

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(categories.length);
    expect(tablist.querySelectorAll('a[role="tab"]')).toHaveLength(
      categories.length,
    );

    tabs.forEach((tab, index) => {
      const category = categories[index];
      const isCurrent = category?.category === "自然環境公園";
      expect(tablist.contains(tab)).toBe(true);
      expect(tab.tagName).toBe("A");
      expect(tab).toHaveAttribute("role", "tab");
      expect(tab).toHaveAttribute(
        "href",
        `/locations/${encodeURIComponent(category?.["category:en"] ?? "")}`,
      );
      expect(tab).toHaveAttribute(
        "aria-selected",
        isCurrent ? "true" : "false",
      );
      expect(tab).toHaveAttribute(
        "aria-controls",
        LOCATION_CATEGORY_PANEL_ID,
      );
      expect(tab).toHaveAttribute("tabindex", isCurrent ? "0" : "-1");
      if (isCurrent) {
        expect(tab).toHaveAttribute("aria-current", "page");
      } else {
        expect(tab).not.toHaveAttribute("aria-current");
      }
    });
  });

  it("supports Arrow, Home, and End focus traversal without changing the URL", () => {
    renderNavigation();

    const tabs = screen.getAllByRole("tab");
    const initialUrl = window.location.href;
    const initialHrefs = tabs.map((tab) => tab.getAttribute("href"));
    tabs[0]?.focus();
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[1]);

    fireEvent.keyDown(tabs[1] as HTMLElement, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[0]);

    fireEvent.keyDown(tabs[0] as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(tabs[tabs.length - 1]);

    fireEvent.keyDown(tabs[tabs.length - 1] as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(tabs[0]);

    expect(window.location.href).toBe(initialUrl);
    expect(tabs.map((tab) => tab.getAttribute("href"))).toEqual(initialHrefs);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs.slice(1).every((tab) => tab.getAttribute("aria-selected") === "false")).toBe(
      true,
    );
  });
});
