import type {
  KeyLocation,
  KeyLocationCategory,
  KeyLocationsDataResult,
} from "@/utils/addressLoader";

export {};

type PublicFunction = (...args: unknown[]) => unknown;
type PublicModule = Record<string, unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

const mockLoadKeyLocationsDataResult = jest.fn();

jest.mock("@/utils/addressLoader", () => {
  const actual = jest.requireActual("@/utils/addressLoader");
  return {
    ...actual,
    loadKeyLocationsDataResult: (...args: unknown[]) =>
      mockLoadKeyLocationsDataResult(...args),
  };
});

function loadModule(): ModuleState {
  try {
    // Guarded runtime loading keeps the missing server boundary as a named RED.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded: unknown = require("../location-page-data");
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error("expected the server location-page-data module to export an object"),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

function getPublicFunction(state: ModuleState, publicName: string): PublicFunction {
  const modulePath = "../location-page-data";

  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(`${publicName} is not implemented: public module ${modulePath} exported nothing`);
  }

  const implementation = state.exports[publicName];
  if (typeof implementation !== "function") {
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} does not export ${publicName}`,
    );
  }
  return implementation as PublicFunction;
}

const primaryLocation: KeyLocation = {
  id: "kanda-library",
  name: "神田図書館",
  lat: 35.694,
  lng: 139.768,
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const unmatchedLocation: KeyLocation = {
  id: "outside-location",
  name: "区域外施設",
  lat: 35.8,
  lng: 139.9,
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const successCategories: KeyLocationCategory[] = [
  {
    category: "公共施設",
    "category:en": "public-facilities",
    locations: [primaryLocation],
  },
];

function successData(categories: KeyLocationCategory[] = successCategories): KeyLocationsDataResult {
  return { status: "success", categories };
}

const serverGeoJson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "神田", uri: "https://example.test/areas/kanda" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [139.7, 35.6],
            [139.8, 35.6],
            [139.8, 35.7],
            [139.7, 35.7],
            [139.7, 35.6],
          ],
        ],
      },
    },
  ],
};

describe("location-page-data server boundary", () => {
  const moduleState = loadModule();
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockLoadKeyLocationsDataResult.mockReset();
    mockLoadKeyLocationsDataResult.mockResolvedValue(successData());
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("preserves non-empty key-location success categories and primary fields", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    const expected = successData();
    mockLoadKeyLocationsDataResult.mockResolvedValue(expected);

    const result = await load();

    expect(result).toEqual(expected);
    expect(result).toMatchObject({
      status: "success",
      categories: [
        {
          category: "公共施設",
          "category:en": "public-facilities",
          locations: [
            expect.objectContaining({
              id: "kanda-library",
              name: "神田図書館",
              lat: 35.694,
              lng: 139.768,
              nodeCopyright: "千代田区",
              licence: "CC BY 4.0",
              licenceUri: "https://creativecommons.org/licenses/by/4.0/",
            }),
          ],
        },
      ],
    });
  });

  it("preserves an upstream key-location transport error instead of exposing empty page data", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    const upstreamError = new Error("network unavailable");
    mockLoadKeyLocationsDataResult.mockResolvedValue({
      status: "error",
      error: upstreamError,
    });

    const result = await load();

    expect(result).toEqual({ status: "error", error: upstreamError });
    expect(result).not.toHaveProperty("categories");
  });

  it("rejects a successful empty category set at the server page boundary", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    mockLoadKeyLocationsDataResult.mockResolvedValue(successData([]));

    const result = await load();

    expect(result).toEqual(expect.objectContaining({
      status: "error",
      error: expect.any(Error),
    }));
    expect(result).not.toHaveProperty("categories");
  });

  it("rejects duplicate location IDs across the complete dataset instead of selecting one", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    const duplicateCategories: KeyLocationCategory[] = [
      successCategories[0],
      {
        category: "別カテゴリ",
        "category:en": "another-category",
        locations: [{ ...primaryLocation, name: "同じIDの別施設" }],
      },
    ];
    mockLoadKeyLocationsDataResult.mockResolvedValue(successData(duplicateCategories));

    const result = await load();

    expect(result).toEqual(expect.objectContaining({
      status: "error",
      error: expect.any(Error),
    }));
    expect(result).not.toHaveProperty("categories");
  });

  it("groups locations with server-provided GeoJSON and places unmatched points in その他", () => {
    const groupLocationsByArea = getPublicFunction(moduleState, "groupLocationsByArea");
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const grouped = groupLocationsByArea(
      [primaryLocation, unmatchedLocation],
      serverGeoJson,
    );

    expect(grouped).toEqual({
      神田: [primaryLocation],
      その他: [unmatchedLocation],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
