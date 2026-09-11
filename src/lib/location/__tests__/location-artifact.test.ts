/** @jest-environment node */

import fs from "node:fs";
import path from "node:path";
import { resolveLocationDetail } from "../location-detail-resolver";

export {};

jest.mock("@/utils/addressLoader", () => {
  const actual = jest.requireActual("@/utils/addressLoader");
  return {
    ...actual,
    loadAddressDataResult: jest.fn(),
    loadKeyLocationsDataResult: jest.fn(),
  };
});

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
  mainFacilitiesUri: string;
  keyLocationsUri: string;
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
  mainFacilitiesUri: "https://fixtures.example.test/v2/main_facilities.json",
  keyLocationsUri: "https://fixtures.example.test/v2/key_locations.json",
  townGeoJsonUri: "https://fixtures.example.test/v2/chiyoda-towns.geojson",
};

const mainFacilities = [
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
        description: "千代田区の行政窓口",
      },
    ],
  },
];

const keyLocations = [
  {
    category: "公共施設",
    "category:en": "public-facilities",
    locations: [
      {
        id: "kanda-library",
        name: "神田図書館",
        lat: 35.694,
        lng: 139.768,
        nodeCopyright: "千代田区",
        licence: "CC BY 4.0",
        licenceUri: "https://creativecommons.org/licenses/by/4.0/",
        description: "地域の図書館です",
        imageUri: "https://fixtures.example.test/images/library.jpg",
        imageCopyright: "© Example",
        uri: "https://fixtures.example.test/library",
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

const validArtifact = {
  status: "validated",
  sourceUris,
  sources: {
    // mainFacilities is the home "よく利用される施設" data.
    mainFacilities,
    // keyLocations is the category and detail data. It deliberately has no area.
    keyLocations,
    // townGeoJson is the build-time source used to derive display regions.
    townGeoJson,
  },
  // The source location deliberately has no `area` field. The display value is
  // derived from GeoJSON and normalized only in this artifact projection.
  derivedRegions: {
    "kanda-library": "神田和泉町",
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
  const downstreamState = resolveLocationDetail("kanda-library", {
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
  let legacyMainFacilitiesSpy: jest.SpyInstance;
  let legacyKeyLocationsSpy: jest.SpyInstance;
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

    // These are the forbidden pre-Q21 sources. Make an accidental call fail
    // immediately and retain a direct interaction assertion below.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- access the mocked forbidden-source boundary
    const legacySources = require("@/utils/addressLoader") as {
      loadAddressDataResult: jest.MockedFunction<() => Promise<unknown>>;
      loadKeyLocationsDataResult: jest.MockedFunction<() => Promise<unknown>>;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- access the mocked forbidden-source boundary
    const geoJsonSources = require("@/utils/geoUtils") as {
      loadGeoJSON: jest.MockedFunction<() => Promise<unknown>>;
    };

    legacyMainFacilitiesSpy = legacySources.loadAddressDataResult;
    legacyKeyLocationsSpy = legacySources.loadKeyLocationsDataResult;
    geoJsonProviderSpy = geoJsonSources.loadGeoJSON;
    legacyMainFacilitiesSpy.mockReset().mockRejectedValue(
      new Error("legacy main-facilities source was called"),
    );
    legacyKeyLocationsSpy.mockReset().mockRejectedValue(
      new Error("legacy key-locations source was called"),
    );
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
          mainFacilities,
          keyLocations,
          townGeoJson,
        }),
        derivedRegions: {
          "kanda-library": "神田和泉町",
        },
      }),
    });
    expectArtifactReadAttempt(readFileSyncSpy, readFileSpy);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(legacyMainFacilitiesSpy).not.toHaveBeenCalled();
    expect(legacyKeyLocationsSpy).not.toHaveBeenCalled();
    expect(geoJsonProviderSpy).not.toHaveBeenCalled();

    const artifact = (result as { status: "success"; artifact: typeof validArtifact }).artifact;
    expect(artifact.sources.mainFacilities).toEqual(mainFacilities);
    expect(artifact.sources.keyLocations).toEqual(keyLocations);
    expect(artifact.sources.townGeoJson).toEqual(townGeoJson);
    expect(artifact.sources.keyLocations[0].locations[0]).not.toHaveProperty("area");
    expect(artifact.derivedRegions["kanda-library"]).toBe("神田和泉町");
    expect(artifact.derivedRegions["kanda-library"]).not.toContain("東京都千代田区");
  });

  it("reads an artifact with explicit null optional metadata and preserves every null value", async () => {
    const artifactWithNullOptionals = artifactWith({
      sources: {
        ...validArtifact.sources,
        mainFacilities: [{
          ...mainFacilities[0],
          locations: [{
            ...mainFacilities[0].locations[0],
            description: null,
            imageUri: null,
            imageCopyright: null,
            uri: null,
          }],
        }],
        keyLocations: [{
          ...keyLocations[0],
          locations: [{
            ...keyLocations[0].locations[0],
            description: null,
            descriptionCopyright: null,
            imageUri: null,
            imageCopyright: null,
            imageCopylight: null,
            uri: null,
            nodeSourceId: null,
          }],
        }],
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
    expect(legacyMainFacilitiesSpy).not.toHaveBeenCalled();
    expect(legacyKeyLocationsSpy).not.toHaveBeenCalled();
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
      expect(legacyMainFacilitiesSpy).not.toHaveBeenCalled();
      expect(legacyKeyLocationsSpy).not.toHaveBeenCalled();
      expect(geoJsonProviderSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["invalid artifact status", artifactWith({ status: "invalid" })],
    ["missing source URIs", artifactWith({ sourceUris: undefined })],
    ["malformed source URI", artifactWith({
      sourceUris: { ...sourceUris, townGeoJsonUri: "not-an-absolute-uri" },
    })],
    ["missing main facilities", artifactWith({
      sources: { ...validArtifact.sources, mainFacilities: undefined },
    })],
    ["empty home categories", artifactWith({
      sources: { ...validArtifact.sources, mainFacilities: [] },
    })],
    ["missing key locations", artifactWith({
      sources: { ...validArtifact.sources, keyLocations: undefined },
    })],
    ["empty category data", artifactWith({
      sources: { ...validArtifact.sources, keyLocations: [] },
    })],
    ["missing town GeoJSON", artifactWith({
      sources: { ...validArtifact.sources, townGeoJson: undefined },
    })],
    ["malformed derived regions", artifactWith({ derivedRegions: [] })],
    ["missing derived region for a detail location", artifactWith({ derivedRegions: {} })],
    ["invalid required detail data", artifactWith({
      sources: {
        ...validArtifact.sources,
        keyLocations: [{
          ...keyLocations[0],
          locations: [{ ...keyLocations[0].locations[0], id: "" }],
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
      expect(legacyMainFacilitiesSpy).not.toHaveBeenCalled();
      expect(legacyKeyLocationsSpy).not.toHaveBeenCalled();
      expect(geoJsonProviderSpy).not.toHaveBeenCalled();
    },
  );

  it("rejects duplicate category identifiers instead of selecting one category", async () => {
    artifactReadFixture = {
      raw: JSON.stringify(artifactWith({
        sources: {
          ...validArtifact.sources,
          keyLocations: [
            keyLocations[0],
            {
              ...keyLocations[0],
              category: "別カテゴリ",
              locations: [{ ...keyLocations[0].locations[0], id: "another-location" }],
            },
          ],
        },
        derivedRegions: {
          "kanda-library": "神田和泉町",
          "another-location": "神田和泉町",
        },
      })),
    };

    const result = await invokeReader(moduleState);

    expectReaderError(result, readFileSyncSpy, readFileSpy);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(legacyKeyLocationsSpy).not.toHaveBeenCalled();
    expect(geoJsonProviderSpy).not.toHaveBeenCalled();
  });

  it("rejects duplicate location identifiers instead of selecting one detail", async () => {
    artifactReadFixture = {
      raw: JSON.stringify(artifactWith({
        sources: {
          ...validArtifact.sources,
          keyLocations: [
            keyLocations[0],
            {
              ...keyLocations[0],
              category: "別カテゴリ",
              "category:en": "another-category",
              locations: [{ ...keyLocations[0].locations[0], name: "同じIDの別施設" }],
            },
          ],
        },
      })),
    };

    const result = await invokeReader(moduleState);

    expectReaderError(result, readFileSyncSpy, readFileSpy);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(legacyKeyLocationsSpy).not.toHaveBeenCalled();
    expect(geoJsonProviderSpy).not.toHaveBeenCalled();
  });
});
