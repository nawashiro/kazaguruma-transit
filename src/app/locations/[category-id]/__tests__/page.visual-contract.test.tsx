import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type {
  KeyLocation,
  KeyLocationCategory,
  KeyLocationsDataResult,
} from "../../../../utils/addressLoader";

type CategoryPageProps = {
  params: Promise<{ "category-id": string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type CategoryPage = (
  props: CategoryPageProps,
) => React.ReactNode | Promise<React.ReactNode>;

const PAGE_TITLE = "場所をさがす";
const PAGE_DESCRIPTION = "位置とカテゴリから千代田区のスポットをさがす";
const CARD_TITLES = ["カテゴリを選択", "並べ替え", "データ提供元"] as const;
const AUXILIARY_CAROUSEL_TITLES = [
  "悩みがあるけど、どうしたらいい？",
  "今夜、安心して泊まれる場所がない",
  "イベントを知る",
] as const;

const mockNotFound = jest.fn(() => {
  throw new Error("unexpected category notFound() in visual-contract fixture");
});
const mockUsePathname = jest.fn(() => "/locations/visual%20contract%20category");
const mockUseSearchParams = jest.fn(() => new URLSearchParams());
const mockUseRouter = jest.fn(() => ({ replace: jest.fn() }));
const mockLoadLocationPageData = jest.fn<
  Promise<KeyLocationsDataResult>,
  []
>();

jest.mock("next/navigation", () => ({
  notFound: mockNotFound,
  usePathname: () => mockUsePathname(),
  useRouter: () => mockUseRouter(),
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock("@/lib/location/location-page-data", () => {
  const actual = jest.requireActual("@/lib/location/location-page-data");
  return {
    ...actual,
    loadLocationPageData: mockLoadLocationPageData,
  };
});

const fixtureLocation: KeyLocation = {
  id: "visual-contract-location",
  name: "視覚契約テストの場所",
  lat: 35.681,
  lng: 139.761,
  area: "東京都千代田区神田和泉町",
  description: "視覚契約を確認するための場所です",
  uri: "https://example.test/visual-contract-location",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const fixtureCategory: KeyLocationCategory = {
  category: "視覚契約カテゴリ",
  "category:en": "visual contract category",
  locations: [fixtureLocation],
};

const LONG_LOCATION_NAME =
  "千代田区立神田和泉町多目的交流文化観光案内施設";
const LONG_AREA_SOURCE_NAME = "東京都千代田区神田和泉町";
const LONG_AREA_NAME = "神田和泉町";
const OTHER_AREA_NAME = "その他";
const DATA_PROVIDER_SOURCE_HREF =
  "https://github.com/nawashiro/chiyoda_city_main_facilities";
const DATA_PROVIDER_FORM_HREF =
  "https://docs.google.com/forms/d/e/1FAIpQLSeZ1eufe_2aZkRWQwr-RuCceUYUMJ7WmSfUr1ZsX5QTDRqFKQ/viewform?usp=header";
const DATA_PROVIDER_SOURCE_DESCRIPTION =
  "この場所データは、ボランティアがつくった千代田区主要施設座標データによる「風かざぐるまの停留所から徒歩圏内（600m以内）であることがわかっている場所」を使用しています。";
const DATA_PROVIDER_CORRECTION_DESCRIPTION =
  "誤りが含まれていたり、古いデータが残っていたり、新たに加えてほしい場所があるときは、直接プルリクエストを送るか、こちらのフォームからお知らせください。";

const townVisualLocations: KeyLocation[] = [
  {
    id: "visual-long-location",
    name: LONG_LOCATION_NAME,
    lat: 35.681,
    lng: 139.761,
    area: LONG_AREA_SOURCE_NAME,
    description: "長い場所名と地域名が切断されないかを確認する説明文です",
    imageUri: "https://example.test/visual-long-location.jpg",
    uri: "https://example.test/visual-long-location",
    nodeCopyright: "千代田区",
    licence: "CC BY 4.0",
    licenceUri: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "visual-kanda-location",
    name: "神田の視覚契約施設",
    lat: 35.682,
    lng: 139.762,
    area: "神田",
    description: "神田地域の施設です",
    nodeCopyright: "千代田区",
    licence: "CC BY 4.0",
    licenceUri: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "visual-kudan-location",
    name: "九段南の視覚契約施設",
    lat: 35.683,
    lng: 139.763,
    area: "九段南",
    description: "九段南地域の施設です",
    nodeCopyright: "千代田区",
    licence: "CC BY 4.0",
    licenceUri: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "visual-other-location",
    name: "その他の視覚契約施設",
    lat: 35.684,
    lng: 139.764,
    area: OTHER_AREA_NAME,
    description: "その他地域の施設です",
    nodeCopyright: "千代田区",
    licence: "CC BY 4.0",
    licenceUri: "https://creativecommons.org/licenses/by/4.0/",
  },
];

const townVisualCategory: KeyLocationCategory = {
  category: "視覚契約カテゴリ",
  "category:en": "visual contract category",
  locations: townVisualLocations,
};

const distanceVisualLocations: KeyLocation[] = [
  {
    id: "visual-distance-zero",
    name: "距離帯0キロの施設",
    lat: 35.6815,
    lng: 139.7615,
    area: LONG_AREA_SOURCE_NAME,
    description: "四捨五入で0キロになる施設です",
    nodeCopyright: "千代田区",
    licence: "CC BY 4.0",
    licenceUri: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "visual-distance-one",
    name: "距離帯1キロの施設",
    lat: 35.69,
    lng: 139.761,
    area: "神田",
    description: "四捨五入で1キロになる施設です",
    nodeCopyright: "千代田区",
    licence: "CC BY 4.0",
    licenceUri: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "visual-distance-one-tie-first",
    name: "距離帯1キロ同距離先の施設",
    lat: 35.69,
    lng: 139.761,
    area: "神田",
    description: "距離帯1キロで元データ順を確認する施設です",
    nodeCopyright: "千代田区",
    licence: "CC BY 4.0",
    licenceUri: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "visual-distance-one-tie-second",
    name: "距離帯1キロ同距離後の施設",
    lat: 35.69,
    lng: 139.761,
    area: "神田",
    description: "距離帯1キロで元データ順を確認する別施設です",
    nodeCopyright: "千代田区",
    licence: "CC BY 4.0",
    licenceUri: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "visual-distance-three",
    name: "距離帯3キロの施設",
    lat: 35.704,
    lng: 139.761,
    area: OTHER_AREA_NAME,
    description: "四捨五入で3キロになる施設です",
    uri: "https://example.test/visual-distance-three",
    nodeCopyright: "千代田区",
    licence: "CC BY 4.0",
    licenceUri: "https://creativecommons.org/licenses/by/4.0/",
  },
];

const distanceVisualCategory: KeyLocationCategory = {
  category: "視覚契約カテゴリ",
  "category:en": "visual contract category",
  locations: distanceVisualLocations,
};

const DISTANCE_ORIGIN = "35.681000,139.761000";

function successfulLocationData(): KeyLocationsDataResult {
  return {
    status: "success",
    categories: [fixtureCategory],
  };
}

function getCategoryPage(): CategoryPage {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- load the route after Jest mocks initialize
  const pageModule = require("../page") as { default?: unknown };
  if (typeof pageModule.default !== "function") {
    throw new Error("category page visual-contract fixture could not load the page");
  }
  return pageModule.default as CategoryPage;
}

type LocationsLayout = (props: {
  children: React.ReactNode;
}) => React.ReactNode | Promise<React.ReactNode>;

function getLocationsLayout(): LocationsLayout {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- compose the public route boundary after Jest mocks initialize
  const layoutModule = require("../../layout") as { default?: unknown };
  if (typeof layoutModule.default !== "function") {
    throw new Error("locations layout visual-contract fixture could not load the layout");
  }
  return layoutModule.default as LocationsLayout;
}

function getCategoryLayout(): LocationsLayout {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- compose the public nested route boundary after Jest mocks initialize
  const layoutModule = require("../layout") as { default?: unknown };
  if (typeof layoutModule.default !== "function") {
    throw new Error(
      "category layout visual-contract fixture could not load the layout",
    );
  }
  return layoutModule.default as LocationsLayout;
}

function configureNavigationFixture(
  category: KeyLocationCategory,
  searchParams: Record<string, string | string[] | undefined>,
): void {
  mockUsePathname.mockReturnValue(
    `/locations/${encodeURIComponent(category["category:en"])}`,
  );

  const nextSearchParams = new URLSearchParams();
  if (typeof searchParams.origin === "string") {
    nextSearchParams.set("origin", searchParams.origin);
  }
  mockUseSearchParams.mockReturnValue(nextSearchParams);
}

async function renderCategoryPage(): Promise<void> {
  const page = getCategoryPage();
  render(
    <main>
      {await page({
        params: Promise.resolve({
          "category-id": encodeURIComponent(fixtureCategory["category:en"]),
        }),
        searchParams: Promise.resolve({}),
      })}
    </main>,
  );
}

async function renderCategoryPageWith(
  category: KeyLocationCategory,
  searchParams: Record<string, string | string[] | undefined> = {},
): Promise<void> {
  mockLoadLocationPageData.mockResolvedValueOnce({
    status: "success",
    categories: [category],
  });

  const page = getCategoryPage();
  render(
    <main>
      {await page({
        params: Promise.resolve({
          "category-id": encodeURIComponent(category["category:en"]),
        }),
        searchParams: Promise.resolve(searchParams),
      })}
    </main>,
  );
}

async function renderCategoryRouteWith(
  category: KeyLocationCategory,
  searchParams: Record<string, string | string[] | undefined> = {},
): Promise<void> {
  mockLoadLocationPageData.mockResolvedValue({
    status: "success",
    categories: [category],
  });
  configureNavigationFixture(category, searchParams);

  const page = getCategoryPage();
  const pageElement = await page({
    params: Promise.resolve({
      "category-id": encodeURIComponent(category["category:en"]),
    }),
    searchParams: Promise.resolve(searchParams),
  });
  const categoryLayout = getCategoryLayout();
  const categoryComposed = await categoryLayout({ children: pageElement });
  const locationsLayout = getLocationsLayout();
  const composed = await locationsLayout({ children: categoryComposed });
  render(<main>{composed}</main>);
}

function getCardRegions(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("section.card"));
}

function expectCardStructure(card: HTMLElement, title: string): HTMLElement {
  expect(card.tagName).toBe("SECTION");
  expect(card).toHaveClass("card");

  const cardBody = card.querySelector<HTMLElement>(":scope > .card-body");
  expect(cardBody).not.toBeNull();
  if (!cardBody) {
    throw new Error(`Card ${title} has no public card-body region`);
  }
  const cardTitle = cardBody.querySelector<HTMLElement>(":scope > .card-title");
  expect(cardTitle).not.toBeNull();
  if (!cardTitle) {
    throw new Error(`Card ${title} has no public card-title region`);
  }
  expect(cardTitle.tagName).toBe("H2");
  expect(cardTitle).toHaveClass("card-title");
  expect(cardTitle).toHaveAccessibleName(title);
  expect(
    within(cardBody).getByRole("heading", { level: 2, name: title }),
  ).toBe(cardTitle);
  expect(cardTitle.closest(".card-body")).toBe(cardBody);

  return cardBody;
}

function getLocationDetailLinks(): HTMLAnchorElement[] {
  return Array.from(
    document.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/locations/location-detail/"]',
    ),
  );
}

beforeEach(() => {
  mockNotFound.mockClear();
  mockUsePathname.mockReset();
  mockUsePathname.mockReturnValue(
    `/locations/${encodeURIComponent(fixtureCategory["category:en"])}`,
  );
  mockUseSearchParams.mockReset();
  mockUseSearchParams.mockReturnValue(new URLSearchParams());
  mockUseRouter.mockReset();
  mockUseRouter.mockReturnValue({ replace: jest.fn() });
  mockLoadLocationPageData.mockReset();
  mockLoadLocationPageData.mockResolvedValue(successfulLocationData());
});

describe("category page origin/dev visual contract", () => {
  it("exposes the PageHeader as the only H1 with the exact page description", async () => {
    await renderCategoryPage();

    const levelOneHeadings = screen.getAllByRole("heading", { level: 1 });
    expect(levelOneHeadings).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: PAGE_TITLE }),
    ).toBeInTheDocument();

    const description = screen.getByText(PAGE_DESCRIPTION, { exact: true });
    expect(levelOneHeadings[0].closest("header")).toContainElement(description);
  });

  it("renders the required Card structure and public route composition in order", async () => {
    await renderCategoryRouteWith(fixtureCategory);

    const cardRegions = getCardRegions();
    expect(cardRegions).toHaveLength(CARD_TITLES.length);
    expect(
      cardRegions.map((card) =>
        within(card).getByRole("heading", { level: 2 }).textContent?.trim(),
      ),
    ).toEqual(CARD_TITLES);

    const [categoryCard, nearbyCard, providerCard] = cardRegions;
    if (!categoryCard || !nearbyCard || !providerCard) {
      throw new Error("visual-contract fixture did not render all required Cards");
    }
    expectCardStructure(categoryCard, CARD_TITLES[0]);
    expectCardStructure(nearbyCard, CARD_TITLES[1]);
    expectCardStructure(providerCard, CARD_TITLES[2]);

    const categoryNavigations = screen.getAllByRole("navigation", {
      name: "場所カテゴリ",
    });
    expect(categoryNavigations).toHaveLength(1);
    expect(
      within(categoryCard).getByRole("navigation", { name: "場所カテゴリ" }),
    ).toBe(categoryNavigations[0]);

    const nearbyLinks = within(nearbyCard).getAllByRole("link");
    const nearbyButtons = within(nearbyCard).getAllByRole("button");
    expect(nearbyLinks).toHaveLength(1);
    expect(nearbyLinks[0]).toHaveAccessibleName("町字で並べる");
    expect(nearbyButtons).toHaveLength(1);
    expect(nearbyButtons[0]).toHaveAccessibleName("近い順に並べる");

    const pageHeading = screen.getByRole("heading", {
      level: 1,
      name: PAGE_TITLE,
    });
    expect(
      pageHeading.compareDocumentPosition(categoryCard) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      categoryCard.compareDocumentPosition(nearbyCard) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      nearbyCard.compareDocumentPosition(providerCard) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const locationLinks = getLocationDetailLinks();
    expect(locationLinks).toHaveLength(fixtureCategory.locations.length);
    const firstLocationLink = locationLinks[0];
    expect(firstLocationLink).toBeDefined();
    if (firstLocationLink) {
      expect(
        nearbyCard.compareDocumentPosition(firstLocationLink) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    const lastLocationLink = locationLinks[locationLinks.length - 1];
    expect(lastLocationLink).toBeDefined();
    if (lastLocationLink) {
      expect(
        lastLocationLink.compareDocumentPosition(providerCard) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("does not render the auxiliary origin/dev carousel", async () => {
    await renderCategoryPage();

    expect(document.querySelector(".carousel")).toBeNull();
    for (const title of AUXILIARY_CAROUSEL_TITLES) {
      expect(
        screen.queryByRole("heading", { name: title }),
      ).not.toBeInTheDocument();
    }
  });

  it("renders location cards in responsive grids with contained object-cover images", async () => {
    await renderCategoryPageWith(townVisualCategory);

    const areaHeading = screen.getByRole("heading", {
      level: 2,
      name: LONG_AREA_NAME,
    });
    const areaSection = areaHeading.closest("section");
    expect(areaSection).not.toBeNull();

    const grid = areaSection?.querySelector<HTMLElement>(".grid");
    expect(grid).not.toBeNull();
    expect(grid).toHaveClass(
      "grid-cols-1",
      "md:grid-cols-2",
      "lg:grid-cols-3",
      "gap-4",
    );

    const card = screen.getByRole("link", {
      name: new RegExp(LONG_LOCATION_NAME),
    });
    expect(card).toHaveClass("card", "w-full", "hover:shadow-lg");
    expect(card.className).toMatch(/focus-visible:/);

    const image = within(card).getByRole("img", {
      name: LONG_LOCATION_NAME,
    });
    expect(image).toHaveClass("object-cover", "h-48", "w-full");
    expect(image.closest("figure")).toHaveClass("relative");
  });

  it("keeps long location names, area labels, and body copy untruncated at readable text size", async () => {
    await renderCategoryPageWith(townVisualCategory);

    const card = screen.getByRole("link", {
      name: new RegExp(LONG_LOCATION_NAME),
    });
    const locationHeading = within(card).getByRole("heading", {
      name: LONG_LOCATION_NAME,
    });
    expect(locationHeading).toHaveTextContent(LONG_LOCATION_NAME);
    expect(locationHeading.className).not.toMatch(
      /truncate|line-clamp|text-ellipsis|whitespace-nowrap/,
    );

    const areaLabel = within(card).getByText(LONG_AREA_NAME, { exact: true });
    const description = within(card).getByText(
      "長い場所名と地域名が切断されないかを確認する説明文です",
      { exact: true },
    );
    expect(areaLabel).toHaveClass("text-base");
    expect(description).toHaveClass("text-base");
    expect(areaLabel.className).not.toMatch(
      /truncate|line-clamp|text-ellipsis|whitespace-nowrap/,
    );
    expect(description.className).not.toMatch(
      /truncate|line-clamp|text-ellipsis|whitespace-nowrap/,
    );
    expect(
      within(card).queryByText(LONG_AREA_SOURCE_NAME, { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: LONG_AREA_SOURCE_NAME,
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps town-mode locations in separate area sections", async () => {
    await renderCategoryPageWith(townVisualCategory);

    for (const [areaName, locationName] of [
      [LONG_AREA_NAME, LONG_LOCATION_NAME],
      ["神田", "神田の視覚契約施設"],
      ["九段南", "九段南の視覚契約施設"],
      [OTHER_AREA_NAME, "その他の視覚契約施設"],
    ] as const) {
      const areaHeading = screen.getByRole("heading", {
        level: 2,
        name: areaName,
      });
      const areaSection = areaHeading.closest("section");
      expect(areaSection).not.toBeNull();
      const locationLink = within(areaSection as HTMLElement).getByRole("link", {
        name: new RegExp(locationName),
      });
      expect(locationLink).toBeInTheDocument();
      expect(
        within(locationLink).getByText(areaName, { exact: true }),
      ).toBeInTheDocument();
    }

    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: LONG_AREA_SOURCE_NAME,
      }),
    ).not.toBeInTheDocument();
  });

  it("renders complete ascending distance-band sections with stable same-distance order", async () => {
    await renderCategoryPageWith(distanceVisualCategory, {
      origin: DISTANCE_ORIGIN,
    });

    const expectedDistanceBands = [
      {
        heading: "0キロ離れています",
        locations: ["距離帯0キロの施設"],
        areas: [LONG_AREA_NAME],
      },
      {
        heading: "1キロ離れています",
        locations: [
          "距離帯1キロの施設",
          "距離帯1キロ同距離先の施設",
          "距離帯1キロ同距離後の施設",
        ],
        areas: ["神田", "神田", "神田"],
      },
      {
        heading: "3キロ離れています",
        locations: ["距離帯3キロの施設"],
        areas: [OTHER_AREA_NAME],
      },
    ] as const;
    const distanceHeadings = screen
      .getAllByRole("heading", { level: 2 })
      .filter((heading) =>
        /^\d+キロ離れています$/.test(heading.textContent?.trim() ?? ""),
      );

    expect(distanceHeadings.map((heading) => heading.textContent?.trim())).toEqual(
      expectedDistanceBands.map(({ heading }) => heading),
    );
    expect(
      screen.queryByRole("heading", { level: 2, name: "距離の近い順" }),
    ).not.toBeInTheDocument();
    for (const areaName of ["神田", "九段南", OTHER_AREA_NAME]) {
      expect(
        screen.queryByRole("heading", { level: 2, name: areaName }),
      ).not.toBeInTheDocument();
    }

    const bandSections = distanceHeadings
      .map((heading) => heading.closest("section"))
      .filter((section): section is HTMLElement => section !== null);
    expect(bandSections).toHaveLength(expectedDistanceBands.length);
    expect(new Set(bandSections).size).toBe(expectedDistanceBands.length);

    const allLocationLinks = getLocationDetailLinks();
    const expectedLocationOrder = expectedDistanceBands.flatMap(
      ({ locations }) => locations,
    );
    expect(allLocationLinks).toHaveLength(distanceVisualLocations.length);
    expect(
      allLocationLinks.map((link) => link.textContent),
    ).toEqual(expectedLocationOrder.map((name) => expect.stringContaining(name)));
    expect(allLocationLinks.map((link) => link.getAttribute("href"))).toEqual(
      distanceVisualLocations.map(
        (location) =>
          `/locations/location-detail/${encodeURIComponent(location.id)}`,
      ),
    );

    expectedDistanceBands.forEach(({ locations, areas }, index) => {
      const distanceSection = bandSections[index];
      if (!distanceSection) {
        throw new Error("distance-band section is missing from the public DOM");
      }

      const links = Array.from(
        distanceSection.querySelectorAll<HTMLAnchorElement>(
          'a[href^="/locations/location-detail/"]',
        ),
      );
      expect(links).toHaveLength(locations.length);
      expect(links.map((link) => link.textContent)).toEqual(
        locations.map((name) => expect.stringContaining(name)),
      );
      expect(
        links.map((link, linkIndex) =>
          within(link).getByText(areas[linkIndex] ?? "", { exact: true })
            .textContent,
        ),
      ).toEqual(areas);
      expect(distanceSection.querySelector(".grid")).toHaveClass(
        "grid-cols-1",
        "md:grid-cols-2",
        "lg:grid-cols-3",
        "gap-4",
      );
    });
    expect(
      screen.queryByText(LONG_AREA_SOURCE_NAME, { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("keeps the data-provider Card description and every origin/dev link", async () => {
    await renderCategoryPage();

    const providerHeading = screen.getByRole("heading", {
      level: 2,
      name: "データ提供元",
    });
    const providerCard = providerHeading.closest("section");
    expect(providerCard).not.toBeNull();
    if (!providerCard) {
      throw new Error("data-provider Card was not rendered");
    }
    expectCardStructure(providerCard, "データ提供元");

    const sourceDescription = within(providerCard).getByText(/この場所データは/);
    expect(sourceDescription.tagName).toBe("P");
    expect(sourceDescription).toHaveTextContent(DATA_PROVIDER_SOURCE_DESCRIPTION);
    const providerLinks = within(providerCard).getAllByRole("link");
    expect(providerLinks).toHaveLength(2);
    expect(providerLinks.map((link) => link.getAttribute("href"))).toEqual([
      DATA_PROVIDER_SOURCE_HREF,
      DATA_PROVIDER_FORM_HREF,
    ]);
    expect(
      within(providerCard).getByRole("link", {
        name: "千代田区主要施設座標データ",
      }),
    ).toHaveAttribute("href", DATA_PROVIDER_SOURCE_HREF);

    const correctionDescription = within(providerCard).getByText(
      /誤りが含まれていたり、古いデータが残っていたり/,
    );
    expect(correctionDescription.tagName).toBe("P");
    expect(correctionDescription).toHaveTextContent(
      DATA_PROVIDER_CORRECTION_DESCRIPTION,
    );
    expect(
      within(providerCard).getByRole("link", { name: "こちらのフォーム" }),
    ).toHaveAttribute("href", DATA_PROVIDER_FORM_HREF);

    expect(
      within(providerCard).getByText("写真のご提供も歓迎しています。", {
        exact: true,
      }),
    ).toBeInTheDocument();
  });
});
