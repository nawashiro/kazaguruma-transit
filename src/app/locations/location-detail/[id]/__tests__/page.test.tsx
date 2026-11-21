import { isValidElement, type ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type {
  LocationDetailResult,
} from "@/types/access-route-pages";
import type {
  LocationWithArea,
  LocationCategoryWithArea,
  LocationPageDataResult,
} from "@/lib/location/location-page-data";

const HOURS_NOTICE = "目安なので、正確な時間は施設に問い合わせてください。";
const HOLIDAY_WARNING = "祝日は通常と異なる場合があります。";
const NEXT_NOT_FOUND = Symbol("NEXT_NOT_FOUND");
const NEXT_REDIRECT = Symbol("NEXT_REDIRECT");
const mockNotFound = jest.fn(() => {
  throw NEXT_NOT_FOUND;
});
const mockRedirect = jest.fn((url: string) => {
  void url;
  throw NEXT_REDIRECT;
});

jest.mock("next/navigation", () => ({
  notFound: mockNotFound,
  redirect: mockRedirect,
}));

jest.mock("@/lib/location/location-page-data", () => ({
  loadLocationPageData: jest.fn(),
}));

jest.mock("@/lib/location/location-detail-resolver", () => ({
  resolveLocationDetail: jest.fn(),
}));

type LoadLocationPageDataMock = jest.Mock<
  Promise<LocationPageDataResult>,
  []
>;
type ResolveLocationDetailMock = jest.Mock<
  LocationDetailResult<LocationWithArea>,
  [unknown, LocationPageDataResult]
>;

type LocationPageDataModuleMock = {
  loadLocationPageData: LoadLocationPageDataMock;
};

type LocationDetailResolverModuleMock = {
  resolveLocationDetail: ResolveLocationDetailMock;
};

const locationPageDataMock = jest.requireMock(
  "@/lib/location/location-page-data",
) as LocationPageDataModuleMock;
const locationDetailResolverMock = jest.requireMock(
  "@/lib/location/location-detail-resolver",
) as LocationDetailResolverModuleMock;
const mockLoadLocationPageData = locationPageDataMock.loadLocationPageData;
const mockResolveLocationDetail = locationDetailResolverMock.resolveLocationDetail;

const detailCategory: LocationCategoryWithArea = {
  category: "市役所・東京都の区役所",
  categoryId: "1302",
  locations: [],
};

const completeLocation: LocationWithArea = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000001",
  name: "千代田区役所",
  lat: 35.694,
  lng: 139.753,
  area: "神田",
  imageUri: "https://example.test/city.jpg",
  imageCreator: "さくら",
  imageLicense: "https://creativecommons.org/licenses/by-sa/3.0/",
  image: {
    width: 1280,
    height: 853,
    variants: [
      {
        width: 480,
        path: "/generated/location-images/0123456789abcdef-480.webp",
      },
      {
        width: 960,
        path: "/generated/location-images/fedcba9876543210-960.webp",
      },
      {
        width: 1280,
        path: "/generated/location-images/89abcdef01234567-1280.webp",
      },
    ],
  },
  relatedPages: [
    { name: "東京バリアフリーマップ", url: "https://example.test/bfm/city" },
  ],
  osmElement: { type: "node", id: 1 },
  wheelchair: "yes",
  osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
};

const locationWithoutOptionalFields: LocationWithArea = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000002",
  name: "小川町ホール",
  lat: 35.695,
  lng: 139.765,
  area: "神田",
  relatedPages: [],
  osmElement: { type: "way", id: 2 },
  wheelchair: null,
  osmEditUrl: "https://www.openstreetmap.org/edit?way=2",
};

type PublicModule = Record<string, unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

type LocationDetailPage = (props: {
  params: Promise<{ id: string }>;
}) => ReactNode | Promise<ReactNode>;

type LocationDetailMetadata = (props: {
  params: Promise<{ id: string }>;
}) => unknown | Promise<unknown>;

