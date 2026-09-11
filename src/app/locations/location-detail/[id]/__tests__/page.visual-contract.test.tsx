import React, { isValidElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { LocationDetailResult } from "@/types/access-route-pages";
import type {
  KeyLocation,
  KeyLocationCategory,
  KeyLocationsDataResult,
} from "@/utils/addressLoader";

const mockNotFound = jest.fn(() => {
  throw new Error("unexpected detail notFound() in visual-contract fixture");
});
const mockLoadLocationPageData = jest.fn<
  Promise<KeyLocationsDataResult>,
  []
>();
const mockResolveLocationDetail = jest.fn<
  LocationDetailResult<KeyLocation>,
  [string, KeyLocationsDataResult]
>();

jest.mock("next/navigation", () => ({
  notFound: mockNotFound,
  usePathname: () => `/locations/location-detail/${detailLocation.id}`,
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/lib/location/location-page-data", () => ({
  loadLocationPageData: mockLoadLocationPageData,
}));

jest.mock("@/lib/location/location-detail-resolver", () => ({
  resolveLocationDetail: mockResolveLocationDetail,
}));

type LocationDetailPage = (props: {
  params: Promise<{ id: string }>;
}) => ReactNode | Promise<ReactNode>;

const detailCategory: KeyLocationCategory = {
  category: "公共施設",
  "category:en": "public facilities",
  locations: [],
};

const detailLocation: KeyLocation = {
  id: "visual-detail-location",
  name: "視覚契約の詳細施設",
  lat: 35.694,
  lng: 139.768,
  area: "神田",
  description: "詳細ページのカテゴリナビゲーション省略を確認する施設です",
  uri: "https://example.test/visual-detail-location",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const DERIVED_AREA_WITH_PREFIX = "東京都千代田区神田和泉町";
const NORMALIZED_DERIVED_AREA = "神田和泉町";
const PREFIX_FREE_AREA = "千代田区神田和泉町";
const FULL_LOCATION_ADDRESS = "東京都千代田区神田和泉町1-2-3";

// Region fixtures enter through the public page-data boundary; this suite
// intentionally does not mock or invoke source acquisition.
const derivedAreaLocation: KeyLocation = {
  id: "visual-derived-area-location",
  name: FULL_LOCATION_ADDRESS,
  lat: 35.694,
  lng: 139.768,
  area: DERIVED_AREA_WITH_PREFIX,
  description: "地域表示だけを整形し住所全文を保持する施設です",
  uri: "https://example.test/visual-derived-area-location",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const prefixFreeAreaLocation: KeyLocation = {
  ...derivedAreaLocation,
  id: "visual-prefix-free-area-location",
  name: "接頭辞なし地域の視覚契約施設",
  area: PREFIX_FREE_AREA,
};

const unknownAreaLocation: KeyLocation = {
  ...derivedAreaLocation,
  id: "visual-unknown-area-location",
  name: "地域不明時の視覚契約施設",
  lat: 35.8,
  lng: 139.9,
  area: null,
};

function successfulDataFor(location: KeyLocation): KeyLocationsDataResult {
  return {
    status: "success",
    categories: [
      {
        ...detailCategory,
        locations: [location],
      },
    ],
  };
}

function successfulData(): KeyLocationsDataResult {
  return successfulDataFor(detailLocation);
}

function getDetailPage(): LocationDetailPage {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- load the route after Jest mocks initialize
  const pageModule = require("../page") as { default?: unknown };
  if (typeof pageModule.default !== "function") {
    throw new Error("detail page visual-contract fixture could not load the page");
  }
  return pageModule.default as LocationDetailPage;
}

async function renderDetailRoute(): Promise<HTMLElement> {
  const page = getDetailPage();
  const element = await page({
    params: Promise.resolve({ id: detailLocation.id }),
  });
  if (!isValidElement(element)) {
    throw new Error("detail page visual-contract fixture did not render an element");
  }

  // The common locations layout is the public boundary that must not expose
  // category navigation on the nested detail route.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- load the route layout after Jest mocks initialize
  const layoutModule = require("../../../layout") as { default?: unknown };
  if (typeof layoutModule.default !== "function") {
    throw new Error("locations layout visual-contract fixture could not load the layout");
  }

  const layout = layoutModule.default as (props: {
    children: ReactNode;
  }) => ReactNode | Promise<ReactNode>;
  const composed = await layout({ children: element });
  const { container } = render(<main>{composed}</main>);
  return container;
}

async function renderDetailPageFor(location: KeyLocation): Promise<HTMLElement> {
  const data = successfulDataFor(location);
  mockLoadLocationPageData.mockResolvedValueOnce(data);
  mockResolveLocationDetail.mockReturnValueOnce({
    status: "success",
    location,
  });

  const page = getDetailPage();
  const element = await page({
    params: Promise.resolve({ id: location.id }),
  });
  if (!isValidElement(element)) {
    throw new Error("detail page visual-contract fixture did not render an element");
  }

  const { container } = render(<main>{element}</main>);
  return container;
}

function getRegionDefinition(): HTMLElement {
  const regionTerm = screen.getByText("地域", { selector: "dt" });
  const regionDefinition = regionTerm.nextElementSibling;
  if (!(regionDefinition instanceof HTMLElement) || regionDefinition.tagName !== "DD") {
    throw new Error("expected the region term to be followed by a definition");
  }

  return regionDefinition;
}

beforeEach(() => {
  mockNotFound.mockClear();
  mockLoadLocationPageData.mockReset();
  mockResolveLocationDetail.mockReset();

  const data = successfulData();
  mockLoadLocationPageData.mockResolvedValue(data);
  mockResolveLocationDetail.mockReturnValue({
    status: "success",
    location: detailLocation,
  });
});

describe("location detail visual contract", () => {
  it("omits the shared category navigation while keeping the category return link", async () => {
    const container = await renderDetailRoute();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: detailLocation.name,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "公共施設に戻る" }),
    ).toHaveAttribute(
      "href",
      `/locations/${encodeURIComponent(detailCategory["category:en"])}`,
    );

    expect(
      screen.queryByRole("navigation", { name: "場所カテゴリ" }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('nav[aria-label="場所カテゴリ"]')).toBeNull();
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector('[role="tab"]')).toBeNull();
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});

describe("location detail region display visual contract", () => {
  it("normalizes only the coordinate-derived prefix while preserving the full address", async () => {
    await renderDetailPageFor(derivedAreaLocation);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: FULL_LOCATION_ADDRESS,
      }),
    ).toBeInTheDocument();
    expect(getRegionDefinition().textContent).toBe(NORMALIZED_DERIVED_AREA);
    expect(
      screen.queryByText(DERIVED_AREA_WITH_PREFIX, { exact: true }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ここへ行く" })).toHaveAttribute(
      "href",
      `/?destination=${encodeURIComponent(
        JSON.stringify({
          lat: derivedAreaLocation.lat,
          lng: derivedAreaLocation.lng,
          address: FULL_LOCATION_ADDRESS,
        }),
      )}`,
    );
  });

  it("preserves a coordinate-derived region that has no configured prefix", async () => {
    await renderDetailPageFor(prefixFreeAreaLocation);

    expect(getRegionDefinition().textContent).toBe(PREFIX_FREE_AREA);
    expect(
      screen.queryByText(DERIVED_AREA_WITH_PREFIX, { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("keeps the existing omitted-region behavior when coordinates do not resolve", async () => {
    await renderDetailPageFor(unknownAreaLocation);

    expect(screen.queryByText("地域", { selector: "dt" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: unknownAreaLocation.name,
      }),
    ).toBeInTheDocument();
  });
});
