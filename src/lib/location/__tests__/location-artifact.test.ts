/** @jest-environment node */

import fs from "node:fs";
import path from "node:path";
import { resolveLocationDetail } from "../location-detail-resolver";

export {};

jest.mock("@/utils/geoUtils", () => {
  const actual = jest.requireActual("@/utils/geoUtils");
  return {
    ...actual,
    loadGeoJSON: jest.fn(),
  };
});

type PublicFunction = (...args: unknown[]) => unknown;
type PublicModule = Record<string, unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

type SourceUris = {
  datasetJsonLdUri: string;
  osmMirrorUri: string;
  townGeoJsonUri: string;
};

type ReaderErrorResult = {
  status: "error";
  error: Error;
};

type ArtifactReadFixture =
  | { raw: string }
  | { error: Error };

const READER_MODULE_PATH = "../location-artifact";
const GENERATED_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  "public",
  "generated",
  "location-data.json",
);
const originalReadFileSync = fs.readFileSync.bind(fs);
const originalReadFile = fs.promises.readFile.bind(fs.promises);

const sourceUris: SourceUris = {
  datasetJsonLdUri: "https://fixtures.example.test/dataset.jsonld",
  osmMirrorUri: "https://fixtures.example.test/mirrors/osm.json",
  townGeoJsonUri: "https://fixtures.example.test/chiyoda-towns.geojson",
};

const routeDestinations = [
  {
    category: "行政・相談",
    categoryId: "1302",
    locations: [
      {
        name: "千代田区役所",
        lat: 35.694,
        lng: 139.753,
        walkMeters: 21,
      },
    ],
  },
];

const townGeoJson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "東京都千代田区神田和泉町",
        uri: "https://fixtures.example.test/towns/kanda-izumicho",
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
};

const validLocationsFixture = [
  {
    category: "市役所・東京都の区役所",
    categoryId: "1302",
    locations: [
      {
        id: "urn:uuid:00000000-0000-4000-8000-000000000001",
        name: "千代田区役所",
        lat: 35.694,
        lng: 139.753,
        imageUri: "https://fixtures.example.test/images/city.jpg",
        imageCreator: "さくら",
        imageLicense: "https://creativecommons.org/licenses/by-sa/3.0/",
        relatedPages: [
          { name: "東京バリアフリーマップ", url: "https://fixtures.example.test/bfm/city" },
        ],
        osmElement: { type: "node", id: 1 },
        wheelchair: "yes",
        osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
      },
    ],
  },
];

const validArtifact = {
  status: "validated",
  sourceUris,
  sources: {
    // routeDestinations is the home "よく利用される施設" data.
    routeDestinations,
    locations: validLocationsFixture,
    // townGeoJson is the build-time source used to derive display regions.
    townGeoJson,
  },
  // The source location deliberately has no `area` field. The display value is
  // derived from GeoJSON and normalized only in this artifact projection.
  derivedRegions: {
    "urn:uuid:00000000-0000-4000-8000-000000000001": "神田和泉町",
  },
};

function loadModule(): ModuleState {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded RED public-boundary load
    const loaded: unknown = require(READER_MODULE_PATH);
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error("location-artifact public module must export an object"),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    // Keep synchronous module-load failures inside the explicit public-boundary
    // state so they do not masquerade as a fixture or assertion failure.
    return { exports: null, error };
  }
}

function getPublicFunction(
  state: ModuleState,
  publicName: string,
): PublicFunction {
  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `${publicName} public contract is unavailable: ${READER_MODULE_PATH} failed to load synchronously (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(
      `${publicName} public contract is unavailable: ${READER_MODULE_PATH} exported nothing`,
    );
  }

  const implementation = state.exports[publicName];
  if (typeof implementation !== "function") {
    throw new Error(
      `${publicName} public contract is unavailable: ${READER_MODULE_PATH} does not export ${publicName}`,
    );
  }
  return implementation as PublicFunction;
}

function assertPublicReaderAvailable(state: ModuleState): void {
  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `readLocationArtifact RED contract requires ${READER_MODULE_PATH} to export readLocationArtifact; synchronous load failed (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(
      `readLocationArtifact RED contract requires ${READER_MODULE_PATH} to export an object`,
    );
  }
  if (typeof state.exports.readLocationArtifact !== "function") {
    throw new Error(
      `readLocationArtifact RED contract requires ${READER_MODULE_PATH} to export readLocationArtifact`,
    );
  }
}

