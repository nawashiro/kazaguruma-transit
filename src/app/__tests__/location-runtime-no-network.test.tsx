import React, { type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type {
  LocationArtifact,
  LocationArtifactReadResult,
} from "@/lib/location/location-artifact";

export {};

type PublicModule = Record<string, unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

type HomePage = () => ReactNode | Promise<ReactNode>;

type CategoryPageProps = {
  params: Promise<{ "category-id": string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type CategoryPage = (
  props: CategoryPageProps,
) => ReactNode | Promise<ReactNode>;

type DetailPageProps = {
  params: Promise<{ id: string }>;
};

type DetailPage = (props: DetailPageProps) => ReactNode | Promise<ReactNode>;
type GenerateMetadata = (props: DetailPageProps) => unknown | Promise<unknown>;

type MockHomeRouteFormProps = {
  popularCategories: unknown;
};

const NEXT_NOT_FOUND = Symbol("NEXT_NOT_FOUND");
const mockNotFound = jest.fn(() => {
  throw NEXT_NOT_FOUND;
});
const mockPathname = jest.fn(() => "/locations/natural%20environment%20park");
const mockSearchParams = jest.fn(() => new URLSearchParams());
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockReadLocationArtifact = jest.fn();
const mockLegacyMainFacilitiesLoader = jest.fn();
const mockLegacyKeyLocationsLoader = jest.fn();
const mockLegacyMainFacilitiesAlias = jest.fn();
const mockLegacyKeyLocationsAlias = jest.fn();
const mockGeoJsonProvider = jest.fn();
const mockHomeRouteFormProps = jest.fn();

jest.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  usePathname: () => mockPathname(),
  useSearchParams: () => mockSearchParams(),
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
}));

jest.mock("next/link", () => {
  type LinkProps = React.PropsWithChildren<
    React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
  >;

  const MockLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
    ({ href, children, ...props }, ref) =>
      React.createElement("a", { ...props, href, ref }, children),
  );
  MockLink.displayName = "MockLink";

  return {
    __esModule: true,
    default: MockLink,
  };
});

jest.mock("@/lib/location/location-artifact", () => ({
  __esModule: true,
  readLocationArtifact: (...args: unknown[]) =>
    mockReadLocationArtifact(...args),
}));

jest.mock("@/utils/addressLoader", () => {
  const actual = jest.requireActual("@/utils/addressLoader");
  return {
    ...actual,
    loadAddressDataResult: (...args: unknown[]) =>
      mockLegacyMainFacilitiesLoader(...args),
    loadKeyLocationsDataResult: (...args: unknown[]) =>
      mockLegacyKeyLocationsLoader(...args),
    // Keep the older names guarded as well; an accidental reintroduction of
    // either loader must fail this public runtime contract instead of reaching
    // a network.
    loadAddressData: (...args: unknown[]) =>
      mockLegacyMainFacilitiesAlias(...args),
    loadKeyLocationsData: (...args: unknown[]) =>
      mockLegacyKeyLocationsAlias(...args),
  };
});

jest.mock("@/utils/geoUtils", () => {
  const actual = jest.requireActual("@/utils/geoUtils");
  return {
    ...actual,
    loadGeoJSON: (...args: unknown[]) => mockGeoJsonProvider(...args),
  };
});

jest.mock("@/components/features/HomeRouteForm", () => ({
  __esModule: true,
  default: (props: MockHomeRouteFormProps) => {
    mockHomeRouteFormProps(props);
    return React.createElement(
      "div",
      { "data-testid": "artifact-backed-home-route-form" },
      "popular facilities",
    );
  },
}));

const validArtifact: LocationArtifact = {
  status: "validated",
  sourceUris: {
    mainFacilitiesUri: "https://fixtures.example.test/v2/main_facilities.json",
    keyLocationsUri: "https://fixtures.example.test/v2/key_locations.json",
    townGeoJsonUri: "https://fixtures.example.test/v2/chiyoda-towns.geojson",
  },
  sources: {
    mainFacilities: [
      {
        category: "区役所・出張所",
        "category:en": "city-office-and-branch-offices",
        locations: [
          {
            name: "千代田区役所",
            lat: 35.694,
            lng: 139.753,
            copyright: "© OpenStreetMap contributors",
            licence: "Open Database License (ODbL) 1.0",
            licenceUri: "https://opendatacommons.org/licenses/odbl/",
          },
        ],
      },
    ],
    keyLocations: [
      {
        category: "自然環境公園",
        "category:en": "natural environment park",
        locations: [
          {
            id: "park-far-日本",
            name: "皇居外苑入口",
            lat: 35.704,
            lng: 139.778,
            description: "自然環境公園の入口です",
            uri: "https://fixtures.example.test/park-far",
            nodeCopyright: "千代田区",
            licence: "CC BY 4.0",
            licenceUri: "https://creativecommons.org/licenses/by/4.0/",
          },
          {
            id: "park-near",
            name: "日比谷公園入口",
            lat: 35.681,
            lng: 139.761,
            description: "近い自然環境公園です",
            uri: "https://fixtures.example.test/park-near",
            nodeCopyright: "千代田区",
            licence: "CC BY 4.0",
            licenceUri: "https://creativecommons.org/licenses/by/4.0/",
          },
        ],
      },
    ],
    townGeoJson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            name: "東京都千代田区日比谷公園周辺",
            uri: "https://fixtures.example.test/towns/hibiya",
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [139.7, 35.6],
                [139.8, 35.6],
                [139.8, 35.8],
                [139.7, 35.8],
                [139.7, 35.6],
              ],
            ],
          },
        },
      ],
    },
  },
  // The key-location fixture intentionally omits `area`; runtime pages must
  // consume this build-time projection rather than call the GeoJSON provider.
  derivedRegions: {
    "park-far-日本": "皇居外苑",
    "park-near": "日比谷公園周辺",
  },
};

