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

const mockNotFound = jest.fn(() => {
  throw new Error("unexpected notFound() in town-order contract fixture");
});
const mockLoadLocationPageData = jest.fn<
  Promise<KeyLocationsDataResult>,
  []
>();

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

const CATEGORY_ID = "town-order contract category";
const DERIVED_AREA_PREFIX = "東京都千代田区";

function makeLocation(
  id: string,
  name: string,
  town: string,
): KeyLocation {
  return {
    id,
    name,
    lat: 35.68,
    lng: 139.76,
    area: `${DERIVED_AREA_PREFIX}${town}`,
    description: `${town}の公開契約fixtureです`,
    uri: `https://example.test/${id}`,
    nodeCopyright: "千代田区",
    licence: "CC BY 4.0",
    licenceUri: "https://creativecommons.org/licenses/by/4.0/",
  };
}

// Deliberately interleave towns so Map insertion order differs from localeCompare order.
const townLocations: KeyLocation[] = [
  makeLocation("akasaka-first", "赤坂の入力先頭の場所", "赤坂"),
  makeLocation("kanda-first", "神田の入力先頭の場所", "神田"),
  makeLocation("kudan-first", "九段南の入力先頭の場所", "九段南"),
  makeLocation("kanda-second", "神田の入力後続の場所", "神田"),
  makeLocation("kudan-second", "九段南の入力後続の場所", "九段南"),
  makeLocation("akasaka-second", "赤坂の入力後続の場所", "赤坂"),
];

const townCategory: KeyLocationCategory = {
  category: "町字順契約カテゴリ",
  "category:en": CATEGORY_ID,
  locations: townLocations,
};

function getCategoryPage(): CategoryPage {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- load the public route after Jest mocks initialize
  const pageModule = require("../page") as { default?: unknown };
  if (typeof pageModule.default !== "function") {
    throw new Error("category page town-order fixture could not load the page");
  }
  return pageModule.default as CategoryPage;
}

async function renderTownCategoryPage(): Promise<void> {
  const page = getCategoryPage();
  const pageElement = await page({
    params: Promise.resolve({ "category-id": encodeURIComponent(CATEGORY_ID) }),
    searchParams: Promise.resolve({}),
  });
  render(<main>{pageElement}</main>);
}

function getTownSection(town: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 2, name: town });
  const section = heading.closest("section");
  expect(section).not.toBeNull();
  if (!section) {
    throw new Error(`town section for ${town} is missing from the public DOM`);
  }
  return section;
}

beforeEach(() => {
  mockNotFound.mockClear();
  mockLoadLocationPageData.mockReset();
  mockLoadLocationPageData.mockResolvedValue({
    status: "success",
    categories: [townCategory],
  });
});

describe("category page town-order public contract", () => {
  it("orders town section headings by the display town localeCompare result", async () => {
    await renderTownCategoryPage();

    const expectedTownNames = ["九段南", "神田", "赤坂"].toSorted((first, second) =>
      first.localeCompare(second),
    );
    const townHeadings = screen
      .getAllByRole("heading", { level: 2 })
      .filter((heading) =>
        expectedTownNames.includes(heading.textContent?.trim() ?? ""),
      );

    expect(townHeadings.map((heading) => heading.textContent?.trim())).toEqual(
      expectedTownNames,
    );
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("keeps location links in input order within each town section", async () => {
    await renderTownCategoryPage();

    const expectedTownNames = ["九段南", "神田", "赤坂"].toSorted((first, second) =>
      first.localeCompare(second),
    );

    for (const town of expectedTownNames) {
      const expectedLocations = townLocations.filter(
        (location) => location.area === `${DERIVED_AREA_PREFIX}${town}`,
      );
      const links = within(getTownSection(town)).getAllByRole("link");

      expect(links.map((link) => link.getAttribute("href"))).toEqual(
        expectedLocations.map(
          (location) =>
            `/locations/location-detail/${encodeURIComponent(location.id)}`,
        ),
      );
      expect(links.map((link) => link.textContent)).toEqual(
        expectedLocations.map((location) =>
          expect.stringContaining(location.name),
        ),
      );
    }
  });
});
