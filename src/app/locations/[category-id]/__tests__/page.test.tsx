import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type {
  KeyLocation,
  KeyLocationCategory,
  KeyLocationsDataResult,
} from "../../../../utils/addressLoader";

export {};

type CategoryPageProps = {
  params: Promise<{ "category-id": string }>;
  searchParams: Promise<{ origin?: string | string[] }>;
};

type CategoryPage = (
  props: CategoryPageProps,
) => React.ReactNode | Promise<React.ReactNode>;

type PublicModule = Record<string, unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

type PageInvocation = {
  element: React.ReactNode | null;
  error: unknown | null;
};

const NEXT_NOT_FOUND = Symbol("NEXT_NOT_FOUND");
const mockNotFound = jest.fn(() => {
  throw NEXT_NOT_FOUND;
});
const mockLoadLocationPageData = jest.fn<
  Promise<KeyLocationsDataResult>,
  []
>();
const mockLoadLocationCategories = jest.fn();
const mockLoadKeyLocationsData = jest.fn();

jest.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

jest.mock("@/lib/location/location-page-data", () => {
  const actual = jest.requireActual("@/lib/location/location-page-data");
  return {
    ...actual,
    loadLocationPageData: mockLoadLocationPageData,
  };
});

jest.mock("@/lib/location/location-list-state", () => {
  const actual = jest.requireActual("@/lib/location/location-list-state");
  return {
    ...actual,
    loadLocationCategories: (...args: unknown[]) =>
      mockLoadLocationCategories(...args),
  };
});

jest.mock("@/utils/addressLoader", () => {
  const actual = jest.requireActual("@/utils/addressLoader");
  return {
    ...actual,
    loadKeyLocationsData: (...args: unknown[]) =>
      mockLoadKeyLocationsData(...args),
  };
});

