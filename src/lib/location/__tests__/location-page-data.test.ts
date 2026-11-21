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

type ArtifactLocation =
  LocationArtifact["sources"]["locations"][number]["locations"][number];
type ArtifactLocationCategory =
  LocationArtifact["sources"]["locations"][number];

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

const primaryLocation: ArtifactLocation = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000001",
  name: "千代田区役所",
  lat: 35.694,
  lng: 139.753,
  relatedPages: [],
  osmElement: { type: "node", id: 1 },
  wheelchair: "yes",
  osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
};

const unmatchedLocation: ArtifactLocation = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000002",
  name: "区域外施設",
  lat: 35.8,
  lng: 139.9,
  relatedPages: [],
  osmElement: { type: "node", id: 2 },
  wheelchair: null,
  osmEditUrl: "https://www.openstreetmap.org/edit?node=2",
};

const successCategories: ArtifactLocationCategory[] = [
  {
    category: "市役所・東京都の区役所",
    categoryId: "1302",
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
    datasetJsonLdUri: "https://fixtures.example.test/dataset.jsonld",
    osmMirrorUri: "https://fixtures.example.test/mirrors/osm.json",
    townGeoJsonUri: "https://fixtures.example.test/chiyoda-towns.geojson",
  },
  sources: {
    routeDestinations: [
      {
        category: "行政・相談",
        categoryId: "1302",
        locations: [
          {
            name: "千代田区役所",
            lat: 35.694,
            lng: 139.753,
          },
        ],
      },
    ],
    locations: successCategories,
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
    "urn:uuid:00000000-0000-4000-8000-000000000001": "神田",
  },
};

function artifactResult(
  categories: ArtifactLocationCategory[] = successCategories,
): LocationArtifactReadResult {
  return {
    status: "success",
    artifact: {
      ...validArtifact,
      sources: {
        ...validArtifact.sources,
        locations: categories,
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

  it("preserves non-empty locations success categories and projects derived regions without mutating sources", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    const expected = {
      status: "success",
      categories: [
        {
          category: "市役所・東京都の区役所",
          categoryId: "1302",
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
          category: "市役所・東京都の区役所",
          categoryId: "1302",
          locations: [
            expect.objectContaining({
              id: "urn:uuid:00000000-0000-4000-8000-000000000001",
              name: "千代田区役所",
              lat: 35.694,
              lng: 139.753,
              area: "神田",
            }),
          ],
        },
      ],
    });
    expect(validArtifact.sources.locations[0]?.locations[0]).not.toHaveProperty(
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

  it("rejects a successful empty artifact locations set at the server page boundary", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    mockReadLocationArtifact.mockReturnValue(artifactResult([]));

    const result = await load();

    expect(result).toEqual(expect.objectContaining({
      status: "error",
      error: expect.any(Error),
    }));
    expect(result).not.toHaveProperty("categories");
  });

  it("keeps the same location in multiple categories for the detail resolver", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    const duplicateCategories: ArtifactLocationCategory[] = [
      successCategories[0],
      {
        category: "別カテゴリ",
        categoryId: "1512",
        locations: [{ ...primaryLocation }],
      },
    ];
    mockReadLocationArtifact.mockReturnValue(artifactResult(duplicateCategories));

    const result = (await load()) as {
      status: string;
      categories?: Array<{
        categoryId: string;
        locations: Array<{ id: string }>;
      }>;
    };

    expect(result.status).toBe("success");
    const categories = result.categories ?? [];
    expect(categories.map((category) => category.categoryId)).toEqual([
      "1302",
      "1512",
    ]);
    expect(
      categories
        .flatMap((category) => category.locations)
        .filter((location) => location.id === primaryLocation.id),
    ).toHaveLength(2);
  });

  it("passes facts through to detail and leaves missing facts as undefined", async () => {
    const load = getPublicFunction(moduleState, "loadLocationPageData");
    const withFacts = {
      ...primaryLocation,
      phone: { display: "03-3264-2111", tel: "tel:0332642111" },
      websiteUri: "https://www.city.chiyoda.lg.jp/",
      wikipediaUri: "https://ja.wikipedia.org/wiki/%E5%8D%83%E4%BB%A3%E7%94%B0",
      osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
    };
    const withoutFacts = {
      ...unmatchedLocation,
      osmEditUrl: "https://www.openstreetmap.org/edit?node=2",
    };
    mockReadLocationArtifact.mockReturnValue({
      status: "success",
      artifact: {
        ...validArtifact,
        sources: {
          ...validArtifact.sources,
          locations: [
            { category: "市役所・東京都の区役所", categoryId: "1302", locations: [withFacts] },
            { category: "図書館", categoryId: "1512", locations: [withoutFacts] },
          ],
        },
        derivedRegions: {
          [withFacts.id]: "神田",
          [withoutFacts.id]: "その他",
        },
      },
    });

    const result = (await load()) as any;
    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error("expected success");
    }
    const factLoc = (result.categories as any[]).flatMap((c: any) => c.locations).find((l: any) => l.id === withFacts.id);
    expect(factLoc).toMatchObject({
      phone: { display: "03-3264-2111", tel: "tel:0332642111" },
      websiteUri: "https://www.city.chiyoda.lg.jp/",
      osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
    });
    const missingLoc = (result.categories as any[]).flatMap((c: any) => c.locations).find((l: any) => l.id === withoutFacts.id);
    expect(missingLoc?.phone).toBeUndefined();
    expect(missingLoc?.websiteUri).toBeUndefined();
    expect(missingLoc?.wikipediaUri).toBeUndefined();
    expect(missingLoc?.osmEditUrl).toBe("https://www.openstreetmap.org/edit?node=2");
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
