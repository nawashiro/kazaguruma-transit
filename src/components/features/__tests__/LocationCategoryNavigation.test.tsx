import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

export {};

type LocationCategory = {
  category: string;
  "category:en": string;
};

type LocationCategoryNavigationProps = {
  categories: readonly LocationCategory[];
};

type PublicModule = Record<string, unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
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

function loadPublicModule(modulePath: string): ModuleState {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
    const loaded: unknown = require(modulePath);
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error(`Expected ${modulePath} to export an object`),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

function getLocationCategoryNavigation(): React.ComponentType<LocationCategoryNavigationProps> {
  const modulePath = "../LocationCategoryNavigation";
  const state = loadPublicModule(modulePath);

  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `LocationCategoryNavigation is not implemented: public module ${modulePath} could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(
      `LocationCategoryNavigation is not implemented: public module ${modulePath} exported nothing`,
    );
  }

  const component = state.exports.default;
  if (typeof component !== "function") {
    throw new Error(
      `LocationCategoryNavigation is not implemented: public module ${modulePath} does not export a default component`,
    );
  }

  return component as React.ComponentType<LocationCategoryNavigationProps>;
}

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
];

const BASE_URL = "https://kazaguruma.invalid";

function renderNavigation(
  pathname = "/locations/city_office_and_branch_offices",
  searchParams = new URLSearchParams(),
) {
  usePathname.mockReturnValue(pathname);
  useSearchParams.mockReturnValue(searchParams);

  const LocationCategoryNavigation = getLocationCategoryNavigation();
  return render(<LocationCategoryNavigation categories={categories} />);
}

function getCategoryLinks(): HTMLElement[] {
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(categories.length);
  return links;
}

describe("LocationCategoryNavigation", () => {
  beforeEach(() => {
    usePathname.mockReset();
    usePathname.mockReturnValue("/locations/city_office_and_branch_offices");
    useSearchParams.mockReset();
    useSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("renders a semantic nav with every category as a native link", () => {
    renderNavigation();

    const navigation = screen.getByRole("navigation");
    expect(navigation.tagName).toBe("NAV");

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(categories.length);
    expect(links.map((link) => link.textContent)).toEqual(
      categories.map(({ category }) => category),
    );

    categories.forEach(({ category, "category:en": categoryId }) => {
      const link = screen.getByRole("link", { name: category });
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute(
        "href",
        `/locations/${encodeURIComponent(categoryId)}`,
      );
    });
  });

  it("derives the current category from pathname and exposes aria-current page", () => {
    renderNavigation("/locations/natural%20environment%20park");

    const currentLink = screen.getByRole("link", { name: "自然環境公園" });
    expect(currentLink).toHaveAttribute("aria-current", "page");

    expect(screen.getByRole("link", { name: "区役所・出張所" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "図書館" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("preserves a valid origin only on category-to-category links", () => {
    renderNavigation(
      "/locations/city_office_and_branch_offices",
      new URLSearchParams("origin=51.5074%2C-0.1278"),
    );

    getCategoryLinks();
    categories.forEach(({ category, "category:en": categoryId }) => {
      const link = screen.getByRole("link", { name: category });
      expect(link).toHaveAttribute(
        "href",
        `/locations/${encodeURIComponent(categoryId)}?origin=51.5074%2C-0.1278`,
      );
    });
  });

  it.each([
    ["absent", new URLSearchParams()],
    ["invalid", new URLSearchParams("origin=NaN%2C-0.1278")],
  ] as const)(
    "does not preserve an %s origin on category links",
    (_state, searchParams) => {
      renderNavigation(
        "/locations/city_office_and_branch_offices",
        searchParams,
      );

      getCategoryLinks().forEach((link) => {
        const href = new URL(link.getAttribute("href") ?? "", BASE_URL);
        expect(href.searchParams.has("origin")).toBe(false);
      });
    },
  );

  it.each([
    ["detail", "/locations/location-detail/library"],
    ["other", "/routes"],
    ["locations entry", "/locations"],
  ] as const)(
    "does not attach origin when the current pathname is a %s page",
    (_pageKind, pathname) => {
      renderNavigation(pathname, new URLSearchParams("origin=51.5074%2C-0.1278"));

      getCategoryLinks().forEach((link) => {
        const href = new URL(link.getAttribute("href") ?? "", BASE_URL);
        expect(href.searchParams.has("origin")).toBe(false);
      });
    },
  );

  it("keeps every category link natively focusable instead of turning it into a tab", () => {
    renderNavigation();

    screen.getAllByRole("link").forEach((link) => {
      expect(link.tagName).toBe("A");
      expect(link).not.toHaveAttribute("role", "tab");
      expect(link).not.toHaveAttribute("tabindex", "-1");
      expect(link).toHaveAttribute("href");
    });
  });

  it("supports Arrow, Home, and End traversal while focus remains on native links", () => {
    renderNavigation();

    const links = screen.getAllByRole("link");
    links[0].focus();
    fireEvent.keyDown(links[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(links[1]);
    expect(document.activeElement?.tagName).toBe("A");

    fireEvent.keyDown(links[1], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(links[0]);

    fireEvent.keyDown(links[0], { key: "End" });
    expect(document.activeElement).toBe(links[links.length - 1]);
    expect(document.activeElement?.tagName).toBe("A");

    fireEvent.keyDown(links[links.length - 1], { key: "Home" });
    expect(document.activeElement).toBe(links[0]);
    expect(document.activeElement?.tagName).toBe("A");
  });
});
