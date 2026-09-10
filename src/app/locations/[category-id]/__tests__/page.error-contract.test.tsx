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

const CATEGORY_ID = "error-contract category";
const CATEGORY_PATH = `/locations/${encodeURIComponent(CATEGORY_ID)}`;
const MALFORMED_ORIGIN = "not-a-coordinate";
const DATA_ERROR_DESCRIPTION =
  "場所データを読み込めないため、一覧を表示できません。";
const INVALID_ORIGIN_DESCRIPTION =
  "originの座標を解釈できません。町字で表示します。";

const mockNotFound = jest.fn(() => {
  throw new Error("unexpected category notFound() in error-contract fixture");
});
const mockUsePathname = jest.fn(() => CATEGORY_PATH);
const mockUseSearchParams = jest.fn(() => new URLSearchParams());
const mockRouterReplace = jest.fn<void, [string]>();
const mockUseRouter = jest.fn(() => ({ replace: mockRouterReplace }));
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
  id: "error-contract-location",
  name: "エラー契約テストの場所",
  lat: 35.681,
  lng: 139.761,
  area: "東京都千代田区神田",
  description: "エラー表示後も確認できる場所です",
  uri: "https://example.test/error-contract-location",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const fixtureCategory: KeyLocationCategory = {
  category: "エラー契約カテゴリ",
  "category:en": CATEGORY_ID,
  locations: [fixtureLocation],
};

function getCategoryPage(): CategoryPage {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- load the real public page after Jest mocks initialize
  const pageModule = require("../page") as { default?: unknown };
  if (typeof pageModule.default !== "function") {
    throw new Error("category page error-contract fixture could not load the page");
  }
  return pageModule.default as CategoryPage;
}

async function renderCategoryPage(
  result: KeyLocationsDataResult,
  searchParams: Record<string, string | string[] | undefined> = {},
): Promise<void> {
  mockLoadLocationPageData.mockResolvedValueOnce(result);

  const page = getCategoryPage();
  const pageElement = await page({
    params: Promise.resolve({ "category-id": encodeURIComponent(CATEGORY_ID) }),
    searchParams: Promise.resolve(searchParams),
  });
  render(<main>{pageElement}</main>);
}

function expectPageLevelErrorAlert(description: string): HTMLElement {
  const pageAlert = screen
    .getAllByRole("alert")
    .find((alert) => alert.closest("section.card") === null);
  expect(pageAlert).toBeDefined();
  if (!pageAlert) {
    throw new Error("category page did not render a page-level alert");
  }

  expect(pageAlert).toHaveAttribute("role", "alert");
  expect(
    within(pageAlert).getByText("エラー", { exact: true }),
  ).toBeVisible();
  expect(pageAlert).toHaveClass(
    "alert",
    "alert-error",
    "alert-soft",
    "text-base-content!",
  );
  expect(within(pageAlert).getByText(description, { exact: true })).toBeVisible();

  return pageAlert;
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

describe("category page error public contract", () => {
  it("renders a semantic alert with a visible title for location-data failures", async () => {
    await renderCategoryPage({
      status: "error",
      error: new Error("generated location artifact is unavailable"),
    });

    expectPageLevelErrorAlert(DATA_ERROR_DESCRIPTION);
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("renders the same titled alert for malformed origin while retaining town fallback and the browser query", async () => {
    const expectedSearch = `?origin=${encodeURIComponent(MALFORMED_ORIGIN)}`;
    window.history.replaceState({}, "", `${CATEGORY_PATH}${expectedSearch}`);
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams({ origin: MALFORMED_ORIGIN }),
    );

    await renderCategoryPage(
      { status: "success", categories: [fixtureCategory] },
      { origin: MALFORMED_ORIGIN },
    );

    expectPageLevelErrorAlert(INVALID_ORIGIN_DESCRIPTION);
    expect(
      screen.getByRole("status", { name: "町字ごとに表示しています。" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: "神田" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: new RegExp(fixtureLocation.name) }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe(CATEGORY_PATH);
    expect(window.location.search).toBe(expectedSearch);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