function invokeReader(moduleState: ModuleState): Promise<unknown> {
  const readLocationArtifact = getPublicFunction(
    moduleState,
    "readLocationArtifact",
  );
  // No injected reader, path, transport, or source URI is accepted here. The
  // public function must read public/generated/location-data.json itself.
  return Promise.resolve(readLocationArtifact());
}

function artifactWith(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return { ...validArtifact, ...overrides };
}

function isGeneratedArtifactPath(filePath: fs.PathLike): boolean {
  return path.resolve(String(filePath)) === GENERATED_ARTIFACT_PATH;
}

function readFixtureText(fixture: ArtifactReadFixture): string {
  if ("error" in fixture) {
    throw fixture.error;
  }
  return fixture.raw;
}

function readFixtureTextAsync(fixture: ArtifactReadFixture): Promise<string> {
  try {
    return Promise.resolve(readFixtureText(fixture));
  } catch (error) {
    return Promise.reject(error);
  }
}

function expectArtifactReadAttempt(
  readFileSyncSpy: jest.SpyInstance,
  readFileSpy: jest.SpyInstance,
): void {
  const syncRead = readFileSyncSpy.mock.calls.some(([filePath]) =>
    isGeneratedArtifactPath(filePath as fs.PathLike),
  );
  const asyncRead = readFileSpy.mock.calls.some(([filePath]) =>
    isGeneratedArtifactPath(filePath as fs.PathLike),
  );

  expect(syncRead || asyncRead).toBe(true);
}

function expectReaderError(
  result: unknown,
  readFileSyncSpy: jest.SpyInstance,
  readFileSpy: jest.SpyInstance,
): void {
  expect(result).toEqual({
    status: "error",
    error: expect.any(Error),
  });
  expect(result).not.toHaveProperty("artifact");
  expectArtifactReadAttempt(readFileSyncSpy, readFileSpy);

  const error = (result as ReaderErrorResult).error;
  expect(error).toBeInstanceOf(Error);

  // The existing resolver turns this stable Error contract into
  // `data-load-error`, which is the route boundary that renders Japanese data
  // error copy rather than a 404 or an empty success state.
  const downstreamState = resolveLocationDetail("urn:uuid:00000000-0000-4000-8000-000000000001", {
    status: "error",
    error,
  });
  expect(downstreamState).toEqual({
    status: "data-load-error",
    error,
  });
}

const moduleState = loadModule();
let artifactReadFixture: ArtifactReadFixture = {
  raw: JSON.stringify(validArtifact),
};

const originalFetch = global.fetch;

