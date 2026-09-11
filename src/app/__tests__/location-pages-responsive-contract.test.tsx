import React from "react";
import { fireEvent, render, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationCategoryNavigation from "@/components/features/LocationCategoryNavigation";

export {};

type LocationCategory = {
  category: string;
  "category:en": string;
};

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

const REQUIRED_VIEWPORT_WIDTHS = [320, 375, 390, 768, 1024, 1440] as const;
const FORBIDDEN_HORIZONTAL_CLASSES = ["overflow-x-auto", "min-w-max"] as const;
const FORBIDDEN_HORIZONTAL_CLASS_VARIANTS = [
  "overflow-x-auto",
  "md:overflow-x-auto",
  "[&>*]:overflow-x-auto",
  "md:[&>*]:overflow-x-auto",
  "overflow-x-[auto]",
  "md:overflow-x-[auto]",
  "min-w-max",
  "sm:min-w-max",
  "[@media(min-width:768px)]:min-w-max",
  "sm:[&>*]:min-w-[max-content]",
] as const;
const FORBIDDEN_HORIZONTAL_CLASS_FORMS = new Set<string>([
  ...FORBIDDEN_HORIZONTAL_CLASSES,
  "overflow-x-[auto]",
  "min-w-[max-content]",
  "[overflow-x:auto]",
  "[min-width:max-content]",
]);
const CATEGORY_PATH = "/locations/city_office_and_branch_offices";

const mockUsePathname = jest.fn(() => CATEGORY_PATH);
const mockUseSearchParams = jest.fn(() => new URLSearchParams());

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock("next/link", () => {
  const MockLink = React.forwardRef<
    HTMLAnchorElement,
    React.PropsWithChildren<
      React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
    >
  >(({ children, href, ...props }, ref) => (
    <a ref={ref} href={href} {...props}>
      {children}
    </a>
  ));
  MockLink.displayName = "MockLink";

  return {
    __esModule: true,
    default: MockLink,
  };
});

let originalInnerWidthDescriptor: PropertyDescriptor | undefined;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

function renderLocationPage(): ReturnType<typeof render> {
  return render(
    <main
      id="main-content"
      data-location-page="true"
      className="w-full max-w-4xl px-4"
    >
      <LocationCategoryNavigation categories={categories} />
      <section aria-label="場所一覧">
        <h1>場所をさがす</h1>
      </section>
    </main>,
  );
}

function getTailwindUtilitySegment(classToken: string): string {
  let bracketDepth = 0;

  for (let index = classToken.length - 1; index >= 0; index -= 1) {
    const character = classToken[index];
    if (character === "]") {
      bracketDepth += 1;
    } else if (character === "[") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (character === ":" && bracketDepth === 0) {
      return classToken.slice(index + 1);
    }
  }

  return classToken;
}

function isForbiddenHorizontalClassToken(classToken: string): boolean {
  const utility = getTailwindUtilitySegment(classToken).replace(/^!/, "");
  return FORBIDDEN_HORIZONTAL_CLASS_FORMS.has(utility);
}

function getForbiddenHorizontalClassElements(
  root: HTMLElement,
): HTMLElement[] {
  const classElements = [
    ...(root.matches("[class]") ? [root] : []),
    ...Array.from(root.querySelectorAll<HTMLElement>("[class]")),
  ];

  return classElements.filter((element) => {
    const classAttribute = element.getAttribute("class");
    if (classAttribute === null) {
      return false;
    }

    return classAttribute.split(/\s+/).some(isForbiddenHorizontalClassToken);
  });
}

function assertNoHorizontalOverflowWhenLayoutIsExposed(
  element: HTMLElement,
): void {
  const { clientWidth, scrollWidth } = element;

  // jsdom has no CSS layout engine, so 0/0 is not a browser measurement.
  if (clientWidth === 0 && scrollWidth === 0) {
    return;
  }

  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

describe("responsive horizontal class contract", () => {
  it("rejects bare, variant, and arbitrary forbidden utility forms", () => {
    const view = render(
      <div data-testid="forbidden-class-fixtures">
        {FORBIDDEN_HORIZONTAL_CLASS_VARIANTS.map((className) => (
          <span className={className} key={className} />
        ))}
      </div>,
    );

    const fixtureRoot = view.getByTestId("forbidden-class-fixtures");
    expect(getForbiddenHorizontalClassElements(fixtureRoot)).toHaveLength(
      FORBIDDEN_HORIZONTAL_CLASS_VARIANTS.length,
    );
  });
});

beforeEach(() => {
  originalInnerWidthDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "innerWidth",
  );
  mockUsePathname.mockReset();
  mockUsePathname.mockReturnValue(CATEGORY_PATH);
  mockUseSearchParams.mockReset();
  mockUseSearchParams.mockReturnValue(new URLSearchParams());
});

afterEach(() => {
  if (originalInnerWidthDescriptor) {
    Object.defineProperty(window, "innerWidth", originalInnerWidthDescriptor);
  } else {
    Reflect.deleteProperty(window, "innerWidth");
  }
});

/**
 * jsdom does not execute Tailwind/CSS layout. The viewport loop below keeps
 * all six required cases and checks layout-safe DOM/class contracts; it does
 * not claim that changing `innerWidth` measured rendered overflow. Browser
 * `scrollWidth`/`clientWidth` acceptance remains covered by T052H/T057.
 */
describe("Location page responsive navigation contract (T052D correction)", () => {
  it.each(REQUIRED_VIEWPORT_WIDTHS)(
    "%ipx satisfies the jsdom layout-safe contract; browser overflow is measured in T052H/T057",
    (width) => {
      setViewportWidth(width);
      expect(window.innerWidth).toBe(width);
      const view = renderLocationPage();
      const page = view.container.querySelector<HTMLElement>(
        "[data-location-page]",
      );
      expect(page).not.toBeNull();
      if (!page) return;

      assertNoHorizontalOverflowWhenLayoutIsExposed(page);

      const navigation = within(page).getByRole("tablist", {
        name: "場所カテゴリ",
      });
      expect(navigation.tagName).toBe("NAV");
      expect(navigation).toHaveAttribute("role", "tablist");
      expect(navigation).toHaveClass("tabs", "tabs-box");
      assertNoHorizontalOverflowWhenLayoutIsExposed(navigation);
      expect(getForbiddenHorizontalClassElements(page)).toHaveLength(0);

      const tabRow = navigation.querySelector<HTMLElement>("ul") ?? navigation;
      assertNoHorizontalOverflowWhenLayoutIsExposed(tabRow);
      expect(tabRow).toHaveClass("flex", "flex-wrap");
      expect(tabRow).not.toHaveClass(...FORBIDDEN_HORIZONTAL_CLASSES);

      const tabs = within(navigation).getAllByRole("tab");
      expect(tabs).toHaveLength(categories.length);
      expect(tabs.map((tab) => tab.textContent)).toEqual(
        categories.map(({ category }) => category),
      );
      expect(navigation.querySelectorAll('a[role="tab"]')).toHaveLength(
        categories.length,
      );
      tabs.forEach((tab, index) => {
        const category = categories[index];
        const isCurrent = index === 0;
        expect(navigation.contains(tab)).toBe(true);
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
        expect(tab).toHaveClass("whitespace-nowrap");
        expect(tab.querySelector("br")).toBeNull();
        expect(tab).not.toHaveClass(
          "truncate",
          "text-ellipsis",
          "line-clamp-1",
          "overflow-hidden",
        );
        if (isCurrent) {
          expect(tab).toHaveAttribute("aria-current", "page");
          expect(tab).toHaveClass("tab-active", "bg-base-100");
        } else {
          expect(tab).not.toHaveAttribute("aria-current");
          expect(tab).not.toHaveClass("tab-active", "bg-base-100");
        }
      });
    },
  );

  it("keeps responsive navigation keyboard-visible with URL-backed tab semantics", () => {
    setViewportWidth(320);
    const view = renderLocationPage();
    const page = view.container.querySelector<HTMLElement>(
      "[data-location-page]",
    );
    expect(page).not.toBeNull();
    if (!page) return;

    const navigation = within(page).getByRole("tablist", {
      name: "場所カテゴリ",
    });
    const tabs = within(navigation).getAllByRole("tab");
    const initialUrl = window.location.href;
    const initialHrefs = tabs.map((tab) => tab.getAttribute("href"));
    expect(tabs[0]).toHaveAttribute("aria-current", "page");

    tabs.forEach((tab, index) => {
      const isCurrent = index === 0;
      expect(navigation.contains(tab)).toBe(true);
      expect(tab.tagName).toBe("A");
      expect(tab).toHaveAttribute("role", "tab");
      expect(tab).toHaveAttribute("aria-selected", isCurrent ? "true" : "false");
      expect(tab).toHaveAttribute("tabindex", isCurrent ? "0" : "-1");
      expect(tab).toHaveAttribute(
        "aria-controls",
        LOCATION_CATEGORY_PANEL_ID,
      );
      expect(tab).toHaveClass(
        "focus-visible:outline",
        "focus-visible:outline-2",
        "focus-visible:outline-offset-2",
      );
      if (isCurrent) {
        expect(tab).toHaveClass("tab-active", "bg-base-100");
      } else {
        expect(tab).not.toHaveAttribute("aria-current");
        expect(tab).not.toHaveClass("tab-active", "bg-base-100");
      }
      tab.focus();
      expect(document.activeElement).toBe(tab);
    });

    tabs[0]?.focus();
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[1]);

    fireEvent.keyDown(tabs[1] as HTMLElement, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[0]);

    fireEvent.keyDown(tabs[0] as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(tabs[tabs.length - 1]);

    fireEvent.keyDown(tabs[tabs.length - 1] as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(tabs[0]);

    fireEvent.keyDown(tabs[0] as HTMLElement, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[tabs.length - 1]);
    fireEvent.keyDown(tabs[tabs.length - 1] as HTMLElement, {
      key: "ArrowRight",
    });
    expect(document.activeElement).toBe(tabs[0]);

    expect(window.location.href).toBe(initialUrl);
    expect(tabs.map((tab) => tab.getAttribute("href"))).toEqual(initialHrefs);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(
      tabs.slice(1).every((tab) => tab.getAttribute("aria-selected") === "false"),
    ).toBe(true);
  });
});
