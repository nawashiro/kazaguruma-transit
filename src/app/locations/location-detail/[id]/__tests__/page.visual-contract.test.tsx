import React, { isValidElement, type ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { LocationDetailResult } from "@/types/access-route-pages";
import type {
  LocationWithArea,
  LocationCategoryWithArea,
  LocationPageDataResult,
} from "@/lib/location/location-page-data";

const mockNotFound = jest.fn(() => {
  throw new Error("unexpected detail notFound() in visual-contract fixture");
});
const mockLoadLocationPageData = jest.fn<
  Promise<LocationPageDataResult>,
  []
>();
const mockResolveLocationDetail = jest.fn<
  LocationDetailResult<LocationWithArea>,
  [string, LocationPageDataResult]
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

const detailCategory: LocationCategoryWithArea = {
  category: "公共施設",
  categoryId: "1302",
  locations: [],
};

const detailLocation: LocationWithArea = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000041",
  name: "視覚契約の詳細施設",
  lat: 35.694,
  lng: 139.768,
  area: "神田",
  relatedPages: [],
  osmElement: { type: "node", id: 41 },
  wheelchair: "yes",
  osmEditUrl: "https://www.openstreetmap.org/edit?node=41",
};

const DERIVED_AREA_WITH_PREFIX = "東京都千代田区神田和泉町";
const NORMALIZED_DERIVED_AREA = "神田和泉町";
const PREFIX_FREE_AREA = "千代田区神田和泉町";
const FULL_LOCATION_ADDRESS = "東京都千代田区神田和泉町1-2-3";

// Region fixtures enter through the public page-data boundary; this suite
// intentionally does not mock or invoke source acquisition.
const derivedAreaLocation: LocationWithArea = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000042",
  name: FULL_LOCATION_ADDRESS,
  lat: 35.694,
  lng: 139.768,
  area: DERIVED_AREA_WITH_PREFIX,
  relatedPages: [],
  osmElement: { type: "node", id: 42 },
  wheelchair: "yes",
  osmEditUrl: "https://www.openstreetmap.org/edit?node=42",
};

const prefixFreeAreaLocation: LocationWithArea = {
  ...derivedAreaLocation,
  id: "urn:uuid:00000000-0000-4000-8000-000000000043",
  name: "接頭辞なし地域の視覚契約施設",
  area: PREFIX_FREE_AREA,
};

const unknownAreaLocation = {
  ...derivedAreaLocation,
  id: "urn:uuid:00000000-0000-4000-8000-000000000044",
  name: "地域不明時の視覚契約施設",
  lat: 35.8,
  lng: 139.9,
  area: null,
} as unknown as LocationWithArea;