describe("readLocationArtifact runtime artifact boundary", () => {
  let readFileSyncSpy: jest.SpyInstance;
  let readFileSpy: jest.SpyInstance;
  let geoJsonProviderSpy: jest.SpyInstance;

  const hasPublicReader =
    moduleState.error === null &&
    moduleState.exports !== null &&
    typeof moduleState.exports.readLocationArtifact === "function";

  if (!hasPublicReader) {
    it("reports an actionable RED failure when the public reader is unavailable", () => {
      assertPublicReaderAvailable(moduleState);
    });
    return;
  }

  beforeEach(() => {
    artifactReadFixture = { raw: JSON.stringify(validArtifact) };
    global.fetch = jest.fn() as unknown as typeof fetch;

    readFileSyncSpy = jest.spyOn(fs, "readFileSync");
    readFileSyncSpy.mockImplementation(
      ((filePath: fs.PathLike) => {
        if (isGeneratedArtifactPath(filePath)) {
          return readFixtureText(artifactReadFixture);
        }
        return originalReadFileSync(filePath, "utf8");
      }) as typeof fs.readFileSync,
    );

    readFileSpy = jest.spyOn(fs.promises, "readFile");
    readFileSpy.mockImplementation(
      ((filePath: fs.PathLike) => {
        if (isGeneratedArtifactPath(filePath)) {
          return readFixtureTextAsync(artifactReadFixture);
        }
        return originalReadFile(filePath, "utf8");
      }) as typeof fs.promises.readFile,
    );

    // This is a forbidden runtime source. Make an accidental call fail
    // immediately and retain a direct interaction assertion below.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- access the mocked forbidden-source boundary
    const geoJsonSources = require("@/utils/geoUtils") as {
      loadGeoJSON: jest.MockedFunction<() => Promise<unknown>>;
    };

    geoJsonProviderSpy = geoJsonSources.loadGeoJSON;
    geoJsonProviderSpy.mockReset().mockRejectedValue(
      new Error("GeoJSON provider was called"),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it("loads the real public reader module and names its synchronous boundary explicitly", () => {
    expect(moduleState.exports).not.toBeNull();
    expect(typeof moduleState.exports?.readLocationArtifact).toBe("function");
  });

  it("reads public/generated/location-data.json and preserves the complete home/category/detail artifact shape", async () => {
    const result = await invokeReader(moduleState);

    expect(result).toEqual({
      status: "success",
      artifact: expect.objectContaining({
        status: "validated",
        sourceUris,
        sources: expect.objectContaining({
          routeDestinations,
          townGeoJson,
        }),
        derivedRegions: {
          "urn:uuid:00000000-0000-4000-8000-000000000001": "神田和泉町",
        },
      }),
    });
    expectArtifactReadAttempt(readFileSyncSpy, readFileSpy);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(geoJsonProviderSpy).not.toHaveBeenCalled();

    const artifact = (result as { status: "success"; artifact: typeof validArtifact }).artifact;
    expect(artifact.sources.routeDestinations).toEqual(routeDestinations);
    expect(artifact.sources.townGeoJson).toEqual(townGeoJson);
    expect(artifact.sources.locations[0].locations[0]).not.toHaveProperty("area");
    expect(artifact.derivedRegions["urn:uuid:00000000-0000-4000-8000-000000000001"]).toBe("神田和泉町");
    expect(artifact.derivedRegions["urn:uuid:00000000-0000-4000-8000-000000000001"]).not.toContain("東京都千代田区");
  });

  it("keeps derived regions limited to the IDs listed in sources.locations", async () => {
    const listedId = validLocationsFixture[0].locations[0].id;
    const outOfCatalogId = "urn:uuid:00000000-0000-4000-8000-000000000099";
    artifactReadFixture = {
      raw: JSON.stringify(
        artifactWith({
          derivedRegions: {
            [listedId]: "神田和泉町",
            [outOfCatalogId]: "目録外の地域",
          },
        }),
      ),
    };

    const result = await invokeReader(moduleState);

    expect(result).toEqual({
      status: "success",
      artifact: expect.objectContaining({
        sources: expect.objectContaining({ locations: validLocationsFixture }),
      }),
    });
    expectArtifactReadAttempt(readFileSyncSpy, readFileSpy);

    const artifact = (result as { status: "success"; artifact: typeof validArtifact }).artifact;
    const listedIds = artifact.sources.locations
      .flatMap((category) => category.locations.map((location) => location.id))
      .sort();
    expect(Object.keys(artifact.derivedRegions).sort()).toEqual(listedIds);
    expect(artifact.derivedRegions).not.toHaveProperty(outOfCatalogId);
  });

  it("reads an artifact with explicit null optional metadata and preserves every null value", async () => {
    const artifactWithNullOptionals = artifactWith({
      sources: {
        ...validArtifact.sources,
        townGeoJson: {
          ...townGeoJson,
          features: [{
            ...townGeoJson.features[0],
            properties: {
              ...townGeoJson.features[0].properties,
              uri: null,
            },
          }],
        },
      },
    });
    artifactReadFixture = { raw: JSON.stringify(artifactWithNullOptionals) };

    const result = await invokeReader(moduleState);

    expect(result).toEqual({
      status: "success",
      artifact: artifactWithNullOptionals,
    });
    expectArtifactReadAttempt(readFileSyncSpy, readFileSpy);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(geoJsonProviderSpy).not.toHaveBeenCalled();
  });

  it.each([
    [
      "missing generated artifact",
      {
        error: Object.assign(
          new Error("public/generated/location-data.json is missing"),
          { code: "ENOENT" },
        ),
      },
    ],
    ["malformed generated JSON", { raw: "{not-json" }],
  ] as const)(
    "converts %s into the Error contract for Japanese data-error state without an external fallback",
    async (_label, fixture) => {
      artifactReadFixture = fixture;

      const result = await invokeReader(moduleState);

      expectReaderError(result, readFileSyncSpy, readFileSpy);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(geoJsonProviderSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["invalid artifact status", artifactWith({ status: "invalid" })],
    ["missing source URIs", artifactWith({ sourceUris: undefined })],
    ["malformed source URI", artifactWith({
      sourceUris: { ...sourceUris, townGeoJsonUri: "not-an-absolute-uri" },
    })],
    ["missing route destinations", artifactWith({
      sources: { ...validArtifact.sources, routeDestinations: undefined },
    })],
    ["empty route destination categories", artifactWith({
      sources: { ...validArtifact.sources, routeDestinations: [] },
    })],
    ["invalid route destination location", artifactWith({
      sources: {
        ...validArtifact.sources,
        routeDestinations: [{
          ...routeDestinations[0],
          locations: [{ ...routeDestinations[0].locations[0], name: "" }],
        }],
      },
    })],
    ["missing route destination walk distance", artifactWith({
      sources: {
        ...validArtifact.sources,
        routeDestinations: [{
          ...routeDestinations[0],
          locations: [{ name: "千代田区役所", lat: 35.694, lng: 139.753 }],
        }],
      },
    })],
    ["negative route destination walk distance", artifactWith({
      sources: {
        ...validArtifact.sources,
        routeDestinations: [{
          ...routeDestinations[0],
          locations: [{ ...routeDestinations[0].locations[0], walkMeters: -1 }],
        }],
      },
    })],
    ["missing route destination category ID", artifactWith({
      sources: {
        ...validArtifact.sources,
        routeDestinations: [{
          category: routeDestinations[0].category,
          locations: routeDestinations[0].locations,
        }],
      },
    })],
    ["missing locations", artifactWith({
      sources: { routeDestinations: validArtifact.sources.routeDestinations, townGeoJson: validArtifact.sources.townGeoJson },
    })],
    ["empty locations", artifactWith({
      sources: { ...validArtifact.sources, locations: [] },
    })],
    ["missing town GeoJSON", artifactWith({
      sources: { ...validArtifact.sources, townGeoJson: undefined },
    })],
    ["malformed derived regions", artifactWith({ derivedRegions: [] })],
    ["missing derived region for a detail location", artifactWith({ derivedRegions: {} })],
    ["invalid required detail data", artifactWith({
      sources: {
        ...validArtifact.sources,
        locations: [{
          ...validLocationsFixture[0],
          locations: [{ ...validLocationsFixture[0].locations[0], id: "" }],
        }],
      },
    })],
    ["invalid GeoJSON shape", artifactWith({
      sources: {
        ...validArtifact.sources,
        townGeoJson: { ...townGeoJson, features: [] },
      },
    })],
    ["invalid optional GeoJSON property", artifactWith({
      sources: {
        ...validArtifact.sources,
        townGeoJson: {
          ...townGeoJson,
          features: [{
            ...townGeoJson.features[0],
            properties: { ...townGeoJson.features[0].properties, uri: 42 },
          }],
        },
      },
    })],
  ] as const)(
    "rejects %s as a data error and never reads a fallback source",
    async (_label, artifact) => {
      artifactReadFixture = { raw: JSON.stringify(artifact) };

      const result = await invokeReader(moduleState);

      expectReaderError(result, readFileSyncSpy, readFileSpy);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(geoJsonProviderSpy).not.toHaveBeenCalled();
    },
  );

  it("rejects duplicate category identifiers instead of selecting one category", async () => {
    artifactReadFixture = {
      raw: JSON.stringify(artifactWith({
        sources: {
          ...validArtifact.sources,
          locations: [
            validLocationsFixture[0],
            {
              ...validLocationsFixture[0],
              category: "別カテゴリ",
              locations: [{ ...validLocationsFixture[0].locations[0], id: "urn:uuid:00000000-0000-4000-8000-000000000002" }],
            },
          ],
        },
        derivedRegions: {
          "urn:uuid:00000000-0000-4000-8000-000000000001": "神田和泉町",
          "urn:uuid:00000000-0000-4000-8000-000000000002": "神田和泉町",
        },
      })),
    };

    const result = await invokeReader(moduleState);

    expectReaderError(result, readFileSyncSpy, readFileSpy);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(geoJsonProviderSpy).not.toHaveBeenCalled();
  });

  it("rejects duplicate location identifiers instead of selecting one detail", async () => {
    artifactReadFixture = {
      raw: JSON.stringify(artifactWith({
        sources: {
          ...validArtifact.sources,
          locations: [
            validLocationsFixture[0],
            {
              ...validLocationsFixture[0],
              category: "別カテゴリ",
              categoryId: "1512",
              locations: [{ ...validLocationsFixture[0].locations[0], name: "同じIDの別施設" }],
            },
          ],
        },
      })),
    };

    const result = await invokeReader(moduleState);

    expectReaderError(result, readFileSyncSpy, readFileSpy);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(geoJsonProviderSpy).not.toHaveBeenCalled();
  });

  it("allows the same location in two categories when the entries are identical", async () => {
    const entry = validLocationsFixture[0].locations[0];
    artifactReadFixture = {
      raw: JSON.stringify(artifactWith({
        sources: {
          ...validArtifact.sources,
          locations: [
            validLocationsFixture[0],
            {
              category: "図書館",
              categoryId: "1512",
              locations: [{ ...entry }],
            },
          ],
        },
      })),
    };

    const result = await invokeReader(moduleState);

    expect(result).toEqual({
      status: "success",
      artifact: expect.objectContaining({
        sources: expect.objectContaining({
          locations: expect.arrayContaining([
            expect.objectContaining({ categoryId: "1302" }),
            expect.objectContaining({ categoryId: "1512" }),
          ]),
        }),
      }),
    });
    expectArtifactReadAttempt(readFileSyncSpy, readFileSpy);
  });

  describe("locations projection for accessibility", () => {
    const validLocations = [
      {
        category: "市役所・東京都の区役所",
        categoryId: "1302",
        locations: [
          {
            id: "urn:uuid:00000000-0000-4000-8000-000000000001",
            name: "千代田区役所",
            lat: 35.694,
            lng: 139.753,
            imageUri: "https://fixtures.example.test/images/city.jpg",
            imageCreator: "さくら",
            imageLicense: "https://creativecommons.org/licenses/by-sa/3.0/",
            relatedPages: [
              { name: "東京バリアフリーマップ", url: "https://fixtures.example.test/bfm/city" },
            ],
            osmElement: { type: "node", id: 1 },
            wheelchair: "yes",
            osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
          },
          {
            id: "urn:uuid:00000000-0000-4000-8000-000000000002",
            name: "千代田区立千代田図書館",
            lat: 35.695,
            lng: 139.754,
            relatedPages: [],
            osmElement: { type: "way", id: 2 },
            wheelchair: null,
            osmEditUrl: "https://www.openstreetmap.org/edit?way=2",
          },
        ],
      },
    ];

    const artifactWithLocations = (overrides: Record<string, unknown> = {}) => artifactWith({
      sources: {
        ...validArtifact.sources,
        locations: validLocations,
        ...((overrides["sources"] as Record<string, unknown>) ?? {}),
      },
      derivedRegions: {
                "urn:uuid:00000000-0000-4000-8000-000000000001": "神田和泉町",
        "urn:uuid:00000000-0000-4000-8000-000000000002": "神田和泉町",
        ...(overrides["derivedRegions"] as Record<string, string> ?? {}),
      },
      ...overrides,
    });

    it("reads locations with wheelchair, osmElement, image attribution and relatedPages", async () => {
      artifactReadFixture = { raw: JSON.stringify(artifactWithLocations()) };
      const result = await invokeReader(moduleState);
      expect(result).toEqual({
        status: "success",
        artifact: expect.objectContaining({
          sources: expect.objectContaining({
            locations: validLocations,
          }),
        }),
      });
    });

    it("accepts a non-URI image license", async () => {
      const locations = structuredClone(validLocations) as Array<Record<string, unknown>>;
      (locations[0] as Record<string, unknown>)["locations"] = [
        {
          ...(validLocations[0].locations[0] as object),
          imageLicense: "Public domain",
        },
      ];
      artifactReadFixture = {
        raw: JSON.stringify(artifactWithLocations({
          sources: { ...validArtifact.sources, locations },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expect(result).toEqual({
        status: "success",
        artifact: expect.objectContaining({
          sources: expect.objectContaining({
            locations: [
              expect.objectContaining({
                locations: [
                  expect.objectContaining({ imageLicense: "Public domain" }),
                ],
              }),
            ],
          }),
        }),
      });
    });

    it("rejects a blank image license", async () => {
      const locations = structuredClone(validLocations) as Array<Record<string, unknown>>;
      (locations[0] as Record<string, unknown>)["locations"] = [
        {
          ...(validLocations[0].locations[0] as object),
          imageLicense: "",
        },
      ];
      artifactReadFixture = {
        raw: JSON.stringify(artifactWithLocations({
          sources: { ...validArtifact.sources, locations },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });

    it("rejects missing locations", async () => {
      const withoutLocations = {
        ...validArtifact,
        sources: {
          routeDestinations: validArtifact.sources.routeDestinations,
          townGeoJson: validArtifact.sources.townGeoJson,
        },
      };
      artifactReadFixture = { raw: JSON.stringify(withoutLocations) };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });

    it("rejects duplicate location IDs across categories", async () => {
      const dup = structuredClone(validLocations) as typeof validLocations;
      dup.push({
        category: "図書館",
        categoryId: "1512",
        locations: [
          {
            ...(dup[0].locations[0] as object),
            name: "同じIDの別施設",
          } as never,
        ],
      });
      artifactReadFixture = {
        raw: JSON.stringify(artifactWithLocations({
          sources: { ...validArtifact.sources, locations: dup },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });

    it("rejects invalid wheelchair values", async () => {
      const bad = structuredClone(validLocations) as Array<Record<string, unknown>>;
      (bad[0] as Record<string, unknown>)["locations"] = [
        { ...(validLocations[0].locations[0] as object), wheelchair: "bogus" },
      ];
      artifactReadFixture = {
        raw: JSON.stringify(artifactWithLocations({
          sources: { ...validArtifact.sources, locations: bad },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });

    it("rejects invalid osmElement", async () => {
      const bad = structuredClone(validLocations) as Array<Record<string, unknown>>;
      (bad[0] as Record<string, unknown>)["locations"] = [
        { ...(validLocations[0].locations[0] as object), osmElement: { type: "node", id: "x" } },
      ];
      artifactReadFixture = {
        raw: JSON.stringify(artifactWithLocations({
          sources: { ...validArtifact.sources, locations: bad },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });

    it("rejects duplicate categoryIds", async () => {
      const dup = [...validLocations, { ...validLocations[0] }];
      artifactReadFixture = {
        raw: JSON.stringify(artifactWithLocations({
          sources: { ...validArtifact.sources, locations: dup },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });

    it("accepts image without author when a license exists", async () => {
      const bad = structuredClone(validLocations) as Array<Record<string, unknown>>;
      const loc = { ...(validLocations[0].locations[0] as object) } as Record<string, unknown>;
      delete loc["imageCreator"];
      (bad[0] as Record<string, unknown>)["locations"] = [loc];
      artifactReadFixture = {
        raw: JSON.stringify(artifactWithLocations({
          sources: { ...validArtifact.sources, locations: bad },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expect(result).toEqual({
        status: "success",
        artifact: expect.objectContaining({
          sources: expect.objectContaining({ locations: bad }),
        }),
      });
    });

    it("rejects image without author and license", async () => {
      const bad = structuredClone(validLocations) as Array<Record<string, unknown>>;
      const loc = { ...(validLocations[0].locations[0] as object) } as Record<string, unknown>;
      delete loc["imageCreator"];
      delete loc["imageLicense"];
      (bad[0] as Record<string, unknown>)["locations"] = [loc];
      artifactReadFixture = {
        raw: JSON.stringify(artifactWithLocations({
          sources: { ...validArtifact.sources, locations: bad },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });
  });

  describe("derived location images", () => {
    const locationId = "urn:uuid:00000000-0000-4000-8000-000000000071";
    const validDerivedImage = {
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
    };

    function artifactWithImage(image: unknown): Record<string, unknown> {
      return artifactWith({
        sources: {
          ...validArtifact.sources,
          locations: [
            {
              category: "市役所・東京都の区役所",
              categoryId: "1302",
              locations: [
                {
                  id: locationId,
                  name: "千代田区役所",
                  lat: 35.694,
                  lng: 139.753,
                  imageUri: "https://fixtures.example.test/images/city.jpg",
                  imageCreator: "さくら",
                  imageLicense:
                    "https://creativecommons.org/licenses/by-sa/3.0/",
                  image,
                  relatedPages: [],
                  osmElement: { type: "node", id: 1 },
                  wheelchair: "yes",
                  osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
                },
              ],
            },
          ],
        },
        derivedRegions: { [locationId]: "神田和泉町" },
      } as unknown as Record<string, unknown>);
    }

    it("reads the derived image width, height and variants", async () => {
      artifactReadFixture = {
        raw: JSON.stringify(artifactWithImage(validDerivedImage)),
      };
      const result = await invokeReader(moduleState);
      expect(result).toEqual({
        status: "success",
        artifact: expect.objectContaining({
          sources: expect.objectContaining({
            locations: [
              expect.objectContaining({
                locations: [
                  expect.objectContaining({ image: validDerivedImage }),
                ],
              }),
            ],
          }),
        }),
      });
    });

    it.each([
      ["a non-object image", "not-an-object"],
      ["a non-positive width", { ...validDerivedImage, width: 0 }],
      ["a negative height", { ...validDerivedImage, height: -1 }],
      ["a fractional width", { ...validDerivedImage, width: 1280.5 }],
      ["empty variants", { ...validDerivedImage, variants: [] }],
      [
        "a zero variant width",
        {
          ...validDerivedImage,
          variants: [{ width: 0, path: validDerivedImage.variants[0].path }],
        },
      ],
      [
        "a string variant width",
        {
          ...validDerivedImage,
          variants: [
            { width: "480", path: validDerivedImage.variants[0].path },
          ],
        },
      ],
      [
        "an external variant path",
        {
          ...validDerivedImage,
          variants: [
            {
              width: 480,
              path: "https://example.test/generated/location-images/0123456789abcdef-480.webp",
            },
          ],
        },
      ],
      [
        "a traversal variant path",
        {
          ...validDerivedImage,
          variants: [
            {
              width: 480,
              path: "/generated/location-images/../0123456789abcdef-480.webp",
            },
          ],
        },
      ],
      [
        "a variant path outside the generated directory",
        {
          ...validDerivedImage,
          variants: [
            {
              width: 480,
              path: "/generated/other/0123456789abcdef-480.webp",
            },
          ],
        },
      ],
    ])("rejects an invalid derived image: %s", async (_label, image) => {
      artifactReadFixture = {
        raw: JSON.stringify(artifactWithImage(image)),
      };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });
  });

  describe("location facts", () => {
    const factsLocations = [
      {
        category: "市役所・東京都の区役所",
        categoryId: "1302",
        locations: [
          {
            id: "urn:uuid:00000000-0000-4000-8000-000000000001",
            name: "千代田区役所",
            lat: 35.694,
            lng: 139.753,
            relatedPages: [],
            osmElement: { type: "node", id: 1 },
            wheelchair: "yes",
            phone: { display: "03-3264-2111", tel: "tel:0332642111" },
            websiteUri: "https://www.city.chiyoda.lg.jp/",
            wikipediaUri: "https://ja.wikipedia.org/wiki/%E5%8D%83%E4%BB%A3%E7%94%B0%E5%8C%BA%E5%BD%B9%E6%89%80",
            osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
          },
        ],
      },
    ];

    it("reads phone, website, wikipedia and edit URL", async () => {
      artifactReadFixture = {
        raw: JSON.stringify(artifactWith({
          sources: { ...validArtifact.sources, locations: factsLocations },
          derivedRegions: {
            "kanda-library": "神田和泉町",
            "urn:uuid:00000000-0000-4000-8000-000000000001": "神田和泉町",
            "urn:uuid:00000000-0000-4000-8000-000000000002": "神田和泉町",
          },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expect(result).toEqual({
        status: "success",
        artifact: expect.objectContaining({
          sources: expect.objectContaining({
            locations: factsLocations,
          }),
        }),
      });
    });

    it("rejects invalid phone", async () => {
      const bad = structuredClone(factsLocations) as Array<Record<string, unknown>>;
      (bad[0] as Record<string, unknown>)["locations"] = [
        { ...(factsLocations[0].locations[0] as object), phone: { display: "", tel: "tel:x" } },
      ];
      artifactReadFixture = {
        raw: JSON.stringify(artifactWith({
          sources: { ...validArtifact.sources, locations: bad },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });

    it("rejects invalid websiteUri", async () => {
      const bad = structuredClone(factsLocations) as Array<Record<string, unknown>>;
      (bad[0] as Record<string, unknown>)["locations"] = [
        { ...(factsLocations[0].locations[0] as object), websiteUri: "not-a-uri" },
      ];
      artifactReadFixture = {
        raw: JSON.stringify(artifactWith({
          sources: { ...validArtifact.sources, locations: bad },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });

    it("rejects invalid wikipediaUri", async () => {
      const bad = structuredClone(factsLocations) as Array<Record<string, unknown>>;
      (bad[0] as Record<string, unknown>)["locations"] = [
        { ...(factsLocations[0].locations[0] as object), wikipediaUri: "not-a-uri" },
      ];
      artifactReadFixture = {
        raw: JSON.stringify(artifactWith({
          sources: { ...validArtifact.sources, locations: bad },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });

    it("rejects missing osmEditUrl", async () => {
      const bad = structuredClone(factsLocations) as Array<Record<string, unknown>>;
      const loc = { ...(factsLocations[0].locations[0] as object) } as Record<string, unknown>;
      delete loc["osmEditUrl"];
      (bad[0] as Record<string, unknown>)["locations"] = [loc];
      artifactReadFixture = {
        raw: JSON.stringify(artifactWith({
          sources: { ...validArtifact.sources, locations: bad },
        } as unknown as Record<string, unknown>)),
      };
      const result = await invokeReader(moduleState);
      expectReaderError(result, readFileSyncSpy, readFileSpy);
    });
  });
});
