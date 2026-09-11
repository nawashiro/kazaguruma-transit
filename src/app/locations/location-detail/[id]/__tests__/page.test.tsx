import { isValidElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type {
  LocationDetailResult,
} from "@/types/access-route-pages";
import type {
  KeyLocation,
  KeyLocationCategory,
  KeyLocationsDataResult,
} from "@/utils/addressLoader";

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
  Promise<KeyLocationsDataResult>,
  []
>;
type ResolveLocationDetailMock = jest.Mock<
  LocationDetailResult<KeyLocation>,
  [unknown, KeyLocationsDataResult]
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

const detailCategory: KeyLocationCategory = {
  category: "公共施設",
  "category:en": "public facilities",
  locations: [],
};

const completeLocation: KeyLocation = {
  id: "kanda-library-日本",
  name: "神田図書館",
  lat: 35.694,
  lng: 139.768,
  area: "神田",
  description: "地域の図書館です",
  descriptionCopyright: "千代田区オープンデータ",
  imageUri: "https://example.test/kanda-library.jpg",
  imageCopyright: "市民写真家",
  uri: "https://example.test/kanda-library",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

// Optional display fields are intentionally omitted while identity, coordinates,
// attribution, and the license remain available to the detail page.
const locationWithoutOptionalFields: KeyLocation = {
  id: "ogawamachi-hall",
  name: "小川町ホール",
  lat: 35.695,
  lng: 139.765,
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
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

function successDataFor(location: KeyLocation): KeyLocationsDataResult {
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

function duplicateDataFor(location: KeyLocation): KeyLocationsDataResult {
  return {
    status: "success",
    categories: [
      {
        ...detailCategory,
        locations: [location],
      },
      {
        category: "別カテゴリ",
        "category:en": "another category",
        locations: [{ ...location, name: "同じIDの別施設" }],
      },
    ],
  };
}

function malformedRequiredData(): KeyLocationsDataResult {
  return {
    status: "success",
    categories: [
      {
        category: detailCategory.category,
        "category:en": detailCategory["category:en"],
        // The wire payload intentionally omits required location fields.
        locations: [{ id: completeLocation.id }],
      },
    ],
  } as unknown as KeyLocationsDataResult;
}

function configureSuccessfulLocation(location: KeyLocation): KeyLocationsDataResult {
  const data = successDataFor(location);
  mockLoadLocationPageData.mockResolvedValue(data);
  mockResolveLocationDetail.mockReturnValue({
    status: "success",
    location,
  });
  return data;
}

async function renderLocationDetailPage(location: KeyLocation) {
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

function expectLocationBoundaryCalls(
  id: string,
  data: KeyLocationsDataResult,
): void {
  expect(mockLoadLocationPageData).toHaveBeenCalledTimes(1);
  expect(mockLoadLocationPageData).toHaveBeenCalledWith();
  expect(mockResolveLocationDetail).toHaveBeenCalledTimes(1);
  expect(mockResolveLocationDetail).toHaveBeenCalledWith(id, data);
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

function expectedDestinationHref(location: KeyLocation): string {
  return `/?destination=${encodeURIComponent(
    JSON.stringify({
      lat: location.lat,
      lng: location.lng,
      address: location.name,
    }),
  )}`;
}

function getProvidedInfoList(): HTMLElement {
  const heading = screen.getByRole("heading", { level: 2, name: "提供" });
  const list = heading.parentElement?.querySelector("dl");
  if (!(list instanceof HTMLElement)) {
    throw new Error("expected the provided-information heading to contain a definition list");
  }
  return list;
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

function getCategoryBackLink(): HTMLAnchorElement {
  const link = Array.from(screen.getAllByRole("link")).find(
    (candidate): candidate is HTMLAnchorElement =>
      candidate.tagName === "A" &&
      (candidate.textContent ?? "").includes(detailCategory.category) &&
      (candidate.textContent ?? "").includes("戻る"),
  );

  if (!link) {
    throw new Error("expected a native category back link containing the category name");
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
  expect(links[0]).toHaveAccessibleName("場所一覧に戻る");
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
    const providedHeading = screen.getByRole("heading", {
      level: 2,
      name: "提供",
    });

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(heading.tagName).toBe("H1");
    expect(heading.compareDocumentPosition(providedHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const description = completeLocation.description;
    const area = completeLocation.area;
    if (typeof description !== "string" || typeof area !== "string") {
      throw new Error("completeLocation must include description and area for this case");
    }
    expect(screen.getByText(description)).toBeInTheDocument();

    const regionTerm = screen.getByText("地域", { selector: "dt" });
    const regionList = regionTerm.closest("dl");
    if (!(regionList instanceof HTMLElement)) {
      throw new Error("expected the region term to belong to a definition list");
    }
    expectDefinitionListPairs(regionList, [["地域", area]]);

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", completeLocation.imageUri);
    expect(image).toHaveAttribute("alt", "");
    expect(image).not.toHaveAttribute("role");
    expect(container.querySelectorAll("img")).toHaveLength(1);

    const websiteLink = screen.getByRole("link", { name: "ウェブサイトを見る" });
    expect(websiteLink).toHaveAttribute("href", completeLocation.uri);
    expect(websiteLink).toHaveAttribute("target", "_blank");
    expect(websiteLink).toHaveAttribute("rel", "noopener noreferrer");

    const infoList = getProvidedInfoList();
    expectDefinitionListPairs(infoList, [
      ["座標データ提供", completeLocation.nodeCopyright],
      ["画像提供", completeLocation.imageCopyright ?? ""],
      ["説明文提供", completeLocation.descriptionCopyright ?? ""],
      ["ライセンス", completeLocation.licence],
    ]);
    const licenceLink = infoList.querySelector("a");
    expect(licenceLink).toHaveAttribute("href", completeLocation.licenceUri);
    expect(licenceLink).toHaveAttribute("target", "_blank");
    expect(licenceLink).toHaveAttribute("rel", "noopener noreferrer");

    const backLink = getCategoryBackLink();
    expect(backLink).toHaveAttribute(
      "href",
      `/locations/${encodeURIComponent(detailCategory["category:en"])}`,
    );
    expect(backLink.getAttribute("href")).not.toContain("origin=");

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
    expect(
      screen.queryByRole("link", { name: "ウェブサイトを見る" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("画像提供", { selector: "dt" })).not.toBeInTheDocument();
    expect(screen.queryByText("説明文提供", { selector: "dt" })).not.toBeInTheDocument();

    const infoList = getProvidedInfoList();
    expectDefinitionListPairs(infoList, [
      ["座標データ提供", locationWithoutOptionalFields.nodeCopyright],
      ["ライセンス", locationWithoutOptionalFields.licence],
    ]);
    for (const field of Array.from(container.querySelectorAll("dt, dd"))) {
      expect(field.textContent?.trim()).toBeTruthy();
    }
    const licenceLink = infoList.querySelector("a");
    expect(licenceLink).toHaveAttribute(
      "href",
      locationWithoutOptionalFields.licenceUri,
    );
    expect(licenceLink).toHaveAttribute("target", "_blank");
    expect(licenceLink).toHaveAttribute("rel", "noopener noreferrer");

    const externalLinks = Array.from(container.querySelectorAll("a")).filter((anchor) =>
      /^https?:\/\//i.test(anchor.getAttribute("href") ?? ""),
    );
    expect(externalLinks).toHaveLength(1);
    expect(externalLinks[0]).toHaveAccessibleName(locationWithoutOptionalFields.licence);
    expect(externalLinks[0]).toHaveAttribute(
      "href",
      locationWithoutOptionalFields.licenceUri,
    );
    expect(externalLinks[0]).toHaveAttribute("target", "_blank");
    expect(externalLinks[0]).toHaveAttribute("rel", "noopener noreferrer");

    const backLink = getCategoryBackLink();
    expect(backLink).toHaveAttribute(
      "href",
      `/locations/${encodeURIComponent(detailCategory["category:en"])}`,
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

    const backLinks = screen.getAllByRole("link").filter((link) =>
      (link.textContent ?? "").includes("戻る"),
    );
    expect(backLinks).toHaveLength(1);
    expect(backLinks[0]).toHaveAccessibleName("場所一覧に戻る");
    expect(backLinks[0]).toHaveAttribute("href", "/locations");
    expect(backLinks[0].getAttribute("href")).not.toContain("origin=");
    expect(
      screen.queryByRole("link", { name: /公共施設.*戻る/ }),
    ).not.toBeInTheDocument();
  });

  const standardNotFoundCases: ReadonlyArray<
    readonly [string, string, LocationDetailResult<KeyLocation>]
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
    readonly [string, () => KeyLocationsDataResult]
  > = [
    [
      "HTTP failure",
      () => {
        const data: KeyLocationsDataResult = {
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
        const data: KeyLocationsDataResult = {
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