function successfulDataFor(location: LocationWithArea): LocationPageDataResult {
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

function successfulData(): LocationPageDataResult {
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

async function renderDetailPageFor(location: LocationWithArea): Promise<HTMLElement> {
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
    const breadcrumbNav = screen.getByRole("navigation", { name: "パンくずリスト" });
    expect(
      Array.from(breadcrumbNav.querySelectorAll("a")).find(
        (candidate) => (candidate.textContent ?? "").includes(detailCategory.category),
      ),
    ).toHaveAttribute(
      "href",
      `/locations/${encodeURIComponent(detailCategory.categoryId)}`,
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

describe("location detail facts visual contract", () => {
  const factsVisualLocation = {
    ...detailLocation,
    id: "urn:uuid:00000000-0000-4000-8000-000000000071",
    phone: { display: "03-3264-2111", tel: "tel:0332642111" },
    websiteUri: "https://www.city.chiyoda.lg.jp/",
    wikipediaUri: "https://ja.wikipedia.org/wiki/%E5%8D%83%E4%BB%A3%E7%94%B0",
    osmEditUrl: "https://www.openstreetmap.org/edit?node=71",
    osmElement: { type: "node", id: 71 } as const,
  };

  it("keeps facts links at 44px, 16px text, safe rel and visible focus", async () => {
    await renderDetailPageFor(factsVisualLocation as any);

    const editLink = screen.getByRole("link", { name: /編集する.*OpenStreetMap/ });
    expect(editLink).toHaveClass("min-h-[44px]");
    expect(editLink).toHaveClass("text-base");
    expect(editLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(editLink).toHaveAttribute("target", "_blank");
    expect(editLink.className).toMatch(/focus-visible:/);

    const basicHeading = screen.getByRole("heading", { level: 2, name: "基本情報" });
    expect(basicHeading).toHaveClass("text-xl");
    const telLink = screen.getByRole("link", { name: /03-3264-2111/ });
    expect(telLink).toHaveClass("min-h-[44px]");
    expect(telLink).toHaveClass("text-base");
    const websiteLink = screen.getByRole("link", { name: /ウェブサイトを開く/ });
    expect(websiteLink).toHaveClass("min-h-[44px]");
    expect(websiteLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(websiteLink.className).toMatch(/focus-visible:/);
  });

  it("centers each basic info row and keeps dt and dd at the same text size", async () => {
    await renderDetailPageFor(factsVisualLocation as any);

    const basicHeading = screen.getByRole("heading", { level: 2, name: "基本情報" });
    const list = basicHeading.parentElement?.querySelector("dl");
    if (!(list instanceof HTMLElement)) {
      throw new Error("expected the basic info heading to own a definition list");
    }
    const rows = Array.from(list.querySelectorAll<HTMLElement>(".list-row"));
    expect(rows).toHaveLength(3);

    for (const row of rows) {
      expect(row).toHaveClass("items-center");
      const term = row.querySelector("dt");
      const definition = row.querySelector("dd");
      expect(term).toHaveClass("text-base");
      expect(definition).toHaveClass("text-base");
    }
  });
});

describe("location detail provider visual contract", () => {
  const providerVisualLocation = {
    ...detailLocation,
    id: "urn:uuid:00000000-0000-4000-8000-000000000091",
    phone: { display: "03-3264-2111", tel: "tel:0332642111" },
    imageUri: "https://example.test/provider-location.jpg",
    imageCreator: "さくら",
    imageLicense: "https://creativecommons.org/licenses/by-sa/4.0/",
    osmEditUrl: "https://www.openstreetmap.org/edit?node=91",
    osmElement: { type: "node", id: 91 } as const,
  };

  it("shows a single OSM attribution and does not repeat the image row", async () => {
    await renderDetailPageFor(providerVisualLocation as any);

    const heading = screen.getByRole("heading", { level: 2, name: "提供" });
    const section = heading.closest("section");
    if (!(section instanceof HTMLElement)) {
      throw new Error("expected the provider heading inside a section");
    }

    const links = within(section).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    expect(links[0]).toHaveAccessibleName(
      /OpenStreetMap contributors.*新しいタブで開きます/,
    );
    expect(section).toHaveTextContent("施設情報とバリアフリー情報（wheelchairタグ）");
    expect(section).toHaveTextContent("ODbL 1.0");
    expect(section).not.toHaveTextContent("座標・電話");
    expect(within(section).queryByText("バリアフリー情報")).not.toBeInTheDocument();
    expect(within(section).queryByText("画像")).not.toBeInTheDocument();
  });
});

describe("location detail action button visuals", () => {
  it("renders the edit and WheelMap links as secondary buttons with the shared shape", async () => {
    await renderDetailPageFor(detailLocation as any);

    const destination = screen.getByRole("link", { name: "ここへ行く" });
    expect(destination).toHaveClass("rounded-full", "dark:rounded-sm");

    const editLink = screen.getByRole("link", { name: /編集する.*OpenStreetMap/ });
    expect(editLink).toHaveClass(
      "btn",
      "btn-secondary",
      "rounded-full",
      "dark:rounded-sm",
      "min-h-[44px]",
      "text-base",
    );
    expect(editLink).not.toHaveClass("btn-outline");

    const barrierLink = screen.getByRole("link", {
      name: /詳細を見る・編集する.*WheelMapを開きます/,
    });
    expect(barrierLink).toHaveClass(
      "btn",
      "btn-secondary",
      "rounded-full",
      "dark:rounded-sm",
      "min-h-[44px]",
      "text-base",
    );
    expect(barrierLink).not.toHaveClass("btn-outline");
  });
});

describe("location detail hours visual contract", () => {
  const hoursVisualLocation = {
    ...detailLocation,
    id: "urn:uuid:00000000-0000-4000-8000-000000000081",
    openingHours: "Tu-Su 10:00-17:30",
    osmEditUrl: "https://www.openstreetmap.org/edit?node=81",
    osmElement: { type: "node", id: 81 } as const,
  };

  it("shows the hours state as a semantic badge", async () => {
    await renderDetailPageFor(hoursVisualLocation as any);

    const status = screen.getByText(/営業中|営業時間外/, { selector: ".badge" });
    expect(status).toHaveClass("text-xl", "font-bold");
    const badge = status.closest(".badge");
    if (!(badge instanceof HTMLElement)) {
      throw new Error("expected the hours status inside a badge");
    }
    expect(badge.className).toMatch(/badge-(success|error)/);
    expect(badge).not.toHaveClass("badge-outline");
  });

  it("keeps hours status text, readable large text and time elements without color-only meaning", async () => {
    const container = await renderDetailPageFor(hoursVisualLocation as any);

    const hoursHeading = screen.getByRole("heading", { level: 2, name: "営業時間" });
    expect(hoursHeading).toHaveClass("text-xl");
    expect(screen.getByText(/営業中|営業時間外/, { selector: ".badge" })).toHaveClass("text-xl", "font-bold");
    const times = container.querySelectorAll("time");
    expect(times.length).toBeGreaterThanOrEqual(7);
    times.forEach((time) => {
      expect(time).toHaveAttribute("dateTime");
    });
    expect(screen.getByText("目安なので、正確な時間は施設に問い合わせてください。")).toHaveClass("text-base");
  });
});
