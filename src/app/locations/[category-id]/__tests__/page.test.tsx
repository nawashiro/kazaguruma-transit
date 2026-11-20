import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type {
  LocationWithArea,
  LocationCategoryWithArea,
  LocationPageDataResult,
} from "@/lib/location/location-page-data";

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
  Promise<LocationPageDataResult>,
  []
>();
const mockLoadLocationCategories = jest.fn();

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

const farLocation: LocationWithArea = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000001",
  name: "皇居外苑",
  lat: 35.704,
  lng: 139.778,
  area: "神田",
  relatedPages: [],
  osmElement: { type: "node", id: 1 },
  wheelchair: "yes",
  osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
  imageUri: "https://example.test/park-far.jpg",
  imageCreator: "さくら",
  imageLicense: "https://creativecommons.org/licenses/by-sa/4.0/",
};

const nearLocation: LocationWithArea = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000002",
  name: "日比谷公園",
  lat: 35.681,
  lng: 139.761,
  area: "九段南",
  relatedPages: [{ name: "東京バリアフリーマップ", url: "https://example.test/bfm/park" }],
  osmElement: { type: "way", id: 2 },
  wheelchair: "limited",
  osmEditUrl: "https://www.openstreetmap.org/edit?way=2",
};

const unrelatedLocation: LocationWithArea = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000003",
  name: "千代田図書館",
  lat: 35.695,
  lng: 139.765,
  area: "富士見",
  relatedPages: [],
  osmElement: { type: "relation", id: 3 },
  wheelchair: null,
  osmEditUrl: "https://www.openstreetmap.org/edit?relation=3",
};

const locationCategories: LocationCategoryWithArea[] = [
  {
    category: "公園",
    categoryId: "1302",
    // Deliberately keep the source order different from distance order.
    locations: [farLocation, nearLocation],
  },
  {
    category: "図書館",
    categoryId: "1512",
    locations: [unrelatedLocation],
  },
];

function successData(
  categories: LocationCategoryWithArea[] = locationCategories,
): LocationPageDataResult {
  return { status: "success", categories };
}

const emptyData = {
  status: "success",
  categories: [],
} as unknown as LocationPageDataResult;

const malformedData = {
  status: "success",
  categories: [
    {
      category: "公園",
      categoryId: "1302",
      locations: [{ id: "urn:uuid:00000000-0000-4000-8000-000000000001" }],
    },
  ],
} as unknown as LocationPageDataResult;

const duplicateData = successData([
  {
    category: "公園",
    categoryId: "1302",
    locations: [farLocation],
  },
  {
    category: "図書館",
    categoryId: "1512",
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

type GenerateStaticParams = () => Promise<Array<{ "category-id": string }>>;

function getGenerateStaticParams(): GenerateStaticParams {
  if (pageModule.error || !pageModule.exports) {
    throw new Error(
      "/locations/[category-id] page is not implemented: public module ../page could not be loaded",
    );
  }

  const generateStaticParams = pageModule.exports.generateStaticParams;
  if (typeof generateStaticParams !== "function") {
    throw new Error(
      "/locations/[category-id] page is not implemented: public module ../page does not export generateStaticParams",
    );
  }

  return generateStaticParams as GenerateStaticParams;
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
}

beforeEach(() => {
  mockNotFound.mockClear();
  mockLoadLocationPageData.mockReset();
  mockLoadLocationPageData.mockResolvedValue(successData());
  mockLoadLocationCategories.mockReset();
  mockLoadLocationCategories.mockResolvedValue(locationCategories);
});

describe("server category page", () => {
  it("generates static params only for the category IDs present in the artifact", async () => {
    const generateStaticParams = getGenerateStaticParams();

    const params = await generateStaticParams();

    expect(params).toEqual([
      { "category-id": "1302" },
      { "category-id": "1512" },
    ]);
    expect(mockLoadLocationPageData).toHaveBeenCalledTimes(1);
  });

  it("decodes a category code ID and uniquely renders only that category", async () => {
    const page = getCategoryPage();

    const encodedCategoryId = encodeURIComponent("1302");
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
      `/locations/location-detail/${encodeURIComponent(nearLocation.id)}`,
      `/locations/location-detail/${encodeURIComponent(farLocation.id)}`,
    ]);
  });

  it("uses the public location-page data boundary without invoking legacy location loaders", async () => {
    const page = getCategoryPage();

    const invocation = await invokePage(
      page,
      encodeURIComponent("1302"),
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
      encodeURIComponent("1302"),
    );
    if (!renderSuccessfulPage(invocation)) {
      return;
    }

    expectAreaHeadingOrder("九段南", "神田");
    const detailLinks = getNativeDetailLinks();
    expect(detailLinks[0]).toHaveTextContent(nearLocation.name);
    expect(detailLinks[1]).toHaveTextContent(farLocation.name);
  });

  it("shows a non-URI license as text on the card", async () => {
    const location: LocationWithArea = {
      ...farLocation,
      id: "urn:uuid:00000000-0000-4000-8000-000000000099",
      imageLicense: "Public domain",
      image: {
        width: 1280,
        height: 853,
        variants: [
          { width: 480, path: "/generated/location-images/0123456789abcdef-480.webp" },
          { width: 960, path: "/generated/location-images/fedcba9876543210-960.webp" },
          { width: 1280, path: "/generated/location-images/89abcdef01234567-1280.webp" },
        ],
      },
    };
    mockLoadLocationPageData.mockResolvedValue(successData([
      { category: "公園", categoryId: "1302", locations: [location] },
    ]));
    const page = getCategoryPage();

    const invocation = await invokePage(page, encodeURIComponent("1302"));
    if (!renderSuccessfulPage(invocation)) {
      return;
    }

    const attribution = screen.getByText("写真 さくら・Public domain");
    expect(attribution.tagName).toBe("P");
    expect(attribution.querySelector("a")).toBeNull();
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
    readonly [string, LocationPageDataResult]
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
        encodeURIComponent("1302"),
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
      encodeURIComponent("1302"),
    );
    if (!renderSuccessfulPage(invocation)) {
      return;
    }

    expect(screen.getByRole("status")).toHaveTextContent(/町字/);
    expectAreaHeadingOrder("九段南", "神田");
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("shows the distance-sorted page output for a valid origin", async () => {
    const page = getCategoryPage();

    const invocation = await invokePage(
      page,
      encodeURIComponent("1302"),
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
      encodeURIComponent("1302"),
      "NaN,not-a-coordinate",
    );
    if (!renderSuccessfulPage(invocation)) {
      return;
    }

    expect(screen.getByRole("alert")).toHaveTextContent(/origin|座標|緯度|経度|位置情報/i);
    expect(screen.getByRole("status")).toHaveTextContent(/町字/);
    expectAreaHeadingOrder("九段南", "神田");
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
