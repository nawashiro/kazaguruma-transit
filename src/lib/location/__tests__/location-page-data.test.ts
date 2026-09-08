import type {
  LocationArtifact,
  LocationArtifactReadResult,
} from "@/lib/location/location-artifact";

export {};

type PublicFunction = (...args: unknown[]) => unknown;
type PublicModule = Record<string, unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

type ArtifactKeyLocation =
  LocationArtifact["sources"]["keyLocations"][number]["locations"][number];
type ArtifactKeyLocationCategory =
  LocationArtifact["sources"]["keyLocations"][number];

const mockReadLocationArtifact = jest.fn();

jest.mock("@/lib/location/location-artifact", () => {
  const actual = jest.requireActual("@/lib/location/location-artifact");
  return {
    ...actual,
    readLocationArtifact: (...args: unknown[]) =>
      mockReadLocationArtifact(...args),
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

const primaryLocation: ArtifactKeyLocation = {
  id: "kanda-library",
  name: "神田図書館",
  lat: 35.694,
  lng: 139.768,
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const unmatchedLocation: ArtifactKeyLocation = {
  id: "outside-location",
  name: "区域外施設",
  lat: 35.8,
  lng: 139.9,
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const successCategories: ArtifactKeyLocationCategory[] = [
  {
    category: "公共施設",
    "category:en": "public-facilities",
    locations: [primaryLocation],
  },
];

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
        category: "公共施設",
        "category:en": "public-facilities",
        locations: [
          {
            name: "千代田区役所",
            lat: 35.694,
            lng: 139.753,
            copyright: "千代田区",
            licence: "CC BY 4.0",
            licenceUri: "https://creativecommons.org/licenses/by/4.0/",
          },
        ],
      },
    ],
    keyLocations: successCategories,
    townGeoJson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            name: "東京都千代田区神田",
            uri: "https://example.test/areas/kanda",
          },
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
    },
  },
  derivedRegions: {
    "kanda-library": "神田",
  },
};

function artifactResult(
  categories: ArtifactKeyLocationCategory[] = successCategories,
): LocationArtifactReadResult {
  return {
    status: "success",
    artifact: {
      ...validArtifact,
      sources: {
        ...validArtifact.sources,
        keyLocations: categories,
      },
    },
  };
}

describe("location-page-data server boundary", () => {
  const moduleState = loadModule();
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockReadLocationArtifact.mockReset();
    mockReadLocationArtifact.mockReturnValue(artifactResult());
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("preserves non-empty key-location success categories and projects derived regions without mutating sources", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    const expected = {
      status: "success",
      categories: [
        {
          category: "公共施設",
          "category:en": "public-facilities",
          locations: [{ ...primaryLocation, area: "神田" }],
        },
      ],
    };

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
              area: "神田",
            }),
          ],
        },
      ],
    });
    expect(validArtifact.sources.keyLocations[0]?.locations[0]).not.toHaveProperty(
      "area",
    );
    expect(mockReadLocationArtifact).toHaveBeenCalledTimes(1);
    expect(mockReadLocationArtifact).toHaveBeenCalledWith();
  });

  it("preserves an artifact-reader transport error instead of exposing empty page data", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    const upstreamError = new Error("network unavailable");
    mockReadLocationArtifact.mockReturnValue({
      status: "error",
      error: upstreamError,
    } satisfies LocationArtifactReadResult);

    const result = await load();

    expect(result).toEqual({ status: "error", error: upstreamError });
    expect(result).not.toHaveProperty("categories");
    expect(mockReadLocationArtifact).toHaveBeenCalledTimes(1);
  });

  it("rejects a successful empty artifact key-location set at the server page boundary", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    mockReadLocationArtifact.mockReturnValue(artifactResult([]));

    const result = await load();

    expect(result).toEqual(expect.objectContaining({
      status: "error",
      error: expect.any(Error),
    }));
    expect(result).not.toHaveProperty("categories");
  });

  it("rejects duplicate location IDs across the complete artifact dataset instead of selecting one", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    const duplicateCategories: ArtifactKeyLocationCategory[] = [
      successCategories[0],
      {
        category: "別カテゴリ",
        "category:en": "another-category",
        locations: [{ ...primaryLocation, name: "同じIDの別施設" }],
      },
    ];
    mockReadLocationArtifact.mockReturnValue(artifactResult(duplicateCategories));

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