const farLocation: KeyLocation = {
  id: "park-far-日本",
  name: "皇居外苑入口",
  lat: 35.704,
  lng: 139.778,
  area: "神田",
  description: "自然環境公園の入口です",
  uri: "https://example.test/park-far",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const nearLocation: KeyLocation = {
  id: "park-near",
  name: "日比谷公園入口",
  lat: 35.681,
  lng: 139.761,
  area: "九段南",
  description: "近い自然環境公園です",
  uri: "https://example.test/park-near",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const unrelatedLocation: KeyLocation = {
  id: "library-unrelated",
  name: "カテゴリ外図書館",
  lat: 35.695,
  lng: 139.765,
  area: "富士見",
  description: "別カテゴリの場所です",
  uri: "https://example.test/library-unrelated",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const locationCategories: KeyLocationCategory[] = [
  {
    category: "自然環境公園",
    "category:en": "natural environment park",
    // Deliberately keep the source order different from distance order.
    locations: [farLocation, nearLocation],
  },
  {
    category: "公共施設",
    "category:en": "public facilities",
    locations: [unrelatedLocation],
  },
];

function successData(
  categories: KeyLocationCategory[] = locationCategories,
): KeyLocationsDataResult {
  return { status: "success", categories };
}

const emptyData = {
  status: "success",
  categories: [],
} as unknown as KeyLocationsDataResult;

const malformedData = {
  status: "success",
  categories: [
    {
      category: "自然環境公園",
      "category:en": "natural environment park",
      locations: [{ id: "missing-required-fields" }],
    },
  ],
} as unknown as KeyLocationsDataResult;

const duplicateData = successData([
  {
    category: "自然環境公園",
    "category:en": "natural environment park",
    locations: [farLocation],
  },
  {
    category: "公共施設",
    "category:en": "public facilities",
    locations: [{ ...farLocation, name: "重複IDの施設" }],
  },
]);

function loadPageModule(): ModuleState {
  try {
    // Guarded loading keeps the pre-implementation RED named rather than a collection error.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- public route boundary
    const loaded: unknown = require("../page");
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error("expected the category page module to export an object"),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

const pageModule = loadPageModule();

function getCategoryPage(): CategoryPage {
  if (pageModule.error) {
    const detail =
      pageModule.error instanceof Error
        ? pageModule.error.message
        : String(pageModule.error);
    throw new Error(
      `/locations/[category-id] page is not implemented: public module ../page could not be loaded (${detail})`,
    );
  }

  if (!pageModule.exports) {
    throw new Error(
      "/locations/[category-id] page is not implemented: public module ../page exported nothing",
    );
  }

  const page = pageModule.exports.default;
  if (typeof page !== "function") {
    throw new Error(
      "/locations/[category-id] page is not implemented: public module ../page does not export a default page",
    );
  }

  return page as CategoryPage;
}

async function invokePage(
  page: CategoryPage,
  categoryId: string,
  origin?: string,
): Promise<PageInvocation> {
  try {
    const element = await page({
      params: Promise.resolve({ "category-id": categoryId }),
      searchParams: Promise.resolve(origin === undefined ? {} : { origin }),
    });
    return { element, error: null };
  } catch (error) {
    return { element: null, error };
  }
}

function requireSuccessfulPageElement(
  invocation: PageInvocation,
): React.ReactElement | null {
  expect(invocation.error).toBeNull();
  expect(React.isValidElement(invocation.element)).toBe(true);
  return React.isValidElement(invocation.element) ? invocation.element : null;
}

function renderSuccessfulPage(invocation: PageInvocation): boolean {
  const element = requireSuccessfulPageElement(invocation);
  if (!element) {
    return false;
  }
  render(<main>{element}</main>);
  return true;
}

function getNativeDetailLinks(): HTMLAnchorElement[] {
  return Array.from(
    document.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/locations/location-detail/"]',
    ),
  );
}

function expectAreaHeadingOrder(firstName: string, secondName: string): void {
  const first = screen.getByRole("heading", { name: firstName });
  const second = screen.getByRole("heading", { name: secondName });
  expect(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
}

function expectNoLegacyLocationLoaderCalls(): void {
  expect(mockLoadLocationCategories).not.toHaveBeenCalled();
  expect(mockLoadKeyLocationsData).not.toHaveBeenCalled();
}

beforeEach(() => {
  mockNotFound.mockClear();
  mockLoadLocationPageData.mockReset();
  mockLoadLocationPageData.mockResolvedValue(successData());
  mockLoadLocationCategories.mockReset();
  mockLoadLocationCategories.mockResolvedValue(locationCategories);
  mockLoadKeyLocationsData.mockReset();
  mockLoadKeyLocationsData.mockResolvedValue(locationCategories);
});

describe("server category page", () => {
  it("decodes a space-containing category:en ID and uniquely renders only that category", async () => {
    const page = getCategoryPage();

    const encodedCategoryId = encodeURIComponent("natural environment park");
    const invocation = await invokePage(page, encodedCategoryId);
    if (!renderSuccessfulPage(invocation)) {
      return;
    }

    expect(screen.getByRole("heading", { level: 1, name: "場所をさがす" })).toBeInTheDocument();
    expect(screen.getByText(farLocation.name)).toBeInTheDocument();
    expect(screen.getByText(nearLocation.name)).toBeInTheDocument();
    expect(screen.queryByText(unrelatedLocation.name)).not.toBeInTheDocument();
    expect(mockLoadLocationPageData).toHaveBeenCalledTimes(1);

    const detailLinks = getNativeDetailLinks();
    expect(detailLinks).toHaveLength(2);
    expect(detailLinks.map((link) => link.tagName)).toEqual(["A", "A"]);
    expect(detailLinks.map((link) => link.getAttribute("href"))).toEqual([
      `/locations/location-detail/${encodeURIComponent(farLocation.id)}`,
      `/locations/location-detail/${encodeURIComponent(nearLocation.id)}`,
    ]);
  });

  it("uses the public location-page data boundary without invoking legacy location loaders", async () => {
    const page = getCategoryPage();

    const invocation = await invokePage(
      page,
      encodeURIComponent("natural environment park"),
    );

    expect(invocation.error).toBeNull();
    expect(React.isValidElement(invocation.element)).toBe(true);
    expect(mockLoadLocationPageData).toHaveBeenCalledTimes(1);
    expectNoLegacyLocationLoaderCalls();
  });

  it("renders the server-provided areas in a deterministic order with their matching locations", async () => {
    const page = getCategoryPage();

    const invocation = await invokePage(
      page,
      encodeURIComponent("natural environment park"),
    );
    if (!renderSuccessfulPage(invocation)) {
      return;
    }

    expectAreaHeadingOrder("神田", "九段南");
    const detailLinks = getNativeDetailLinks();
    expect(detailLinks[0]).toHaveTextContent(farLocation.name);
    expect(detailLinks[1]).toHaveTextContent(nearLocation.name);
  });

  it.each([
    ["unknown", "does-not-exist"],
    ["empty", ""],
    ["malformed", "%E0%A4%A"],
  ] as const)(
    "uses the Next standard notFound boundary for a %s category ID instead of page UI",
    async (_caseName, categoryId) => {
      const page = getCategoryPage();

      const invocation = await invokePage(page, categoryId);

      expect(invocation.error).toBe(NEXT_NOT_FOUND);
      expect(invocation.element).toBeNull();
      expect(mockNotFound).toHaveBeenCalledTimes(1);
    },
  );

  const pageDataFailureCases: ReadonlyArray<
    readonly [string, KeyLocationsDataResult]
  > = [
    ["loader failure", { status: "error", error: new Error("CDN unavailable") }],
    ["malformed data", malformedData],
    ["duplicate location IDs", duplicateData],
    ["empty categories", emptyData],
  ];

  it.each(pageDataFailureCases)(
    "renders a Japanese data-error boundary, distinct from 404, for %s",
    async (_caseName, result) => {
      const page = getCategoryPage();

      mockLoadLocationPageData.mockResolvedValueOnce(result);
      const invocation = await invokePage(
        page,
        encodeURIComponent("natural environment park"),
      );
      if (!renderSuccessfulPage(invocation)) {
        return;
      }

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/場所データ|施設データ/);
      expect(alert).not.toHaveTextContent(/404/);
      expect(mockNotFound).not.toHaveBeenCalled();
      expect(screen.queryByRole("heading", { name: "自然環境公園" })).not.toBeInTheDocument();
    },
  );

  it("shows the town-grouped page output when origin is absent", async () => {
    const page = getCategoryPage();

    const invocation = await invokePage(
      page,
      encodeURIComponent("natural environment park"),
    );
    if (!renderSuccessfulPage(invocation)) {
      return;
    }

    expect(screen.getByRole("status")).toHaveTextContent(/町字/);
    expectAreaHeadingOrder("神田", "九段南");
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("shows the distance-sorted page output for a valid origin", async () => {
    const page = getCategoryPage();

    const invocation = await invokePage(
      page,
      encodeURIComponent("natural environment park"),
      "35.680000,139.760000",
    );
    if (!renderSuccessfulPage(invocation)) {
      return;
    }

    expect(screen.getByRole("status")).toHaveTextContent(/距離|近い順/);
    const detailLinks = getNativeDetailLinks();
    expect(detailLinks.map((link) => link.textContent)).toEqual([
      expect.stringContaining(nearLocation.name),
      expect.stringContaining(farLocation.name),
    ]);
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("shows a Japanese invalid-origin boundary and falls back to the town grouping", async () => {
    const page = getCategoryPage();

    const invocation = await invokePage(
      page,
      encodeURIComponent("natural environment park"),
      "NaN,not-a-coordinate",
    );
    if (!renderSuccessfulPage(invocation)) {
      return;
    }

    expect(screen.getByRole("alert")).toHaveTextContent(/origin|座標|緯度|経度|位置情報/i);
    expect(screen.getByRole("status")).toHaveTextContent(/町字/);
    expectAreaHeadingOrder("神田", "九段南");
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