function loadNestedDetailPageModule(): ModuleState {
  try {
    // Keep an intentionally absent route as a named public-boundary RED.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded route boundary
    const loaded: unknown = require("../page");
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error("expected the nested route module to export an object"),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

function getNestedDetailPageModule(): PublicModule {
  const state = loadNestedDetailPageModule();
  const publicRoute = "/locations/location-detail/[id]";

  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `${publicRoute} page is not implemented: public module ../page could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(`${publicRoute} page is not implemented: public module ../page exported nothing`);
  }

  return state.exports;
}

function getNestedDetailPage(): LocationDetailPage {
  const page = getNestedDetailPageModule().default;
  if (typeof page !== "function") {
    throw new Error(
      "/locations/location-detail/[id] page is not implemented: public module ../page does not export a default page",
    );
  }
  return page as LocationDetailPage;
}

function getGenerateMetadata(): LocationDetailMetadata {
  const generateMetadata = getNestedDetailPageModule().generateMetadata;
  if (typeof generateMetadata !== "function") {
    throw new Error(
      "/locations/location-detail/[id] page is not implemented: public module ../page does not export generateMetadata",
    );
  }
  return generateMetadata as LocationDetailMetadata;
}

function multiCategoryDataFor(location: LocationWithArea): LocationPageDataResult {
  return {
    status: "success",
    categories: [
      { ...detailCategory, locations: [location] },
      {
        category: "図書館",
        categoryId: "1512",
        locations: [{ ...location }],
      },
    ],
  };
}

function successDataFor(location: LocationWithArea): LocationPageDataResult {
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

function duplicateDataFor(location: LocationWithArea): LocationPageDataResult {
  return {
    status: "success",
    categories: [
      {
        ...detailCategory,
        locations: [location],
      },
      {
        category: "別カテゴリ",
        categoryId: "1512",
        locations: [{ ...location, name: "同じIDの別施設" }],
      },
    ],
  };
}

function malformedRequiredData(): LocationPageDataResult {
  return {
    status: "success",
    categories: [
      {
        category: detailCategory.category,
        categoryId: detailCategory.categoryId,
        // The wire payload intentionally omits required location fields.
        locations: [{ id: completeLocation.id }],
      },
    ],
  } as unknown as LocationPageDataResult;
}

function configureSuccessfulLocation(location: LocationWithArea): LocationPageDataResult {
  const data = successDataFor(location);
  mockLoadLocationPageData.mockResolvedValue(data);
  mockResolveLocationDetail.mockReturnValue({
    status: "success",
    location,
  });
  return data;
}

async function renderLocationDetailPage(location: LocationWithArea) {
  const loadedData = configureSuccessfulLocation(location);
  const page = getNestedDetailPage();
  const element = await page({
    params: Promise.resolve({ id: location.id }),
  });

  expectLocationBoundaryCalls(location.id, loadedData);

  if (!isValidElement(element)) {
    throw new Error("nested location detail page did not render a public React element");
  }

  return render(<main id="main-content">{element}</main>);
}

type PageInvocation = {
  element: ReactNode | null;
  error: unknown | null;
};

async function invokeLocationDetailPage(id: string): Promise<PageInvocation> {
  const page = getNestedDetailPage();

  try {
    const element = await page({
      params: Promise.resolve({ id }),
    });
    return { element, error: null };
  } catch (error) {
    return { element: null, error };
  }
}

function decodedLocationId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

function expectLocationBoundaryCalls(
  id: string,
  data: LocationPageDataResult,
): void {
  expect(mockLoadLocationPageData).toHaveBeenCalledTimes(1);
  expect(mockLoadLocationPageData).toHaveBeenCalledWith();
  expect(mockResolveLocationDetail).toHaveBeenCalledTimes(1);
  expect(mockResolveLocationDetail).toHaveBeenCalledWith(
    decodedLocationId(id),
    data,
  );
}

function renderPageInvocation(invocation: PageInvocation): void {
  expect(invocation.error).toBeNull();
  if (invocation.error !== null) {
    return;
  }

  if (!isValidElement(invocation.element)) {
    throw new Error("nested location detail page did not render a public React element");
  }

  render(<main id="main-content">{invocation.element}</main>);
}

function expectedDestinationHref(location: LocationWithArea): string {
  return `/?destination=${encodeURIComponent(
    JSON.stringify({
      lat: location.lat,
      lng: location.lng,
      address: location.name,
    }),
  )}`;
}

function getSectionByHeading(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 2, name });
  const section = heading.closest("section");
  if (!(section instanceof HTMLElement)) {
    throw new Error(`expected ${name} heading to be inside a section`);
  }
  return section;
}

function getWheelchairSection(): HTMLElement {
  return getSectionByHeading("車いす情報");
}

function getBarrierInfoSection(): HTMLElement {
  return getSectionByHeading("バリアフリー情報");
}

function getBasicInfoSection(): HTMLElement {
  return getSectionByHeading("基本情報");
}

function getRow(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt" });
  const row = term.closest(".list-row");
  if (!(row instanceof HTMLElement)) {
    throw new Error(`expected ${label} to be inside a list row`);
  }
  return row;
}

function expectDefinitionListPairs(
  list: HTMLElement,
  expectedPairs: ReadonlyArray<readonly [string, string]>,
): void {
  const terms = Array.from(list.querySelectorAll("dt"));
  const definitions = Array.from(list.querySelectorAll("dd"));

  expect(terms).toHaveLength(expectedPairs.length);
  expect(definitions).toHaveLength(expectedPairs.length);

  for (const [index, [expectedTerm, expectedDefinition]] of expectedPairs.entries()) {
    const term = terms[index];
    if (!term) {
      throw new Error(`expected definition-list term at index ${index}`);
    }

    expect(term).toHaveTextContent(expectedTerm);
    const followingElement = term.nextElementSibling;
    expect(followingElement?.tagName).toBe("DD");
    expect(followingElement).toHaveTextContent(expectedDefinition);
  }
}

function getCategoryBreadcrumbLink(): HTMLAnchorElement {
  const nav = screen.getByRole("navigation", { name: "パンくずリスト" });
  const link = Array.from(nav.querySelectorAll("a")).find(
    (candidate): candidate is HTMLAnchorElement =>
      (candidate.textContent ?? "").includes(detailCategory.category),
  );

  if (!link) {
    throw new Error("expected a category breadcrumb link containing the category name");
  }
  return link;
}

function expectPageLinksToBeNamedAndSafe(container: HTMLElement): void {
  const anchors = Array.from(container.querySelectorAll("a"));
  expect(anchors.length).toBeGreaterThan(0);

  for (const anchor of anchors) {
    expect(anchor).toHaveAccessibleName();

    const href = anchor.getAttribute("href");
    expect(href?.trim()).toBeTruthy();
    expect(href).not.toMatch(/^#/);
    expect(href).not.toMatch(/^(?:javascript:|data:)/i);
    expect(href).not.toContain("origin=");
  }

  const externalLinks = anchors.filter((anchor) =>
    /^https?:\/\//i.test(anchor.getAttribute("href") ?? ""),
  );
  for (const externalLink of externalLinks) {
    expect(externalLink).toHaveAccessibleName();
    expect(externalLink.getAttribute("href")).toMatch(/^https?:\/\//i);
    expect(externalLink).toHaveAttribute("target", "_blank");
    expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");
  }
}

function expectSafeDataErrorState(
  headingName: string,
  messagePattern: RegExp,
  additionalForbiddenLocationNames: readonly string[] = [],
): void {
  const heading = screen.getByRole("heading", {
    level: 1,
    name: headingName,
  });

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(heading).toBeVisible();
  expect(screen.getByText(messagePattern)).toBeVisible();
  expect(
    screen.queryByRole("heading", { level: 1, name: "場所が見つかりません" }),
  ).not.toBeInTheDocument();

  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(1);
  expect(links[0]).toHaveAccessibleName("場所一覧");
  expect(links[0]).toHaveAttribute("href", "/locations");
  expect(links[0].getAttribute("href")).not.toContain("origin=");

  for (const locationName of [completeLocation.name, ...additionalForbiddenLocationNames]) {
    expect(screen.queryByRole("heading", { level: 1, name: locationName })).not.toBeInTheDocument();
    expect(screen.queryByText(locationName, { exact: true })).not.toBeInTheDocument();
  }
  expect(screen.queryByRole("heading", { level: 2, name: "提供" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "ここへ行く" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "ウェブサイトを見る" })).not.toBeInTheDocument();
  expect(mockNotFound).not.toHaveBeenCalled();
  expect(mockRedirect).not.toHaveBeenCalled();
}

beforeEach(() => {
  mockLoadLocationPageData.mockReset();
  mockResolveLocationDetail.mockReset();
  mockNotFound.mockClear();
  mockRedirect.mockClear();
});

describe("/locations/location-detail/[id] public server page", () => {
  it("renders a valid unique location with logical headings, details, attribution, and native links", async () => {
    const { container } = await renderLocationDetailPage(completeLocation);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: completeLocation.name,
    });
    const wheelchairHeading = screen.getByRole("heading", {
      level: 2,
      name: "車いす情報",
    });
    const barrierInfoHeading = screen.getByRole("heading", {
      level: 2,
      name: "バリアフリー情報",
    });

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(heading.tagName).toBe("H1");
    expect(heading.compareDocumentPosition(wheelchairHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(wheelchairHeading.compareDocumentPosition(barrierInfoHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const area = completeLocation.area;
    if (typeof area !== "string") {
      throw new Error("completeLocation must include area for this case");
    }
    const regionTerm = screen.getByText("地域", { selector: "dt" });
    const regionList = regionTerm.closest("dl");
    if (!(regionList instanceof HTMLElement)) {
      throw new Error("expected the region term to belong to a definition list");
    }
    expectDefinitionListPairs(regionList, [["地域", area]]);

    const image = container.querySelector("img");
    const derivedImage = completeLocation.image;
    if (!derivedImage) {
      throw new Error("completeLocation must include a derived image");
    }
    const imageVariants = derivedImage.variants;
    expect(image).toHaveAttribute("src", imageVariants[2].path);
    expect(image).toHaveAttribute(
      "srcset",
      imageVariants
        .map((variant) => `${variant.path} ${variant.width}w`)
        .join(", "),
    );
    expect(image).toHaveAttribute(
      "sizes",
      "(min-width: 896px) 864px, calc(100vw - 32px)",
    );
    expect(image).toHaveAttribute("width", "1280");
    expect(image).toHaveAttribute("height", "853");
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).toHaveAttribute("alt", "");
    expect(image).not.toHaveAttribute("role");
    expect(image?.getAttribute("srcset")).toContain("1280w");
    expect(image?.getAttribute("src")).not.toContain("wikimedia");
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.getByText(/さくら/)).toBeInTheDocument();
    const licenseLink = screen.getByRole("link", { name: /CC BY-SA 3\.0.*新しいタブで開きます/ });
    expect(licenseLink).toHaveAttribute("href", completeLocation.imageLicense);
    expect(licenseLink).toHaveAttribute("target", "_blank");
    expect(licenseLink).toHaveAttribute("rel", "noopener noreferrer");

    const wheelchairSection = getWheelchairSection();
    expect(wheelchairSection).toHaveTextContent("全面");
    expect(wheelchairSection).toHaveTextContent("入口には段がなく、全部の部屋に段がありません。");
    expect(wheelchairSection).not.toHaveTextContent("情報源: OpenStreetMap");
    expect(wheelchairSection).toHaveTextContent(
      /© OpenStreetMap contributors.*ODbL-1\.0/,
    );
    const barrierBadge = within(wheelchairSection).getByText("全面").closest(".badge");
    if (!(barrierBadge instanceof HTMLElement)) {
      throw new Error("expected the wheelchair state to be inside a badge");
    }
    expect(barrierBadge).toHaveClass("badge-success");
    expect(barrierBadge).not.toHaveClass("badge-outline");
    expect(within(barrierBadge).getByText("車いす")).toHaveClass("sr-only");
    const detailLink = screen.getByRole("link", {
      name: /編集する.*WheelMapを開きます.*新しいタブで開きます/,
    });
    expect(detailLink).toHaveAttribute("href", "https://wheelmap.org/nodes/1");
    expect(detailLink).toHaveAttribute("target", "_blank");
    expect(detailLink).toHaveAttribute("rel", "noopener noreferrer");
    const barrierInfoSection = getBarrierInfoSection();
    expect(
      within(barrierInfoSection).getByRole("link", {
        name: /東京バリアフリーマップ/,
      }),
    ).toBeInTheDocument();
    expect(barrierInfoSection.querySelector(".badge")).toBeNull();
    expect(screen.queryByRole("heading", { name: "提供" })).not.toBeInTheDocument();

    const categoryBreadcrumbLink = getCategoryBreadcrumbLink();
    expect(categoryBreadcrumbLink).toHaveAttribute(
      "href",
      `/locations/${encodeURIComponent(detailCategory.categoryId)}`,
    );
    expect(categoryBreadcrumbLink.getAttribute("href")).not.toContain("origin=");
    const breadcrumbNav = screen.getByRole("navigation", { name: "パンくずリスト" });
    expect(breadcrumbNav.querySelector('[aria-current="page"]')).toHaveTextContent(completeLocation.name);

    const destinationLink = screen.getByRole("link", { name: "ここへ行く" });
    expect(destinationLink.tagName).toBe("A");
    expect(destinationLink).toHaveAttribute(
      "href",
      expectedDestinationHref(completeLocation),
    );
    expect(destinationLink.getAttribute("href")).not.toContain("origin=");
    expect(screen.queryByRole("button", { name: "ここへ行く" })).not.toBeInTheDocument();

    for (const anchor of Array.from(container.querySelectorAll("a"))) {
      expect(anchor.tagName).toBe("A");
      expect(anchor.getAttribute("href")).toBeTruthy();
      expect(anchor.getAttribute("href")).not.toContain("origin=");
    }
    expectPageLinksToBeNamedAndSafe(container);
  });

  it("generates metadata from the resolved location name without exposing the raw route ID", async () => {
    const loadedData = configureSuccessfulLocation(completeLocation);
    const generateMetadata = getGenerateMetadata();

    const metadata = (await generateMetadata({
      params: Promise.resolve({ id: completeLocation.id }),
    })) as { title?: string };

    expectLocationBoundaryCalls(completeLocation.id, loadedData);
    expect(metadata.title).toBe(`${completeLocation.name} - 場所詳細`);
    expect(metadata.title).not.toContain(completeLocation.id);
  });

  it("keeps primary information, license, destination, and category navigation when optional fields are absent", async () => {
    const { container } = await renderLocationDetailPage(locationWithoutOptionalFields);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: locationWithoutOptionalFields.name,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelector("figcaption")).not.toBeInTheDocument();

    const wheelchairSection = getWheelchairSection();
    expect(wheelchairSection).toHaveTextContent("情報なし");
    expect(wheelchairSection).toHaveTextContent("追加してください。");
    expect(wheelchairSection).not.toHaveTextContent("バリアフリー情報がありません。");
    expect(
      screen.queryByRole("heading", { name: "バリアフリー情報" }),
    ).not.toBeInTheDocument();
    const addLink = screen.getByRole("link", {
      name: /追加する.*WheelMapを開きます.*新しいタブで開きます/,
    });
    expect(addLink).toHaveAttribute("href", "https://wheelmap.org/nodes/-2");
    expect(addLink).toHaveAttribute("target", "_blank");
    expect(addLink).toHaveAttribute("rel", "noopener noreferrer");

    const backLink = getCategoryBreadcrumbLink();
    expect(backLink).toHaveAttribute(
      "href",
      `/locations/${encodeURIComponent(detailCategory.categoryId)}`,
    );
    const destinationLink = screen.getByRole("link", { name: "ここへ行く" });
    expect(destinationLink).toHaveAttribute(
      "href",
      expectedDestinationHref(locationWithoutOptionalFields),
    );
    expect(destinationLink.getAttribute("href")).not.toContain("origin=");
    expect(backLink.getAttribute("href")).not.toContain("origin=");

    expectPageLinksToBeNamedAndSafe(container);
  });

  it("shows an authorless image as 作者不明", async () => {
    const { container } = await renderLocationDetailPage({
      ...completeLocation,
      imageCreator: undefined,
    });

    expect(container.querySelector("img")).not.toBeNull();
    const figcaption = container.querySelector("figcaption");
    expect(figcaption).toHaveTextContent("作者不明・CC BY-SA 3.0");
    expect(screen.queryByText(/さくら/)).not.toBeInTheDocument();
  });

  it("hides an image when the license is missing", async () => {
    const { container } = await renderLocationDetailPage({
      ...completeLocation,
      imageLicense: undefined,
    });

    expect(container.querySelector("img")).toBeNull();
  });

  it("shows a non-URI license as text without a link", async () => {
    const { container } = await renderLocationDetailPage({
      ...completeLocation,
      imageLicense: "Public domain",
    });

    expect(container.querySelector("img")).not.toBeNull();
    expect(screen.getByText(/さくら/)).toBeInTheDocument();
    const figcaption = container.querySelector("figcaption");
    expect(figcaption).toHaveTextContent("さくら・Public domain");
    expect(figcaption?.querySelector("a")).toBeNull();
    expect(screen.queryByRole("link", { name: /Public domain/ })).toBeNull();
  });

  it("keeps linking an absolute license URI", async () => {
    await renderLocationDetailPage(completeLocation);

    const licenseLink = screen.getByRole("link", {
      name: /CC BY-SA 3\.0/,
    });
    expect(licenseLink).toHaveAttribute("href", completeLocation.imageLicense);
  });

  it("shows the edit link before the source at the end of basic information", async () => {
    await renderLocationDetailPage({
      ...completeLocation,
      phone: { display: "03-3264-2111", tel: "tel:0332642111" },
    });

    const basicInfo = getBasicInfoSection();
    const source = within(basicInfo)
      .getByRole("link", { name: /OpenStreetMap contributors/ })
      .closest("p");
    if (!(source instanceof HTMLElement)) {
      throw new Error("expected the source line in basic information");
    }
    expect(source).toHaveTextContent(/© OpenStreetMap contributors.*ODbL-1\.0/);

    const editLink = within(basicInfo).getByRole("link", {
      name: /編集する.*OpenStreetMapを開きます/,
    });
    expect(editLink.closest("p")).not.toHaveClass("justify-end");
    expect(
      editLink.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "提供" })).not.toBeInTheDocument();
  });

  it("shows the OSM source in wheelchair and basic information without a provider section", async () => {
    await renderLocationDetailPage({
      ...completeLocation,
      phone: { display: "03-3264-2111", tel: "tel:0332642111" },
    });

    const wheelchair = getWheelchairSection();
    const basicInfo = getBasicInfoSection();
    for (const section of [wheelchair, basicInfo]) {
      expect(
        within(section).getByRole("link", { name: /OpenStreetMap contributors/ }),
      ).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    }
    expect(
      screen.getAllByRole("link", { name: /OpenStreetMap contributors/ }),
    ).toHaveLength(2);

    expect(screen.queryByRole("heading", { name: "提供" })).not.toBeInTheDocument();
    expect(screen.queryByText("座標・電話")).not.toBeInTheDocument();
    expect(
      screen.queryByText("バリアフリー情報（wheelchairタグ）"),
    ).not.toBeInTheDocument();
  });

  it("links every category for a location in multiple categories", async () => {
    const loadedData = multiCategoryDataFor(completeLocation);
    mockLoadLocationPageData.mockResolvedValue(loadedData);
    mockResolveLocationDetail.mockReturnValue({
      status: "success",
      location: completeLocation,
    });

    renderPageInvocation(await invokeLocationDetailPage(completeLocation.id));

    const categoryNav = screen.getByRole("navigation", { name: "カテゴリ" });
    const categoryLinks = within(categoryNav)
      .getAllByRole("link")
      .map((link) => ({
        name: link.textContent,
        href: link.getAttribute("href"),
      }));
    expect(categoryLinks).toEqual([
      {
        name: detailCategory.category,
        href: `/locations/${encodeURIComponent(detailCategory.categoryId)}`,
      },
      {
        name: "図書館",
        href: `/locations/${encodeURIComponent("1512")}`,
      },
    ]);
    expect(getCategoryBreadcrumbLink()).toHaveAttribute(
      "href",
      `/locations/${encodeURIComponent(detailCategory.categoryId)}`,
    );
  });

  it("deduplicates static params across categories", async () => {
    mockLoadLocationPageData.mockResolvedValue(
      multiCategoryDataFor(completeLocation),
    );

    const generateStaticParams = getNestedDetailPageModule()
      .generateStaticParams as (() => Promise<Array<{ id: string }>>) | undefined;
    if (typeof generateStaticParams !== "function") {
      throw new Error("generateStaticParams is not implemented");
    }

    await expect(generateStaticParams()).resolves.toEqual([
      { id: completeLocation.id },
    ]);
  });

  it("uses the safe locations fallback when direct access has no identifiable category context", async () => {
    const loadedData = successDataFor(locationWithoutOptionalFields);
    mockLoadLocationPageData.mockResolvedValue(loadedData);
    mockResolveLocationDetail.mockReturnValue({
      status: "success",
      location: completeLocation,
    });

    renderPageInvocation(await invokeLocationDetailPage(completeLocation.id));

    expectLocationBoundaryCalls(completeLocation.id, loadedData);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: completeLocation.name,
      }),
    ).toBeInTheDocument();

    const breadcrumbNav = screen.getByRole("navigation", { name: "パンくずリスト" });
    const breadcrumbLinks = breadcrumbNav.querySelectorAll("a");
    expect(breadcrumbLinks).toHaveLength(1);
    expect(breadcrumbLinks[0]).toHaveAccessibleName("場所一覧");
    expect(breadcrumbLinks[0]).toHaveAttribute("href", "/locations");
    expect(breadcrumbLinks[0].getAttribute("href")).not.toContain("origin=");
    expect(
      breadcrumbNav.querySelector('[aria-current="page"]'),
    ).toHaveTextContent(completeLocation.name);
  });

  it("decodes a percent-encoded urn before resolving the location", async () => {
    const loadedData = successDataFor(completeLocation);
    mockLoadLocationPageData.mockResolvedValue(loadedData);
    mockResolveLocationDetail.mockReturnValue({
      status: "success",
      location: completeLocation,
    });

    renderPageInvocation(
      await invokeLocationDetailPage(encodeURIComponent(completeLocation.id)),
    );

    expectLocationBoundaryCalls(completeLocation.id, loadedData);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: completeLocation.name,
      }),
    ).toBeInTheDocument();
  });

  const standardNotFoundCases: ReadonlyArray<
    readonly [string, string, LocationDetailResult<LocationWithArea>]
  > = [
    ["unknown location ID", "unknown-location", { status: "not-found" }],
    [
      "empty location ID",
      "",
      {
        status: "error",
        reason: "invalid-request-id",
        error: new Error("場所識別子が不正です"),
      },
    ],
    [
      "slash-containing location ID",
      "invalid/id",
      {
        status: "error",
        reason: "invalid-request-id",
        error: new Error("場所識別子が不正です"),
      },
    ],
    [
      "encoded slash location ID",
      "%2F",
      {
        status: "error",
        reason: "invalid-request-id",
        error: new Error("場所識別子が不正です"),
      },
    ],
    [
      "control-character location ID",
      "invalid\u0001id",
      {
        status: "error",
        reason: "invalid-request-id",
        error: new Error("場所識別子が不正です"),
      },
    ],
    [
      "malformed percent-encoded location ID",
      "%E0%A4%A",
      {
        status: "error",
        reason: "invalid-request-id",
        error: new Error("場所識別子が不正です"),
      },
    ],
  ];

  it.each(standardNotFoundCases)(
    "uses the Next standard notFound boundary for %s instead of detail UI",
    async (_caseName, id, resolverResult) => {
      const loadedData = successDataFor(completeLocation);
      mockLoadLocationPageData.mockResolvedValue(loadedData);
      mockResolveLocationDetail.mockReturnValue(resolverResult);

      const invocation = await invokeLocationDetailPage(id);

      expectLocationBoundaryCalls(id, loadedData);
      expect(invocation.error).toBe(NEXT_NOT_FOUND);
      expect(invocation.element).toBeNull();
      expect(mockNotFound).toHaveBeenCalledTimes(1);
      expect(mockRedirect).not.toHaveBeenCalled();
    },
  );

  it("uses the Next standard notFound boundary for a location ID excluded from the catalog artifact", async () => {
    const loadedData = successDataFor(completeLocation);
    mockLoadLocationPageData.mockResolvedValue(loadedData);
    const realResolver = jest.requireActual(
      "@/lib/location/location-detail-resolver",
    ) as typeof import("@/lib/location/location-detail-resolver");
    mockResolveLocationDetail.mockImplementation(realResolver.resolveLocationDetail);
    const excludedId = "urn:uuid:00000000-0000-4000-8000-0000000000aa";

    const invocation = await invokeLocationDetailPage(excludedId);

    expectLocationBoundaryCalls(excludedId, loadedData);
    expect(invocation.error).toBe(NEXT_NOT_FOUND);
    expect(invocation.element).toBeNull();
    expect(mockNotFound).toHaveBeenCalledTimes(1);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("renders a Japanese data-error for duplicate IDs across categories without selecting either location", async () => {
    const loadedData = duplicateDataFor(completeLocation);
    mockLoadLocationPageData.mockResolvedValue(loadedData);
    mockResolveLocationDetail.mockReturnValue({
      status: "error",
      reason: "duplicate-id",
      error: new Error("場所識別子が重複しています"),
    });

    renderPageInvocation(await invokeLocationDetailPage(completeLocation.id));

    expectLocationBoundaryCalls(completeLocation.id, loadedData);
    expectSafeDataErrorState(
      "場所詳細を表示できません",
      /重複/,
      ["同じIDの別施設"],
    );
  });

  it("renders a Japanese data-error for a malformed required loaded payload", async () => {
    const loadedData = malformedRequiredData();
    mockLoadLocationPageData.mockResolvedValue(loadedData);
    mockResolveLocationDetail.mockReturnValue({
      status: "error",
      reason: "invalid-data",
      error: new Error("場所データの形式が不正です"),
    });

    renderPageInvocation(await invokeLocationDetailPage(completeLocation.id));

    expectLocationBoundaryCalls(completeLocation.id, loadedData);
    expectSafeDataErrorState("場所詳細を表示できません", /形式が不正/);
  });

  const loaderFailureCases: ReadonlyArray<
    readonly [string, () => LocationPageDataResult]
  > = [
    [
      "HTTP failure",
      () => {
        const data: LocationPageDataResult = {
          status: "error",
          error: new Error("HTTP 503"),
        };
        mockLoadLocationPageData.mockResolvedValue(data);
        return data;
      },
    ],
    [
      "JSON failure",
      () => {
        const data: LocationPageDataResult = {
          status: "error",
          error: new Error("JSON parse failure"),
        };
        mockLoadLocationPageData.mockResolvedValue(data);
        return data;
      },
    ],
    [
      "transport failure",
      () => {
        const error = new Error("network unavailable");
        mockLoadLocationPageData.mockRejectedValueOnce(error);
        return { status: "error", error };
      },
    ],
  ];

  it.each(loaderFailureCases)(
    "renders a Japanese data-load-error distinct from 404 for a loader %s",
    async (_caseName, configureLoaderFailure) => {
      const loadedData = configureLoaderFailure();
      mockResolveLocationDetail.mockReturnValue({
        status: "data-load-error",
        error: new Error("場所データを取得できません"),
      });

      renderPageInvocation(await invokeLocationDetailPage(completeLocation.id));

      expectLocationBoundaryCalls(completeLocation.id, loadedData);
      expectSafeDataErrorState("場所データを取得できません", /取得に失敗しました/);
    },
  );
});

describe("location facts basic information", () => {
  const factsLocation: LocationWithArea = {
    ...completeLocation,
    id: "urn:uuid:00000000-0000-4000-8000-000000000101",
    phone: { display: "03-3264-2111", tel: "tel:0332642111" },
    websiteUri: "https://www.city.chiyoda.lg.jp/",
    wikipediaUri: "https://ja.wikipedia.org/wiki/%E5%8D%83%E4%BB%A3%E7%94%B0",
    osmEditUrl: "https://www.openstreetmap.org/edit?node=101",
    osmElement: { type: "node", id: 101 },
  };

  const wayLocation: LocationWithArea = {
    ...completeLocation,
    id: "urn:uuid:00000000-0000-4000-8000-000000000102",
    osmElement: { type: "way", id: 102 },
    osmEditUrl: "https://www.openstreetmap.org/edit?way=102",
    phone: undefined,
    websiteUri: undefined,
    wikipediaUri: undefined,
  };

  const relationLocation: LocationWithArea = {
    ...completeLocation,
    id: "urn:uuid:00000000-0000-4000-8000-000000000103",
    osmElement: { type: "relation", id: 103 },
    osmEditUrl: "https://www.openstreetmap.org/edit?relation=103",
    phone: undefined,
    websiteUri: undefined,
    wikipediaUri: undefined,
  };

  async function renderFactsLocation(location: LocationWithArea) {
    const data = successDataFor(location);
    mockLoadLocationPageData.mockResolvedValue(data);
    mockResolveLocationDetail.mockReturnValue({ status: "success", location });
    const { element } = await invokeLocationDetailPage(location.id);
    if (!isValidElement(element)) {
      throw new Error("facts detail did not render");
    }
    return render(<main id="main-content">{element}</main>);
  }

  it("shows edit link at the end of basic information with node URL", async () => {
    await renderFactsLocation(factsLocation);
    const basicInfo = getBasicInfoSection();
    const editLink = within(basicInfo).getByRole("link", {
      name: /編集する.*OpenStreetMapを開きます.*新しいタブで開きます/,
    });
    expect(editLink).toHaveAttribute("href", "https://www.openstreetmap.org/edit?node=101");
    expect(editLink).toHaveAttribute("target", "_blank");
    expect(editLink).toHaveAttribute("rel", "noopener noreferrer");

    const source = within(basicInfo)
      .getByRole("link", { name: /OpenStreetMap contributors/ })
      .closest("p");
    if (!(source instanceof HTMLElement)) {
      throw new Error("expected the source line in basic information");
    }
    expect(
      editLink.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows way and relation edit URLs", async () => {
    await renderFactsLocation(wayLocation);
    expect(screen.getByRole("link", { name: /^編集する（OpenStreetMapを開きます）/ })).toHaveAttribute("href", "https://www.openstreetmap.org/edit?way=102");
    await renderFactsLocation(relationLocation);
    const editLinks = screen.getAllByRole("link", { name: /編集する.*OpenStreetMap.*新しいタブで開きます/ });
    const factsEdit = editLinks.find((l) => l.getAttribute("href") === "https://www.openstreetmap.org/edit?relation=103");
    expect(factsEdit).toBeDefined();
  });

  it("shows phone tel link, website and wikipedia links", async () => {
    const { container } = await renderFactsLocation(factsLocation);
    expect(screen.getByRole("link", { name: /03-3264-2111/ })).toHaveAttribute("href", "tel:0332642111");
    expect(screen.getByRole("link", { name: /ウェブサイトを開く/ })).toHaveAttribute("href", "https://www.city.chiyoda.lg.jp/");
    expect(screen.getByRole("link", { name: /Wikipedia/ })).toHaveAttribute("href", expect.stringContaining("wikipedia.org"));
    expect(container.querySelector('a[href^="tel:"]')).not.toBeNull();
  });

  it("shows basic information with only the edit link when facts and hours are missing", async () => {
    const noFacts = { ...wayLocation, phone: undefined, websiteUri: undefined, wikipediaUri: undefined };
    await renderFactsLocation(noFacts as LocationWithArea);

    const basicInfo = getBasicInfoSection();
    expect(
      within(basicInfo).getByRole("link", {
        name: /編集する.*OpenStreetMapを開きます/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /03-/ })).not.toBeInTheDocument();
  });

  it("hides basic information when facts, hours and edit link are missing", async () => {
    const empty = {
      ...wayLocation,
      phone: undefined,
      websiteUri: undefined,
      wikipediaUri: undefined,
      osmEditUrl: "",
    };
    await renderFactsLocation(empty as LocationWithArea);

    expect(
      screen.queryByRole("heading", { level: 2, name: "基本情報" }),
    ).not.toBeInTheDocument();
  });

  it("shows basic info section when some facts exist", async () => {
    await renderFactsLocation(factsLocation);
    expect(screen.getByRole("heading", { level: 2, name: "基本情報" })).toBeInTheDocument();
  });
});

describe("location opening hours", () => {
  const openLocation: LocationWithArea = {
    ...completeLocation,
    id: "urn:uuid:00000000-0000-4000-8000-000000000201",
    openingHours: "Tu-Su 10:00-17:30",
    osmEditUrl: "https://www.openstreetmap.org/edit?node=201",
    osmElement: { type: "node", id: 201 },
  };

  const allDayLocation: LocationWithArea = {
    ...completeLocation,
    id: "urn:uuid:00000000-0000-4000-8000-000000000202",
    openingHours: "24/7",
    osmEditUrl: "https://www.openstreetmap.org/edit?node=202",
    osmElement: { type: "node", id: 202 },
  };

  const noHoursLocation: LocationWithArea = {
    ...completeLocation,
    id: "urn:uuid:00000000-0000-4000-8000-000000000203",
    openingHours: undefined,
    osmEditUrl: "https://www.openstreetmap.org/edit?node=203",
    osmElement: { type: "node", id: 203 },
  };

  const invalidLocation: LocationWithArea = {
    ...completeLocation,
    id: "urn:uuid:00000000-0000-4000-8000-000000000204",
    openingHours: "not a rule",
    osmEditUrl: "https://www.openstreetmap.org/edit?node=204",
    osmElement: { type: "node", id: 204 },
  };

  async function renderHoursLocation(location: LocationWithArea) {
    const data = successDataFor(location);
    mockLoadLocationPageData.mockResolvedValue(data);
    mockResolveLocationDetail.mockReturnValue({ status: "success", location });
    const { element } = await invokeLocationDetailPage(location.id);
    if (!isValidElement(element)) {
      throw new Error("opening hours did not render");
    }
    return render(<main id="main-content">{element}</main>);
  }

  it("shows open/closed status, next change, 7-day plan and notice in both rows", async () => {
    const { container } = await renderHoursLocation(openLocation);
    const basicInfo = getBasicInfoSection();
    expect(within(basicInfo).getByText(/営業中|営業時間外/)).toBeInTheDocument();
    expect(within(basicInfo).getAllByText(HOURS_NOTICE)).toHaveLength(2);
    const times = container.querySelectorAll("time");
    expect(times.length).toBeGreaterThanOrEqual(7);
  });

  it("shows 24-hour operation with seven days", async () => {
    const { container } = await renderHoursLocation(allDayLocation);
    expect(screen.getByText("24時間営業")).toBeInTheDocument();
    expect(container.querySelectorAll("time").length).toBeGreaterThanOrEqual(7);
  });

  it("uses Japanese-day boundaries and labels the next opening as 明日", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-18T08:21:00Z"));
    try {
      const wardOffice: LocationWithArea = {
        ...openLocation,
        id: "urn:uuid:00000000-0000-4000-8000-000000000206",
        openingHours: "Mo-Fr 08:30-17:00; PH off",
        osmEditUrl: "https://www.openstreetmap.org/edit?node=206",
        osmElement: { type: "node", id: 206 },
      };
      const { container } = await renderHoursLocation(wardOffice);

      const basicInfo = getBasicInfoSection();
      expect(basicInfo).toHaveTextContent("営業時間外 明日08:30から");
      const today = container.querySelector('time[dateTime="2026-11-18"]');
      expect(today?.closest("div")).toHaveTextContent("08:30-17:00");
      expect(today?.closest("div")).not.toHaveTextContent("08:30-09:00");
      const holiday = container.querySelector('time[dateTime="2026-11-23"]');
      expect(holiday?.closest("div")).toHaveTextContent("休み");
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows holiday warning only on a Japanese holiday without PH/SH", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-23T03:00:00Z"));
    try {
      await renderHoursLocation(openLocation);
      expect(screen.getByText(HOLIDAY_WARNING)).toBeInTheDocument();
      cleanup();
    } finally {
      jest.useRealTimers();
    }

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-18T03:00:00Z"));
    try {
      await renderHoursLocation(openLocation);
      expect(screen.queryByText(HOLIDAY_WARNING)).not.toBeInTheDocument();
      cleanup();
    } finally {
      jest.useRealTimers();
    }

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-23T03:00:00Z"));
    try {
      const withPh = { ...openLocation, openingHours: "Mo-Fr 09:00-17:00; PH off", id: "urn:uuid:00000000-0000-4000-8000-000000000205" };
      await renderHoursLocation(withPh as LocationWithArea);
      expect(screen.queryByText(HOLIDAY_WARNING)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows raw rule when unparsable and hides rows when missing", async () => {
    await renderHoursLocation(invalidLocation);
    const basicInfo = getBasicInfoSection();
    expect(within(basicInfo).getByText("not a rule")).toBeInTheDocument();
    expect(within(basicInfo).queryByText(/営業中|営業時間外/)).not.toBeInTheDocument();
    expect(within(basicInfo).queryByText(HOLIDAY_WARNING)).not.toBeInTheDocument();
    expect(within(basicInfo).getAllByText(HOURS_NOTICE)).toHaveLength(1);
    cleanup();
    await renderHoursLocation(noHoursLocation);
    expect(screen.queryByText("営業時間", { selector: "dt" })).not.toBeInTheDocument();
    expect(screen.queryByText("営業状態", { selector: "dt" })).not.toBeInTheDocument();
  });

  it("shows open, 24-hour and closed states as semantic badges", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-18T02:00:00Z"));
    try {
      await renderHoursLocation(openLocation);
      const openBadge = screen.getByText("営業中", { selector: ".badge" }).closest(".badge");
      expect(openBadge).toHaveClass("badge-success", "text-xl");
      expect(openBadge).not.toHaveClass("badge-outline");
      cleanup();
    } finally {
      jest.useRealTimers();
    }

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-18T09:00:00Z"));
    try {
      await renderHoursLocation(openLocation);
      const closedBadge = screen.getByText("営業時間外", { selector: ".badge" }).closest(".badge");
      expect(closedBadge).toHaveClass("badge-error", "text-xl");
      cleanup();
    } finally {
      jest.useRealTimers();
    }

    await renderHoursLocation(allDayLocation);
    expect(screen.getByText("24時間営業", { selector: ".badge" }).closest(".badge")).toHaveClass(
      "badge-success",
    );
  });

  it("does not render a status badge for an unparsable rule", async () => {
    await renderHoursLocation(invalidLocation);

    const basicInfo = getBasicInfoSection();
    expect(basicInfo.querySelector(".badge")).toBeNull();
    expect(within(basicInfo).getByText("not a rule")).toBeInTheDocument();
  });

  it("places status and hours rows inside basic information", async () => {
    await renderHoursLocation({
      ...openLocation,
      phone: { display: "03-3264-2111", tel: "tel:0332642111" },
    });

    const basicInfo = getBasicInfoSection();
    const statusRow = getRow("営業状態");
    const hoursRow = getRow("営業時間");
    expect(basicInfo).toContainElement(statusRow);
    expect(basicInfo).toContainElement(hoursRow);
    expect(
      statusRow.compareDocumentPosition(hoursRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { level: 2, name: "営業時間" }),
    ).not.toBeInTheDocument();
  });
});