const successfulArtifactResult: LocationArtifactReadResult = {
  status: "success",
  artifact: validArtifact,
};

const HOME_PAGE_MODULE_PATH = "../page";
const CATEGORY_PAGE_MODULE_PATH = "../locations/[category-id]/page";
const DETAIL_PAGE_MODULE_PATH = "../locations/location-detail/[id]/page";

function loadPublicModule(modulePath: string): ModuleState {
  try {
    // Keep RED failures tied to the public route boundary rather than turning
    // an absent planned module into a Jest collection error.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public route loader
    const loaded: unknown = require(modulePath);
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error(`${modulePath} must export an object`),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

function publicModuleError(
  modulePath: string,
  state: ModuleState,
): Error | null {
  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    return new Error(
      `${modulePath} public runtime boundary could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    return new Error(`${modulePath} public runtime boundary exported nothing`);
  }
  return null;
}

function getPublicExport<T>(
  modulePath: string,
  state: ModuleState,
  exportName: string,
): T {
  const moduleError = publicModuleError(modulePath, state);
  if (moduleError) {
    throw moduleError;
  }

  const implementation = state.exports?.[exportName];
  if (typeof implementation !== "function") {
    throw new Error(
      `${modulePath} public runtime boundary does not export function ${exportName}`,
    );
  }
  return implementation as T;
}

function resetRuntimeSourceGuards(): void {
  mockReadLocationArtifact.mockReset().mockReturnValue(successfulArtifactResult);
  mockLegacyMainFacilitiesLoader
    .mockReset()
    .mockRejectedValue(new Error("legacy main-facilities loader was called"));
  mockLegacyKeyLocationsLoader
    .mockReset()
    .mockRejectedValue(new Error("legacy key-locations loader was called"));
  mockLegacyMainFacilitiesAlias
    .mockReset()
    .mockRejectedValue(new Error("legacy main-facilities alias was called"));
  mockLegacyKeyLocationsAlias
    .mockReset()
    .mockRejectedValue(new Error("legacy key-locations alias was called"));
  mockGeoJsonProvider
    .mockReset()
    .mockRejectedValue(new Error("GeoJSON provider/fallback was called"));
  mockHomeRouteFormProps.mockReset();
  mockNotFound.mockClear();
  mockRouterPush.mockReset();
  mockRouterReplace.mockReset();
  mockPathname.mockReset().mockReturnValue("/locations/natural%20environment%20park");
  mockSearchParams.mockReset().mockReturnValue(new URLSearchParams());
}

function expectArtifactOnlyRuntimeSources(): void {
  expect(mockLegacyMainFacilitiesLoader).not.toHaveBeenCalled();
  expect(mockLegacyKeyLocationsLoader).not.toHaveBeenCalled();
  expect(mockLegacyMainFacilitiesAlias).not.toHaveBeenCalled();
  expect(mockLegacyKeyLocationsAlias).not.toHaveBeenCalled();
  expect(mockGeoJsonProvider).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(mockReadLocationArtifact).toHaveBeenCalled();
  expect(mockReadLocationArtifact).toHaveBeenCalledWith();
}

function expectRouteModuleAvailable(
  modulePath: string,
  state: ModuleState,
): void {
  const moduleError = publicModuleError(modulePath, state);
  expect(moduleError).toBeNull();
}

const homePageModule = loadPublicModule(HOME_PAGE_MODULE_PATH);
const categoryPageModule = loadPublicModule(CATEGORY_PAGE_MODULE_PATH);
const detailPageModule = loadPublicModule(DETAIL_PAGE_MODULE_PATH);

beforeEach(() => {
  jest.clearAllMocks();
  resetRuntimeSourceGuards();
  jest.spyOn(global, "fetch").mockImplementation(() => {
    throw new Error("external runtime fetch was called");
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("home runtime artifact-only boundary", () => {
  if (publicModuleError(HOME_PAGE_MODULE_PATH, homePageModule)) {
    it("reports an actionable public home boundary failure", () => {
      expectRouteModuleAvailable(HOME_PAGE_MODULE_PATH, homePageModule);
    });
  } else {
    it("passes main facilities from the artifact to the existing home props boundary without network sources", async () => {
      const page = getPublicExport<HomePage>(
        HOME_PAGE_MODULE_PATH,
        homePageModule,
        "default",
      );

      const element = await page();
      expect(React.isValidElement(element)).toBe(true);
      if (!React.isValidElement(element)) {
        return;
      }

      expectArtifactOnlyRuntimeSources();

      render(React.createElement("main", null, element));

      expect(screen.getByTestId("artifact-backed-home-route-form")).toBeInTheDocument();
      expect(mockHomeRouteFormProps).toHaveBeenCalledTimes(1);
      expect(mockHomeRouteFormProps).toHaveBeenCalledWith({
        popularCategories: validArtifact.sources.mainFacilities,
      });
      expectArtifactOnlyRuntimeSources();
    });
  }
});

describe("category runtime artifact-only boundary", () => {
  if (publicModuleError(CATEGORY_PAGE_MODULE_PATH, categoryPageModule)) {
    it("reports an actionable public category boundary failure", () => {
      expectRouteModuleAvailable(CATEGORY_PAGE_MODULE_PATH, categoryPageModule);
    });
  } else {
    it("renders derived areas and valid origin distance ordering from the artifact without external sources", async () => {
      const page = getPublicExport<CategoryPage>(
        CATEGORY_PAGE_MODULE_PATH,
        categoryPageModule,
        "default",
      );
      const categoryId = "natural environment park";
      const origin = "35.680000,139.760000";
      mockPathname.mockReturnValue(
        `/locations/${encodeURIComponent(categoryId)}`,
      );
      mockSearchParams.mockReturnValue(new URLSearchParams(`origin=${origin}`));

      const element = await page({
        params: Promise.resolve({
          "category-id": encodeURIComponent(categoryId),
        }),
        searchParams: Promise.resolve({ origin }),
      });
      expect(React.isValidElement(element)).toBe(true);
      if (!React.isValidElement(element)) {
        return;
      }

      expectArtifactOnlyRuntimeSources();

      render(React.createElement("main", null, element));

      expect(screen.getByRole("heading", { level: 1, name: "場所をさがす" })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(/距離|近い順/);
      expect(screen.getByText("日比谷公園周辺")).toBeInTheDocument();
      expect(screen.getByText("皇居外苑")).toBeInTheDocument();

      const detailLinks = screen.getAllByRole("link").filter((link) =>
        link.getAttribute("href")?.startsWith("/locations/location-detail/"),
      );
      expect(detailLinks.map((link) => link.textContent)).toEqual([
        expect.stringContaining("日比谷公園入口"),
        expect.stringContaining("皇居外苑入口"),
      ]);
      expect(mockNotFound).not.toHaveBeenCalled();
      expectArtifactOnlyRuntimeSources();
    });
  }
});

describe("detail runtime artifact-only boundary", () => {
  if (publicModuleError(DETAIL_PAGE_MODULE_PATH, detailPageModule)) {
    it("reports an actionable public detail boundary failure", () => {
      expectRouteModuleAvailable(DETAIL_PAGE_MODULE_PATH, detailPageModule);
    });
  } else {
    it("renders a detail page with its derived area and destination link from the artifact without external sources", async () => {
      const page = getPublicExport<DetailPage>(
        DETAIL_PAGE_MODULE_PATH,
        detailPageModule,
        "default",
      );
      const location = validArtifact.sources.keyLocations[0]?.locations[1];
      if (!location || typeof location.name !== "string") {
        throw new Error("detail artifact fixture is missing its target location");
      }
      const locationName = location.name;

      const element = await page({
        params: Promise.resolve({ id: location.id }),
      });
      expect(React.isValidElement(element)).toBe(true);
      if (!React.isValidElement(element)) {
        return;
      }

      expectArtifactOnlyRuntimeSources();

      render(React.createElement("main", null, element));

      expect(
        screen.getByRole("heading", { level: 1, name: locationName }),
      ).toBeInTheDocument();
      expect(screen.getByText("日比谷公園周辺")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "ここへ行く" })).toHaveAttribute(
        "href",
        `/?destination=${encodeURIComponent(
          JSON.stringify({
            lat: location.lat,
            lng: location.lng,
            address: locationName,
          }),
        )}`,
      );
      expectArtifactOnlyRuntimeSources();
    });

    it("uses the artifact-backed location name for detail metadata without external sources", async () => {
      const generateMetadata = getPublicExport<GenerateMetadata>(
        DETAIL_PAGE_MODULE_PATH,
        detailPageModule,
        "generateMetadata",
      );
      const location = validArtifact.sources.keyLocations[0]?.locations[1];
      if (!location || typeof location.name !== "string") {
        throw new Error("detail artifact fixture is missing its target location");
      }
      const locationName = location.name;

      const metadata = (await generateMetadata({
        params: Promise.resolve({ id: location.id }),
      })) as { title?: string };

      expectArtifactOnlyRuntimeSources();
      expect(metadata.title).toBe(`${locationName} - 場所詳細`);
      expect(metadata.title).not.toContain(location.id);
    });
  }
});
