import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type {
  LocationWithArea,
  LocationCategoryWithArea,
  LocationPageDataResult,
} from "@/lib/location/location-page-data";

type CategoryPageProps = {
  params: Promise<{ "category-id": string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type CategoryPage = (
  props: CategoryPageProps,
) => React.ReactNode | Promise<React.ReactNode>;

const CATEGORY_ID = "1302";
const CATEGORY_PATH = `/locations/${encodeURIComponent(CATEGORY_ID)}`;
const MALFORMED_ORIGIN = "not-a-coordinate";
const INVALID_ORIGIN_DESCRIPTION =
  "originの座標を解釈できません。町字で表示します。";

const mockNotFound = jest.fn(() => {
  throw new Error("unexpected category notFound() in error-layout fixture");
});
const mockUsePathname = jest.fn(() => CATEGORY_PATH);
const mockUseSearchParams = jest.fn(() => new URLSearchParams());
const mockRouterReplace = jest.fn<void, [string]>();
const mockUseRouter = jest.fn(() => ({ replace: mockRouterReplace }));
const mockLoadLocationPageData = jest.fn<
  Promise<LocationPageDataResult>,
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

const fixtureLocation: LocationWithArea = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000031",
  name: "エラー表示後も確認できる場所",
  lat: 35.681,
  lng: 139.761,
  area: "東京都千代田区神田",
  relatedPages: [],
  osmElement: { type: "node", id: 31 },
  wheelchair: "yes",
  osmEditUrl: "https://www.openstreetmap.org/edit?node=31",
};

const fixtureCategory: LocationCategoryWithArea = {
  category: "エラーレイアウト契約カテゴリ",
  categoryId: CATEGORY_ID,
  locations: [fixtureLocation],
};

function getCategoryPage(): CategoryPage {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- load the real public page after Jest mocks initialize
  const pageModule = require("../page") as { default?: unknown };
  if (typeof pageModule.default !== "function") {
    throw new Error("category page error-layout fixture could not load the page");
  }
  return pageModule.default as CategoryPage;
}

async function renderInvalidOriginCategoryPage(): Promise<void> {
  const expectedSearch = `?origin=${encodeURIComponent(MALFORMED_ORIGIN)}`;
  window.history.replaceState({}, "", `${CATEGORY_PATH}${expectedSearch}`);
  mockUsePathname.mockReturnValue(CATEGORY_PATH);
  mockUseSearchParams.mockReturnValue(
    new URLSearchParams({ origin: MALFORMED_ORIGIN }),
  );
  mockLoadLocationPageData.mockResolvedValueOnce({
    status: "success",
    categories: [fixtureCategory],
  });

  const page = getCategoryPage();
  const pageElement = await page({
    params: Promise.resolve({ "category-id": encodeURIComponent(CATEGORY_ID) }),
    searchParams: Promise.resolve({ origin: MALFORMED_ORIGIN }),
  });
  render(<main>{pageElement}</main>);
}

beforeEach(() => {
  mockNotFound.mockClear();
  mockUsePathname.mockReset();
  mockUsePathname.mockReturnValue(CATEGORY_PATH);
  mockUseSearchParams.mockReset();
  mockUseSearchParams.mockReturnValue(new URLSearchParams());
  mockUseRouter.mockReset();
  mockUseRouter.mockReturnValue({ replace: mockRouterReplace });
  mockRouterReplace.mockReset();
  mockLoadLocationPageData.mockReset();
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("category page invalid-origin alert layout public contract", () => {
  it("renders exactly one page-level alert while retaining the invalid origin and town fallback", async () => {
    await renderInvalidOriginCategoryPage();

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    const [pageAlert] = alerts;
    if (!pageAlert) {
      throw new Error("category page did not render its invalid-origin alert");
    }

    expect(pageAlert).toHaveAttribute("role", "alert");
    expect(pageAlert.closest("section.card")).toBeNull();
    expect(pageAlert).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
    expect(
      within(pageAlert).getByText("エラー", { exact: true }),
    ).toBeVisible();
    expect(
      within(pageAlert).getByText(INVALID_ORIGIN_DESCRIPTION, { exact: true }),
    ).toBeVisible();

    expect(
      screen.getByRole("status", { name: "町字ごとに表示しています。" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: new RegExp(fixtureLocation.name) }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe(CATEGORY_PATH);
    expect(window.location.search).toBe(
      `?origin=${encodeURIComponent(MALFORMED_ORIGIN)}`,
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
