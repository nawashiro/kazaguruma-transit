/** @jest-environment node */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

export {};

type PublicFunction = (...args: unknown[]) => unknown;
type PublicModule = Record<string, unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

type TransportResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type Transport = (uri: string) => Promise<TransportResponse>;
type ArtifactWriter = (artifact: unknown) => Promise<void>;

type ImageFetchResponse = {
  ok: boolean;
  status: number;
  retryAfterSeconds?: number | null;
  bytes: () => Promise<Uint8Array>;
};

type EncodedImageVariant = {
  width: number;
  height: number;
  bytes: Uint8Array;
};

type EncodedImage = {
  width: number;
  height: number;
  variants: EncodedImageVariant[];
};

type ImagePipeline = {
  fetch: jest.Mock;
  encode: jest.Mock;
  write: jest.Mock;
  clean: jest.Mock;
  warn: jest.Mock;
  sleep: jest.Mock;
};

type SourceName =
  | "placesJsonLd"
  | "osmMirror"
  | "townGeoJson"
  | "categoryNames"
  | "wikidataMirror";

type GeneratorOptions = {
  appConfig: unknown;
  destinationCatalog: unknown;
  transport: Transport;
  writeArtifact: ArtifactWriter;
  images: ImagePipeline;
};

type GeneratorHarness = {
  options: GeneratorOptions;
  transport: jest.MockedFunction<Transport>;
  writeArtifact: jest.MockedFunction<ArtifactWriter>;
  artifactState: { current: unknown };
  images: ImagePipeline;
};

const GENERATOR_MODULE_PATH = "../generate-location-artifact";
const ARTIFACT_SENTINEL = { status: "previous-build-must-survive" };
const REPOSITORY_ROOT = process.cwd();
const GENERATOR_CLI_PATH = resolve(
  REPOSITORY_ROOT,
  "scripts/generate-location-artifact.ts",
);
const TSX_CLI_PATH = resolve(REPOSITORY_ROOT, "node_modules/tsx/dist/cli.mjs");
const execFileAsync = promisify(execFile);

const PLACES_URI = "https://fixtures.example.test/places.jsonld";
const OSM_MIRROR_URI = "https://fixtures.example.test/mirrors/osm.json";
const TOWN_GEOJSON_URI = "https://fixtures.example.test/chiyoda-towns.geojson";
const CATEGORY_NAMES_URI =
  "https://fixtures.example.test/category-names.jsonld";
const WIKIDATA_MIRROR_URI = "https://fixtures.example.test/mirrors/wikidata.json";

const validAppConfig = {
  placesJsonLdUri: PLACES_URI,
  osmMirrorUri: OSM_MIRROR_URI,
  townGeoJsonUri: TOWN_GEOJSON_URI,
  categoryNamesUri: CATEGORY_NAMES_URI,
  wikidataMirrorUri: WIKIDATA_MIRROR_URI,
};

const LAT = 35.694;
const LNG = 139.753;
const LIBRARY_LAT = 35.695;
const LIBRARY_LNG = 139.754;

const ID = {
  cityOffice: "urn:uuid:00000000-0000-4000-8000-000000000001",
  library: "urn:uuid:00000000-0000-4000-8000-000000000002",
  cinema: "urn:uuid:00000000-0000-4000-8000-000000000003",
  outsideCatalog: "urn:uuid:00000000-0000-4000-8000-000000000004",
  missing: "urn:uuid:00000000-0000-4000-8000-0000000000ff",
};

type JsonRecord = Record<string, unknown>;

function placeRecord(
  id: string,
  options: {
    lat?: unknown;
    lng?: unknown;
    codes?: string[];
    seeAlso?: string[] | undefined;
  } = {},
): JsonRecord {
  const record: JsonRecord = {
    "@id": id,
    "@type": ["schema:Place"],
    "schema:geo": {
      "@type": "schema:GeoCoordinates",
      "schema:latitude": options.lat ?? LAT,
      "schema:longitude": options.lng ?? LNG,
    },
    "schema:identifier": (options.codes ?? ["1302"]).map((code) => ({
      "@type": "schema:PropertyValue",
      "schema:propertyID": "gif-poi",
      "schema:value": code,
    })),
  };
  if (options.seeAlso !== undefined) {
    record["rdfs:seeAlso"] = options.seeAlso;
  }
  return record;
}

const validPlacesJsonLd = {
  "@context": { "@version": 1.1 },
  "@graph": [
    placeRecord(ID.cityOffice, {
      seeAlso: [
        "https://www.openstreetmap.org/node/1",
        "https://www.wikidata.org/entity/Q1",
      ],
    }),
    placeRecord(ID.library, {
      lat: LIBRARY_LAT,
      lng: LIBRARY_LNG,
      codes: ["1512"],
      seeAlso: ["https://www.openstreetmap.org/way/2"],
    }),
    placeRecord(ID.cinema, {
      codes: ["1011"],
      seeAlso: ["https://www.openstreetmap.org/node/3"],
    }),
  ],
};

const validOsmMirror = {
  version: "202611170100",
  elements: [
    { type: "node", id: 1, lat: LAT, lon: LNG, tags: { name: "千代田区役所" } },
    {
      type: "way",
      id: 2,
      lat: LIBRARY_LAT,
      lon: LIBRARY_LNG,
      tags: { name: "千代田区立千代田図書館" },
    },
    { type: "node", id: 3, lat: LAT, lon: LNG, tags: { name: "神保町シアター" } },
  ],
};

const categoryTerm = (code: string, name: string): JsonRecord => ({
  "@type": "schema:DefinedTerm",
  "@id": `${CATEGORY_NAMES_URI}#${code}`,
  "schema:name": name,
});

const validWikidataMirror = {
  sourceId: "wikidata",
  retrievedAt: "2026-11-18T00:00:00Z",
  entities: {
    Q11405293: {
      id: "Q11405293",
      sitelinks: {
        jawiki: { site: "jawiki", title: "千代田区役所" },
      },
    },
    Q61886796: {
      id: "Q61886796",
      sitelinks: {
        enwiki: { site: "enwiki", title: "Chiyoda Library" },
      },
    },
  },
};

const validCategoryNames = {
  "@context": { "@version": 1.1, schema: "https://schema.org/" },
  "@type": "schema:DefinedTermSet",
  "schema:hasDefinedTerm": [
    categoryTerm("1512", "図書館"),
    categoryTerm("1302", "市役所・東京都の区役所"),
    categoryTerm("1304", "役場支所及び出張所"),
    categoryTerm("1011", "映画館"),
  ],
};

const validCatalog = {
  source: { placesUri: PLACES_URI, osmMirrorUri: OSM_MIRROR_URI },
  places: [
    { id: ID.cityOffice, name: "目録の区役所", includeInRouteForm: true },
    { id: ID.library, name: "目録の図書館", includeInRouteForm: true },
    { id: ID.cinema, name: "目録の映画館", includeInRouteForm: false },
  ],
};

const polygonCoordinates = [
  [
    [139.7, 35.6],
    [139.8, 35.6],
    [139.8, 35.8],
    [139.7, 35.8],
    [139.7, 35.6],
  ],
];

const validTownGeoJson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "東京都千代田区神田和泉町" },
      geometry: { type: "Polygon", coordinates: polygonCoordinates },
    },
  ],
};

const sourceUriByName: Record<SourceName, string> = {
  placesJsonLd: PLACES_URI,
  osmMirror: OSM_MIRROR_URI,
  townGeoJson: TOWN_GEOJSON_URI,
  categoryNames: CATEGORY_NAMES_URI,
  wikidataMirror: WIKIDATA_MIRROR_URI,
};

const validPayloadBySource: Record<SourceName, unknown> = {
  placesJsonLd: validPlacesJsonLd,
  osmMirror: validOsmMirror,
  townGeoJson: validTownGeoJson,
  categoryNames: validCategoryNames,
  wikidataMirror: validWikidataMirror,
};

const expectedRouteDestinations = [
  {
    category: "図書館",
    categoryId: "1512",
    locations: [
      { name: "千代田区立千代田図書館", lat: LIBRARY_LAT, lng: LIBRARY_LNG },
    ],
  },
  {
    category: "市役所・東京都の区役所",
    categoryId: "1302",
    locations: [{ name: "千代田区役所", lat: LAT, lng: LNG }],
  },
];

function jsonResponse(payload: unknown, status = 200): TransportResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function sourceForUri(uri: string): SourceName {
  const source = (Object.keys(sourceUriByName) as SourceName[]).find(
    (candidate) => sourceUriByName[candidate] === uri,
  );
  if (!source) {
    throw new Error(`unexpected fixture URI: ${uri}`);
  }
  return source;
}

function validResponseForUri(uri: string): TransportResponse {
  return jsonResponse(validPayloadBySource[sourceForUri(uri)]);
}

function loadModule(): ModuleState {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded RED public-boundary load
    const loaded: unknown = require(GENERATOR_MODULE_PATH);
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error(
          "generate-location-artifact public module must export an object",
        ),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
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
      `${publicName} is not implemented: public module ${GENERATOR_MODULE_PATH} could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(
      `${publicName} is not implemented: public module ${GENERATOR_MODULE_PATH} exported nothing`,
    );
  }
  const implementation = state.exports[publicName];
  if (typeof implementation !== "function") {
    throw new Error(
      `${publicName} is not implemented: public module ${GENERATOR_MODULE_PATH} does not export ${publicName}`,
    );
  }
  return implementation as PublicFunction;
}

function createImagePipeline(
  overrides: Partial<ImagePipeline> = {},
): ImagePipeline {
  return {
    fetch: jest.fn(),
    encode: jest.fn(),
    write: jest.fn(async () => undefined),
    clean: jest.fn(async () => undefined),
    warn: jest.fn(),
    sleep: jest.fn(async () => undefined),
    ...overrides,
  };
}

function createHarness(
  payloadOverrides: Partial<Record<SourceName, unknown>> = {},
  options: {
    catalog?: unknown;
    appConfig?: unknown;
    images?: Partial<ImagePipeline>;
  } = {},
): GeneratorHarness {
  const payloadByUri: Record<string, unknown> = {
    [PLACES_URI]: payloadOverrides.placesJsonLd ?? validPayloadBySource.placesJsonLd,
    [OSM_MIRROR_URI]: payloadOverrides.osmMirror ?? validPayloadBySource.osmMirror,
    [TOWN_GEOJSON_URI]: payloadOverrides.townGeoJson ?? validPayloadBySource.townGeoJson,
    [CATEGORY_NAMES_URI]:
      payloadOverrides.categoryNames ?? validPayloadBySource.categoryNames,
    [WIKIDATA_MIRROR_URI]:
      payloadOverrides.wikidataMirror ?? validPayloadBySource.wikidataMirror,
  };
  const transport = jest.fn<ReturnType<Transport>, Parameters<Transport>>();
  transport.mockImplementation(async (uri) => {
    if (!(uri in payloadByUri)) {
      throw new Error(`unexpected fixture URI: ${uri}`);
    }
    return jsonResponse(payloadByUri[uri]);
  });

  const artifactState: { current: unknown } = { current: ARTIFACT_SENTINEL };
  const writeArtifact = jest.fn<ReturnType<ArtifactWriter>, Parameters<ArtifactWriter>>();
  writeArtifact.mockImplementation(async (artifact) => {
    artifactState.current = artifact;
  });

  const images = createImagePipeline(options.images);

  return {
    options: {
      appConfig: options.appConfig ?? validAppConfig,
      destinationCatalog: options.catalog ?? validCatalog,
      transport,
      writeArtifact,
      images,
    },
    transport,
    writeArtifact,
    artifactState,
    images,
  };
}

function invokeGenerator(
  moduleState: ModuleState,
  options: GeneratorOptions,
): Promise<unknown> {
  return Promise.resolve().then(() => {
    const generateLocationArtifact = getPublicFunction(
      moduleState,
      "generateLocationArtifact",
    );
    return generateLocationArtifact(options);
  });
}

function catalogWith(
  overrides: Partial<{ placesUri: string; osmMirrorUri: string }> = {},
  places: Array<Record<string, unknown>> = validCatalog.places,
): unknown {
  return {
    source: {
      placesUri: overrides.placesUri ?? PLACES_URI,
      osmMirrorUri: overrides.osmMirrorUri ?? OSM_MIRROR_URI,
    },
    places,
  };
}

function selectOnly(id: string, name = "目録の名前"): unknown {
  return catalogWith({}, [
    { id, name, includeInRouteForm: true },
  ]);
}

function graphWith(recordOverrides: JsonRecord, recordIndex = 0): unknown {
  const graph = [...validPlacesJsonLd["@graph"]];
  graph[recordIndex] = { ...graph[recordIndex], ...recordOverrides };
  return { ...validPlacesJsonLd, "@graph": graph };
}

function osmWith(
  elementOverrides: JsonRecord,
  elementIndex: number,
): unknown {
  const elements = [...validOsmMirror.elements];
  elements[elementIndex] = { ...elements[elementIndex], ...elementOverrides };
  return { ...validOsmMirror, elements };
}

function expectArtifactUnchanged(
  harness: GeneratorHarness,
  expectedWriterCalls = 0,
): void {
  expect(harness.writeArtifact).toHaveBeenCalledTimes(expectedWriterCalls);
  expect(harness.artifactState.current).toBe(ARTIFACT_SENTINEL);
}

function expectNoFallbackTransportRequests(
  transport: jest.MockedFunction<Transport>,
): void {
  const requestedUris = transport.mock.calls.map(([uri]) => uri);
  const configuredUriSet = new Set(Object.values(sourceUriByName));

  expect(requestedUris.every((uri) => configuredUriSet.has(uri))).toBe(true);
  expect(requestedUris.some((uri) => uri.includes("cdn.jsdelivr.net"))).toBe(false);
  expect(
    requestedUris.some((uri) => uri.includes("main_facilities")),
  ).toBe(false);
}

const moduleState = loadModule();

describe("generateLocationArtifact build boundary", () => {
  if (
    moduleState.error ||
    !moduleState.exports ||
    typeof moduleState.exports.generateLocationArtifact !== "function"
  ) {
    it("reports the missing public generator as an actionable RED contract", () => {
      throw new Error(
        "generateLocationArtifact is not implemented: the public generator export is missing",
      );
    });
    return;
  }

  describe("appConfig source URI contract", () => {
    const invalidUriValues: Array<[string, unknown]> = [
      ["unset", undefined],
      ["null", null],
      ["empty", ""],
      ["whitespace-only", "   "],
      ["wrong type", 42],
      ["relative path", "data/location-data.json"],
      ["malformed absolute URI", "https://"],
      ["unsupported URI scheme", "ftp://fixtures.example.test/data.json"],
    ];

    it.each([
      ["placesJsonLdUri", "placesJsonLdUri"],
      ["osmMirrorUri", "osmMirrorUri"],
      ["townGeoJsonUri", "townGeoJsonUri"],
      ["categoryNamesUri", "categoryNamesUri"],
      ["wikidataMirrorUri", "wikidataMirrorUri"],
    ])(
      "fails before transport when %s is invalid",
      async (_label, field) => {
        for (const [, value] of invalidUriValues) {
          const harness = createHarness({}, {
            appConfig: { ...validAppConfig, [field]: value },
          });

          await expect(
            invokeGenerator(moduleState, harness.options),
          ).rejects.toThrow();

          expect(harness.transport).not.toHaveBeenCalled();
          expectArtifactUnchanged(harness);
        }
      },
    );

    it("uses the five configured URIs exactly once", async () => {
      const harness = createHarness();

      await invokeGenerator(moduleState, harness.options);

      expectNoFallbackTransportRequests(harness.transport);
      const requestedUris = harness.transport.mock.calls.map(([uri]) => uri);
      for (const uri of Object.values(sourceUriByName)) {
        expect(requestedUris.filter((requested) => requested === uri)).toHaveLength(1);
      }
      expect(requestedUris).toHaveLength(5);
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });
  });

  describe("transport, HTTP, and JSON decoding failures", () => {
    const sources: SourceName[] = [
      "placesJsonLd",
      "osmMirror",
      "townGeoJson",
      "categoryNames",
      "wikidataMirror",
    ];

    it.each(sources)(
      "propagates a %s transport rejection without updating the artifact",
      async (source) => {
        const harness = createHarness();
        const targetUri = sourceUriByName[source];
        harness.transport.mockImplementation(async (uri) => {
          if (uri === targetUri) {
            throw new Error(`${source} transport unavailable`);
          }
          return validResponseForUri(uri);
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
          `${source} transport unavailable`,
        );
        expectNoFallbackTransportRequests(harness.transport);
        expectArtifactUnchanged(harness);
      },
    );

    it.each(sources)(
      "propagates a %s HTTP error without updating the artifact",
      async (source) => {
        const harness = createHarness();
        const targetUri = sourceUriByName[source];
        harness.transport.mockImplementation(async (uri) => {
          if (uri === targetUri) {
            return jsonResponse({ message: "fixture service unavailable" }, 503);
          }
          return validResponseForUri(uri);
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
          /503/u,
        );
        expectNoFallbackTransportRequests(harness.transport);
        expectArtifactUnchanged(harness);
      },
    );

    it.each(sources)(
      "propagates a %s JSON decode error without updating the artifact",
      async (source) => {
        const harness = createHarness();
        const targetUri = sourceUriByName[source];
        harness.transport.mockImplementation(async (uri) => {
          if (uri === targetUri) {
            return {
              ok: true,
              status: 200,
              json: async () => {
                throw new SyntaxError(`${source} JSON is invalid`);
              },
            };
          }
          return validResponseForUri(uri);
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
          `${source} JSON is invalid`,
        );
        expectNoFallbackTransportRequests(harness.transport);
        expectArtifactUnchanged(harness);
      },
    );
  });

  describe("route destinations from the published category dictionary", () => {
    it("writes one category per code in dictionary order and omits dictionary categories without entries", async () => {
      const harness = createHarness();

      const artifact = (await invokeGenerator(
        moduleState,
        harness.options,
      )) as {
        sourceUris: Record<string, string>;
        sources: { routeDestinations: unknown; mainFacilities?: unknown };
      };

      expect(artifact.sources.routeDestinations).toEqual(expectedRouteDestinations);
      expect(artifact.sources).not.toHaveProperty("mainFacilities");
      expect(artifact.sourceUris).toEqual({
        placesJsonLdUri: PLACES_URI,
        osmMirrorUri: OSM_MIRROR_URI,
              townGeoJsonUri: TOWN_GEOJSON_URI,
        categoryNamesUri: CATEGORY_NAMES_URI,
        wikidataMirrorUri: WIKIDATA_MIRROR_URI,
      });
      expect(JSON.stringify(artifact.sources.routeDestinations)).not.toContain("神保町シアター");
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expect(harness.artifactState.current).toBe(artifact);
    });

    it("does not merge different codes into one category", async () => {
      const places = {
        ...validPlacesJsonLd,
        "@graph": [
          placeRecord(ID.cityOffice, {
            codes: ["1302"],
            seeAlso: ["https://www.openstreetmap.org/node/1"],
          }),
          placeRecord(ID.library, {
            lat: LIBRARY_LAT,
            lng: LIBRARY_LNG,
            codes: ["1304"],
            seeAlso: ["https://www.openstreetmap.org/way/2"],
          }),
        ],
      };
      const harness = createHarness(
        { placesJsonLd: places },
        {
          catalog: catalogWith({}, [
            { id: ID.cityOffice, name: "区役所", includeInRouteForm: true },
            { id: ID.library, name: "出張所", includeInRouteForm: true },
          ]),
        },
      );

      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { routeDestinations: unknown[] };
      };

      expect(artifact.sources.routeDestinations).toEqual([
        {
          category: "市役所・東京都の区役所",
          categoryId: "1302",
          locations: [{ name: "千代田区役所", lat: LAT, lng: LNG }],
        },
        {
          category: "役場支所及び出張所",
          categoryId: "1304",
          locations: [
            {
              name: "千代田区立千代田図書館",
              lat: LIBRARY_LAT,
              lng: LIBRARY_LNG,
            },
          ],
        },
      ]);
    });

    it("uses the OSM name instead of the catalog name", async () => {
      const harness = createHarness();

      const artifact = (await invokeGenerator(
        moduleState,
        harness.options,
      )) as { sources: { routeDestinations: Array<{ locations: Array<{ name: string }> }> } };

      const names = artifact.sources.routeDestinations.flatMap((category) =>
        category.locations.map((location) => location.name),
      );
      expect(names).toEqual(["千代田区立千代田図書館", "千代田区役所"]);
      expect(names).not.toContain("目録の区役所");
    });

    it("fails when a selected catalog ID is missing from the public JSON-LD", async () => {
      const harness = createHarness(
        {},
        { catalog: selectOnly(ID.missing) },
      );

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
        new RegExp(ID.missing, "u"),
      );
      expectArtifactUnchanged(harness);
    });

    it.each([
      ["string latitude", { lat: "35.694" }],
      ["non-finite latitude", { lat: Number.NaN }],
      ["missing longitude", { lng: undefined }],
      ["out-of-range latitude", { lat: 135.694 }],
    ])("fails when the selected record has an invalid coordinate: %s", async (_label, overrides) => {
      const harness = createHarness(
        { placesJsonLd: graphWith({ "schema:geo": {
          "@type": "schema:GeoCoordinates",
          "schema:latitude": "lat" in overrides ? overrides.lat : LAT,
          "schema:longitude": "lng" in overrides ? overrides.lng : LNG,
        } }) },
      );

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });

    it("fails when the selected record has no gif-poi code", async () => {
      const harness = createHarness(
        { placesJsonLd: graphWith({ "schema:identifier": [] }) },
        { catalog: selectOnly(ID.cityOffice) },
      );

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
        /gif-poi|分類/u,
      );
      expectArtifactUnchanged(harness);
    });

    it("fails when the selected record has multiple gif-poi codes", async () => {
      const harness = createHarness(
        { placesJsonLd: graphWith({
          "schema:identifier": [
            { "@type": "schema:PropertyValue", "schema:propertyID": "gif-poi", "schema:value": "1302" },
            { "@type": "schema:PropertyValue", "schema:propertyID": "gif-poi", "schema:value": "1304" },
          ],
        }) },
        { catalog: selectOnly(ID.cityOffice) },
      );

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
        /gif-poi|分類/u,
      );
      expectArtifactUnchanged(harness);
    });

    it("fails when the selected record has an unknown gif-poi code", async () => {
      const harness = createHarness(
        { placesJsonLd: graphWith({
          "schema:identifier": [
            { "@type": "schema:PropertyValue", "schema:propertyID": "gif-poi", "schema:value": "9999" },
          ],
        }) },
        { catalog: selectOnly(ID.cityOffice) },
      );

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
        /9999|辞書/u,
      );
      expectArtifactUnchanged(harness);
    });

    it.each([
      [
        "the root is not a DefinedTermSet",
        { ...validCategoryNames, "@type": "schema:Thing" },
      ],
      [
        "the term list is empty",
        { ...validCategoryNames, "schema:hasDefinedTerm": [] },
      ],
      [
        "the term list is missing",
        { ...validCategoryNames, "schema:hasDefinedTerm": undefined },
      ],
      [
        "a term has no four-digit code",
        {
          ...validCategoryNames,
          "schema:hasDefinedTerm": [categoryTerm("13", "市役所")],
        },
      ],
      [
        "a term has an empty name",
        {
          ...validCategoryNames,
          "schema:hasDefinedTerm": [categoryTerm("1302", "   ")],
        },
      ],
      [
        "two terms share a code",
        {
          ...validCategoryNames,
          "schema:hasDefinedTerm": [
            categoryTerm("1302", "市役所"),
            categoryTerm("1302", "区役所"),
          ],
        },
      ],
    ])("fails when the dictionary is malformed: %s", async (_label, payload) => {
      const harness = createHarness({ categoryNames: payload });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });

    it("ignores a catalog group and uses the dictionary category", async () => {
      const harness = createHarness(
        {},
        {
          catalog: catalogWith({}, [
            {
              id: ID.cityOffice,
              name: "目録の名前",
              group: "disability-support",
              includeInRouteForm: true,
            },
          ]),
        },
      );

      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { routeDestinations: unknown[] };
      };

      expect(artifact.sources.routeDestinations).toEqual([
        {
          category: "市役所・東京都の区役所",
          categoryId: "1302",
          locations: [{ name: "千代田区役所", lat: LAT, lng: LNG }],
        },
      ]);
      expect(JSON.stringify(artifact.sources.routeDestinations)).not.toContain(
        "disability-support",
      );
    });

    it("skips a selected record with no OSM association", async () => {
      const places = graphWith({ "rdfs:seeAlso": ["https://www.wikidata.org/entity/Q1"] });
      const harness = createHarness(
        { placesJsonLd: places },
        { catalog: selectOnly(ID.cityOffice) },
      );

      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { routeDestinations: unknown[] };
      };

      expect(artifact.sources.routeDestinations).toEqual([]);
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });

    it("skips a selected record whose OSM element is missing from the mirror", async () => {
      const harness = createHarness(
        { osmMirror: { ...validOsmMirror, elements: [] } },
        { catalog: selectOnly(ID.cityOffice) },
      );

      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { routeDestinations: unknown[] };
      };

      expect(artifact.sources.routeDestinations).toEqual([]);
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });

    it("skips a selected record whose OSM element has no name", async () => {
      const harness = createHarness(
        { osmMirror: osmWith({ tags: {} }, 0) },
        { catalog: selectOnly(ID.cityOffice) },
      );

      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { routeDestinations: unknown[] };
      };

      expect(artifact.sources.routeDestinations).toEqual([]);
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });

    it("keeps other selected entries when one has no OSM name", async () => {
      const places = graphWith({ "rdfs:seeAlso": ["https://www.wikidata.org/entity/Q1"] });
      const harness = createHarness(
        { placesJsonLd: places },
        { catalog: catalogWith({}, validCatalog.places) },
      );

      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { routeDestinations: unknown[] };
      };

      expect(artifact.sources.routeDestinations).toEqual([
        {
          category: "図書館",
          categoryId: "1512",
          locations: [
            { name: "千代田区立千代田図書館", lat: LIBRARY_LAT, lng: LIBRARY_LNG },
          ],
        },
      ]);
    });

    it("fails when the catalog places URI does not match appConfig", async () => {
      const harness = createHarness(
        {},
        { catalog: catalogWith({ placesUri: "https://fixtures.example.test/other.jsonld" }) },
      );

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
        /一致|places/u,
      );
      expect(harness.transport).not.toHaveBeenCalled();
      expectArtifactUnchanged(harness);
    });

    it("fails when the catalog OSM mirror URI does not match appConfig", async () => {
      const harness = createHarness(
        {},
        { catalog: catalogWith({ osmMirrorUri: "https://fixtures.example.test/other-osm.json" }) },
      );

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
        /一致|osm/u,
      );
      expect(harness.transport).not.toHaveBeenCalled();
      expectArtifactUnchanged(harness);
    });

    it("fails when the destination catalog is malformed", async () => {
      const harness = createHarness({}, { catalog: { source: {}, places: "no" } });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expect(harness.transport).not.toHaveBeenCalled();
      expectArtifactUnchanged(harness);
    });
  });

  describe("locations projection for accessibility", () => {
    function accessiblePlaces() {
      const base = structuredClone(validPlacesJsonLd) as {
        "@graph": Array<Record<string, unknown>>;
      };
      const city = base["@graph"][0] as Record<string, unknown>;
      city["schema:image"] = {
        "@type": "schema:ImageObject",
        "schema:contentUrl": "https://fixtures.example.test/images/city.jpg",
        "schema:license": "https://creativecommons.org/licenses/by-sa/3.0/",
        "schema:creator": {
          "@type": "schema:Person",
          "schema:name": "さくら",
        },
      };
      city["schema:subjectOf"] = [
        {
          "@type": "schema:WebPage",
          "schema:name": "東京バリアフリーマップ",
          "schema:url": "https://fixtures.example.test/bfm/city",
        },
      ];
      const library = base["@graph"][1] as Record<string, unknown>;
      library["schema:image"] = {
        "@type": "schema:ImageObject",
        "schema:contentUrl": "https://fixtures.example.test/images/lib.jpg",
        "schema:license": "https://creativecommons.org/licenses/by-sa/4.0/",
        "schema:creator": {
          "@type": "schema:Person",
          "schema:name": "たろう",
        },
      };
      library["schema:subjectOf"] = [
        {
          "@type": "schema:WebPage",
          "schema:name": "言葉の道案内",
          "schema:url": "https://fixtures.example.test/guide/lib",
        },
        {
          "@type": "schema:WebPage",
          "schema:name": "壊れたリンク",
          "schema:url": "not-a-uri",
        },
      ];
      base["@graph"].push(
        placeRecord(ID.outsideCatalog, {
          codes: ["1304"],
          seeAlso: ["https://www.openstreetmap.org/node/4"],
        }),
      );
      return base;
    }

    function accessibleOsm() {
      return {
        version: "202611170100",
        elements: [
          { type: "node", id: 1, lat: LAT, lon: LNG, tags: { name: "千代田区役所", wheelchair: "yes" } },
          { type: "way", id: 2, lat: LIBRARY_LAT, lon: LIBRARY_LNG, tags: { name: "千代田区立千代田図書館", wheelchair: "limited" } },
          { type: "node", id: 3, lat: LAT, lng: LNG, tags: { name: "神保町シアター", wheelchair: "no" } },
          { type: "node", id: 4, lat: LAT, lon: LNG, tags: { name: "目録外の施設", wheelchair: "yes" } },
        ],
      };
    }

    it("projects only catalog records with OSM names into dictionary-ordered locations", async () => {
      const harness = createHarness({
        placesJsonLd: accessiblePlaces(),
        osmMirror: accessibleOsm(),
      });
      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { locations: Array<{ category: string; categoryId: string; locations: Array<Record<string, unknown>> }> };
        derivedRegions: Record<string, string>;
      };
      expect(artifact.sources.locations).toBeDefined();
      expect(artifact.sources.locations.map((c) => c.categoryId)).toEqual(["1512", "1302", "1011"]);
      expect(
        artifact.sources.locations.flatMap((c) => c.locations).map((l) => l["id"]),
      ).toEqual([ID.library, ID.cityOffice, ID.cinema]);
      const cityEntry = artifact.sources.locations
        .flatMap((c) => c.locations)
        .find((l) => l["id"] === ID.cityOffice);
      expect(cityEntry).toMatchObject({
        id: ID.cityOffice,
        name: "千代田区役所",
        lat: LAT,
        lng: LNG,
        osmElement: { type: "node", id: 1 },
        wheelchair: "yes",
        imageUri: "https://fixtures.example.test/images/city.jpg",
        imageCreator: "さくら",
        imageLicense: "https://creativecommons.org/licenses/by-sa/3.0/",
      });
      expect(cityEntry?.["relatedPages"]).toEqual([
        { name: "東京バリアフリーマップ", url: "https://fixtures.example.test/bfm/city" },
      ]);
      const libraryEntry = artifact.sources.locations
        .flatMap((c) => c.locations)
        .find((l) => l["id"] === ID.library);
      expect(libraryEntry).toMatchObject({
        osmElement: { type: "way", id: 2 },
        wheelchair: "limited",
      });
      expect(libraryEntry?.["relatedPages"]).toEqual([
        { name: "言葉の道案内", url: "https://fixtures.example.test/guide/lib" },
      ]);
      expect(artifact.derivedRegions[ID.cityOffice]).toBe("神田和泉町");
      expect(artifact.derivedRegions[ID.library]).toBe("神田和泉町");
    });

    it("excludes records without OSM names and maps unknown wheelchair to null", async () => {
      const places = accessiblePlaces() as { "@graph": Array<Record<string, unknown>> };
      places["@graph"][2]["rdfs:seeAlso"] = ["https://www.wikidata.org/entity/Q1"];
      const osm = {
        version: "202611170100",
        elements: [
          { type: "node", id: 1, lat: LAT, lon: LNG, tags: { name: "千代田区役所", wheelchair: "bogus" } },
          { type: "way", id: 2, lat: LIBRARY_LAT, lon: LIBRARY_LNG, tags: { name: "千代田区立千代田図書館" } },
        ],
      };
      const harness = createHarness({ placesJsonLd: places, osmMirror: osm });
      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { locations: Array<{ locations: Array<Record<string, unknown>> }> };
      };
      const all = artifact.sources.locations.flatMap((c) => c.locations);
      expect(all.find((l) => l["id"] === ID.cinema)).toBeUndefined();
      expect(all.find((l) => l["id"] === ID.cityOffice)?.["wheelchair"]).toBeNull();
      expect(all.find((l) => l["id"] === ID.library)?.["wheelchair"]).toBeNull();
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });

    it("drops records outside the destination catalog before reading their coordinates or category code", async () => {
      const places = accessiblePlaces() as { "@graph": Array<Record<string, unknown>> };
      const outside = places["@graph"][3] as Record<string, unknown>;
      delete outside["schema:geo"];
      delete outside["schema:identifier"];
      delete outside["rdfs:seeAlso"];
      const harness = createHarness({
        placesJsonLd: places,
        osmMirror: accessibleOsm(),
      });

      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { locations: Array<{ locations: Array<Record<string, unknown>> }> };
      };

      const all = artifact.sources.locations.flatMap((c) => c.locations);
      expect(all.map((l) => l["id"])).toEqual([
        ID.library,
        ID.cityOffice,
        ID.cinema,
      ]);
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });

    it("keeps catalog entries without an OSM name out of the location list and still succeeds", async () => {
      const catalog = catalogWith({}, [
        ...validCatalog.places,
        { id: ID.missing, name: "目録だけの施設", includeInRouteForm: false },
      ]);
      const harness = createHarness(
        {
          placesJsonLd: accessiblePlaces(),
          osmMirror: accessibleOsm(),
        },
        { catalog },
      );

      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { locations: Array<{ locations: Array<Record<string, unknown>> }> };
      };

      const all = artifact.sources.locations.flatMap((c) => c.locations);
      expect(all.find((l) => l["id"] === ID.missing)).toBeUndefined();
      expect(all).toHaveLength(3);
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });

    it("keeps route destinations unchanged by the location catalog filter", async () => {
      const harness = createHarness({
        placesJsonLd: accessiblePlaces(),
        osmMirror: accessibleOsm(),
      });

      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { routeDestinations: unknown };
      };

      expect(artifact.sources.routeDestinations).toEqual(expectedRouteDestinations);
    });

    it("skips images without attribution and keeps other locations", async () => {
      const places = accessiblePlaces() as { "@graph": Array<Record<string, unknown>> };
      (places["@graph"][0] as Record<string, unknown>)["schema:image"] = {
        "@type": "schema:ImageObject",
        "schema:contentUrl": "https://fixtures.example.test/images/city.jpg",
      };
      const harness = createHarness({ placesJsonLd: places, osmMirror: accessibleOsm() });
      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { locations: Array<{ locations: Array<Record<string, unknown>> }> };
      };
      const cityEntry = artifact.sources.locations
        .flatMap((c) => c.locations)
        .find((l) => l["id"] === ID.cityOffice);
      expect(cityEntry?.["imageUri"]).toBeUndefined();
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });

    it("keeps an image whose license is recorded as text", async () => {
      const places = accessiblePlaces() as { "@graph": Array<Record<string, unknown>> };
      (places["@graph"][0] as Record<string, unknown>)["schema:image"] = {
        "@type": "schema:ImageObject",
        "schema:contentUrl": "https://fixtures.example.test/images/city.jpg",
        "schema:license": "Public domain",
        "schema:creator": {
          "@type": "schema:Person",
          "schema:name": "さくら",
        },
      };
      const harness = createHarness({ placesJsonLd: places, osmMirror: accessibleOsm() });
      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { locations: Array<{ locations: Array<Record<string, unknown>> }> };
      };
      const cityEntry = artifact.sources.locations
        .flatMap((c) => c.locations)
        .find((l) => l["id"] === ID.cityOffice);
      expect(cityEntry).toMatchObject({
        imageUri: "https://fixtures.example.test/images/city.jpg",
        imageCreator: "さくら",
        imageLicense: "Public domain",
      });
    });

    it.each([
      ["empty", ""],
      ["whitespace", "   "],
    ])("skips an image whose license is %s", async (_caseName, license) => {
      const places = accessiblePlaces() as { "@graph": Array<Record<string, unknown>> };
      (places["@graph"][0] as Record<string, unknown>)["schema:image"] = {
        "@type": "schema:ImageObject",
        "schema:contentUrl": "https://fixtures.example.test/images/city.jpg",
        "schema:license": license,
        "schema:creator": {
          "@type": "schema:Person",
          "schema:name": "さくら",
        },
      };
      const harness = createHarness({ placesJsonLd: places, osmMirror: accessibleOsm() });
      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { locations: Array<{ locations: Array<Record<string, unknown>> }> };
      };
      const cityEntry = artifact.sources.locations
        .flatMap((c) => c.locations)
        .find((l) => l["id"] === ID.cityOffice);
      expect(cityEntry?.["imageUri"]).toBeUndefined();
      expect(cityEntry?.["imageLicense"]).toBeUndefined();
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });

    it("fails when the same urn:uuid appears twice", async () => {
      const places = accessiblePlaces() as { "@graph": Array<Record<string, unknown>> };
      places["@graph"].push(structuredClone(places["@graph"][0]));
      const harness = createHarness({ placesJsonLd: places, osmMirror: accessibleOsm() });
      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(/重複|duplicate/u);
      expectArtifactUnchanged(harness);
    });

    it("fails when a location record has an unknown gif-poi code", async () => {
      const places = accessiblePlaces() as { "@graph": Array<Record<string, unknown>> };
      (places["@graph"][0] as Record<string, unknown>)["schema:identifier"] = [
        { "@type": "schema:PropertyValue", "schema:propertyID": "gif-poi", "schema:value": "9999" },
      ];
      const harness = createHarness({ placesJsonLd: places, osmMirror: accessibleOsm() });
      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(/9999|辞書/u);
      expectArtifactUnchanged(harness);
    });
  });

  describe("location facts projection", () => {
    function factsOsm() {
      return {
        version: "202611170100",
        elements: [
          { type: "node", id: 1, lat: LAT, lon: LNG, tags: { name: "千代田区役所", phone: "+81-3-32642111", website: "https://www.city.chiyoda.lg.jp/", wikipedia: "ja:千代田区役所", wikidata: "Q11405293" } },
          { type: "way", id: 2, lat: LIBRARY_LAT, lon: LIBRARY_LNG, tags: { name: "千代田区立千代田図書館", "contact:phone": "03-5211-4290", "contact:website": "https://www.library.chiyoda.tokyo.jp/chiyoda/", wikidata: "Q61886796" } },
          { type: "node", id: 3, lat: LAT, lon: LNG, tags: { name: "神保町シアター", phone: "invalid", website: "not-a-uri", wikipedia: "xx" } },
        ],
      };
    }

    function factsPlaces() {
      const base = structuredClone(validPlacesJsonLd) as { "@graph": Array<Record<string, unknown>> };
      return base;
    }

    it("normalizes phone numbers and resolves website priority", async () => {
      const harness = createHarness({ osmMirror: factsOsm(), placesJsonLd: factsPlaces() });
      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { locations: Array<{ locations: Array<Record<string, unknown>> }> };
      };
      const all = artifact.sources.locations.flatMap((c) => c.locations);
      const city = all.find((l) => l["id"] === ID.cityOffice);
      expect(city?.["phone"]).toEqual({ display: "03-3264-2111", tel: "tel:0332642111" });
      expect(city?.["websiteUri"]).toBe("https://www.city.chiyoda.lg.jp/");
      expect(city?.["osmEditUrl"]).toBe("https://www.openstreetmap.org/edit?node=1");
    });

    it("prefers contact:phone and contact:website when primary tags are missing", async () => {
      const harness = createHarness({ osmMirror: factsOsm(), placesJsonLd: factsPlaces() });
      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { locations: Array<{ locations: Array<Record<string, unknown>> }> };
      };
      const all = artifact.sources.locations.flatMap((c) => c.locations);
      const lib = all.find((l) => l["id"] === ID.library);
      expect(lib?.["phone"]).toEqual({ display: "03-5211-4290", tel: "tel:0352114290" });
      expect(lib?.["websiteUri"]).toBe("https://www.library.chiyoda.tokyo.jp/chiyoda/");
      expect(lib?.["osmEditUrl"]).toBe("https://www.openstreetmap.org/edit?way=2");
    });

    it("hides invalid phone and website but keeps other locations", async () => {
      const harness = createHarness({ osmMirror: factsOsm(), placesJsonLd: factsPlaces() });
      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { locations: Array<{ locations: Array<Record<string, unknown>> }> };
      };
      const all = artifact.sources.locations.flatMap((c) => c.locations);
      const cinema = all.find((l) => l["id"] === ID.cinema);
      expect(cinema?.["phone"]).toBeUndefined();
      expect(cinema?.["websiteUri"]).toBeUndefined();
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });

    it("resolves wikipedia via OSM ja, wikidata jawiki, OSM other, wikidata enwiki", async () => {
      const harness = createHarness({ osmMirror: factsOsm(), placesJsonLd: factsPlaces() });
      const artifact = (await invokeGenerator(moduleState, harness.options)) as {
        sources: { locations: Array<{ locations: Array<Record<string, unknown>> }> };
      };
      const all = artifact.sources.locations.flatMap((c) => c.locations);
      const city = all.find((l) => l["id"] === ID.cityOffice);
      expect(city?.["wikipediaUri"]).toBe("https://ja.wikipedia.org/wiki/%E5%8D%83%E4%BB%A3%E7%94%B0%E5%8C%BA%E5%BD%B9%E6%89%80");
      const lib = all.find((l) => l["id"] === ID.library);
      expect(lib?.["wikipediaUri"]).toBe("https://en.wikipedia.org/wiki/Chiyoda_Library");
    });

    it("fails when wikidata mirror cannot be fetched", async () => {
      const harness = createHarness();
      const targetUri = sourceUriByName.wikidataMirror;
      harness.transport.mockImplementation(async (uri) => {
        if (uri === targetUri) {
          throw new Error("wikidataMirror transport unavailable");
        }
        return validResponseForUri(uri);
      });
      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow("wikidataMirror transport unavailable");
      expectArtifactUnchanged(harness);
    });

    it("fails when wikidata mirror is malformed", async () => {
      const harness = createHarness({ wikidataMirror: { entities: null } });
      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });
  });

  describe("location image generation", () => {
    const COMMONS_CITY =
      "https://upload.wikimedia.org/wikipedia/commons/3/3d/City.jpg";
    const COMMONS_LIBRARY =
      "https://upload.wikimedia.org/wikipedia/commons/a/ab/Library.jpg";
    const CITY_SOURCE_URL =
      "https://commons.wikimedia.org/wiki/Special:FilePath/City.jpg?width=1280";
    const LIBRARY_SOURCE_URL =
      "https://commons.wikimedia.org/wiki/Special:FilePath/Library.jpg?width=1280";

    function placesWithImages(): { "@graph": Array<Record<string, unknown>> } {
      const base = structuredClone(validPlacesJsonLd) as {
        "@graph": Array<Record<string, unknown>>;
      };
      const image = (contentUrl: string) => ({
        "@type": "schema:ImageObject",
        "schema:contentUrl": contentUrl,
        "schema:license": "https://creativecommons.org/licenses/by-sa/4.0/",
        "schema:creator": {
          "@type": "schema:Person",
          "schema:name": "さくら",
        },
      });
      base["@graph"][0]["schema:image"] = image(COMMONS_CITY);
      base["@graph"][1]["schema:image"] = image(COMMONS_LIBRARY);
      base["@graph"][2]["schema:image"] = image(
        "https://example.test/images/cinema.jpg",
      );
      return base;
    }

    function encodedImage(
      width = 1600,
      height = 1200,
    ): EncodedImage {
      return {
        width,
        height,
        variants: [480, 960, 1280].map((variantWidth) => ({
          width: variantWidth,
          height: Math.round((height * variantWidth) / width),
          bytes: new Uint8Array([width, variantWidth]),
        })),
      };
    }

    function artifactLocations(artifact: unknown): Array<Record<string, unknown>> {
      const categories = (artifact as {
        sources: { locations: Array<{ locations: Array<Record<string, unknown>> }> };
      }).sources.locations;
      return categories.flatMap((category) => category.locations);
    }

    function pngResponse(bytes: Uint8Array): ImageFetchResponse {
      return {
        ok: true,
        status: 200,
        bytes: async () => bytes,
      };
    }

    it("fetches commons photos from Special:FilePath at 1280px and drops other hosts", async () => {
      const harness = createHarness(
        { placesJsonLd: placesWithImages() },
        {
          images: {
            fetch: jest.fn(async (uri) => pngResponse(new Uint8Array([uri.length]))),
            encode: jest.fn(async () => encodedImage()),
          },
        },
      );

      const artifact = await invokeGenerator(moduleState, harness.options);
      const locations = artifactLocations(artifact);
      const city = locations.find((location) => location["id"] === ID.cityOffice);
      const library = locations.find((location) => location["id"] === ID.library);
      const cinema = locations.find((location) => location["id"] === ID.cinema);

      const requestedUris = harness.images.fetch.mock.calls.map(([uri]) => uri);
      expect(requestedUris).toEqual(
        expect.arrayContaining([CITY_SOURCE_URL, LIBRARY_SOURCE_URL]),
      );
      expect(requestedUris).toHaveLength(2);
      expect(requestedUris).not.toContain(
        "https://example.test/images/cinema.jpg",
      );

      expect(harness.images.clean).toHaveBeenCalledTimes(1);
      const [cleanOrder] = harness.images.clean.mock.invocationCallOrder;
      const [fetchOrder] = harness.images.fetch.mock.invocationCallOrder;
      expect(cleanOrder).toBeLessThan(fetchOrder);

      for (const entry of [city, library]) {
        expect(entry?.["image"]).toMatchObject({
          width: 1600,
          height: 1200,
        });
        const variants = (entry?.["image"] as {
          variants: Array<{ width: number; path: string }>;
        }).variants;
        expect(variants.map((variant) => variant.width)).toEqual([
          480, 960, 1280,
        ]);
        for (const variant of variants) {
          expect(variant.path).toMatch(
            /^\/generated\/location-images\/[0-9a-f]{16}-(480|960|1280)\.webp$/u,
          );
        }
      }

      expect(cinema?.["image"]).toBeUndefined();
      expect(cinema?.["imageUri"]).toBe("https://example.test/images/cinema.jpg");
      expect(harness.images.write).toHaveBeenCalledTimes(6);
      expect(harness.images.warn).toHaveBeenCalledWith(
        expect.stringMatching(/1件/u),
      );
    });

    it("plans widths without enlargement and names files by content hash", () => {
      const plannedImageWidths = getPublicFunction(
        moduleState,
        "plannedImageWidths",
      );
      expect(plannedImageWidths(700)).toEqual([480, 700]);
      expect(plannedImageWidths(1280)).toEqual([480, 960, 1280]);
      expect(plannedImageWidths(4000)).toEqual([480, 960, 1280]);

      const locationImageFileName = getPublicFunction(
        moduleState,
        "locationImageFileName",
      );
      const bytes = new Uint8Array([1, 2, 3]);
      const fileName = locationImageFileName(bytes, 480) as string;
      expect(fileName).toMatch(/^[0-9a-f]{16}-480\.webp$/u);
      expect(locationImageFileName(bytes, 480)).toBe(fileName);
      expect(locationImageFileName(new Uint8Array([3, 2, 1]), 480)).not.toBe(
        fileName,
      );
      expect(locationImageFileName(bytes, 960)).not.toBe(fileName);
    });

    it("keeps the same generated image paths for the same source bytes", async () => {
      const generate = async () => {
        const harness = createHarness(
          { placesJsonLd: placesWithImages() },
          {
            images: {
              fetch: jest.fn(async () => pngResponse(new Uint8Array([42]))),
              encode: jest.fn(async () => encodedImage()),
            },
          },
        );
        const artifact = await invokeGenerator(moduleState, harness.options);
        return artifactLocations(artifact)
          .map((location) => location["image"])
          .filter((image) => image !== undefined);
      };

      expect(await generate()).toEqual(await generate());
    });

    it("retries 429 after Retry-After and keeps the failed photo count", async () => {
      let cityAttempts = 0;
      const harness = createHarness(
        { placesJsonLd: placesWithImages() },
        {
          images: {
            fetch: jest.fn(async (uri) => {
              if (uri === CITY_SOURCE_URL) {
                cityAttempts += 1;
                if (cityAttempts === 1) {
                  return {
                    ok: false,
                    status: 429,
                    retryAfterSeconds: 1,
                    bytes: async () => new Uint8Array(),
                  };
                }
                return pngResponse(new Uint8Array([7]));
              }
              return {
                ok: false,
                status: 503,
                retryAfterSeconds: null,
                bytes: async () => new Uint8Array(),
              };
            }),
            encode: jest.fn(async () => encodedImage(1280, 853)),
          },
        },
      );

      const artifact = await invokeGenerator(moduleState, harness.options);
      const locations = artifactLocations(artifact);
      const city = locations.find((location) => location["id"] === ID.cityOffice);
      const library = locations.find((location) => location["id"] === ID.library);
      const libraryAttempts = harness.images.fetch.mock.calls.filter(
        ([uri]) => uri === LIBRARY_SOURCE_URL,
      );

      expect(cityAttempts).toBe(2);
      expect(libraryAttempts).toHaveLength(4);
      expect(harness.images.sleep).toHaveBeenCalledWith(1000);
      expect(city?.["image"]).toBeDefined();
      expect(library?.["image"]).toBeUndefined();
      expect(harness.images.warn).toHaveBeenCalledWith(
        expect.stringMatching(/2件/u),
      );
    });
  });

  describe("town GeoJSON validation", () => {
    it("rejects a town GeoJSON that is not a FeatureCollection", async () => {
      const harness = createHarness({
        townGeoJson: { ...validTownGeoJson, type: "Feature" },
      });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });

    it("rejects a non-finite town GeoJSON coordinate", async () => {
      const harness = createHarness({
        townGeoJson: {
          ...validTownGeoJson,
          features: [
            {
              ...validTownGeoJson.features[0],
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [Number.NaN, 35.6],
                    ...polygonCoordinates[0].slice(1),
                  ],
                ],
              },
            },
          ],
        },
      });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });

    it("derives display regions from the town GeoJSON", async () => {
      const harness = createHarness();

      const artifact = (await invokeGenerator(
        moduleState,
        harness.options,
      )) as { derivedRegions: Record<string, string> };

      expect(artifact.derivedRegions).toEqual({
        [ID.cityOffice]: "神田和泉町",
        [ID.library]: "神田和泉町",
        [ID.cinema]: "神田和泉町",
      });
    });
  });

  describe("atomic validated-artifact output", () => {
    it("writes only after every source is verified", async () => {
      const harness = createHarness();
      harness.transport.mockImplementation(async (uri) => {
        expect(harness.writeArtifact).not.toHaveBeenCalled();
        return validResponseForUri(uri);
      });

      await invokeGenerator(moduleState, harness.options);

      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expect(harness.artifactState.current).toEqual(
        expect.objectContaining({
          status: "validated",
          sources: expect.objectContaining({
            routeDestinations: expectedRouteDestinations,
                      townGeoJson: validTownGeoJson,
          }),
        }),
      );
    });

    it("propagates an atomic writer failure without exposing a partial artifact", async () => {
      const harness = createHarness();
      harness.writeArtifact.mockRejectedValue(new Error("atomic temp-file rename failed"));

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
        "atomic temp-file rename failed",
      );

      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expectArtifactUnchanged(harness, 1);
    });

    it("does not update the previous artifact when town GeoJSON is invalid", async () => {
      const harness = createHarness({ townGeoJson: { type: "Feature" } });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });
  });
});

type FixtureServer = {
  uriBySource: Record<SourceName, string>;
  requestedUris: string[];
  close: () => Promise<void>;
};

const sourcePathByName: Record<SourceName, string> = {
  placesJsonLd: "/fixtures/places.jsonld",
  osmMirror: "/fixtures/osm.json",
  townGeoJson: "/fixtures/town.geojson",
  categoryNames: "/fixtures/category-names.jsonld",
  wikidataMirror: "/fixtures/wikidata.json",
};

async function createFixtureServer(): Promise<FixtureServer> {
  let baseUrl = "";
  const requestedUris: string[] = [];
  const server = createServer((request, response) => {
    const requestUrl = request.url ?? "/";
    const requestPath = requestUrl.split("?", 1)[0];
    const source = (Object.keys(sourcePathByName) as SourceName[]).find(
      (candidate) => sourcePathByName[candidate] === requestPath,
    );

    if (!source) {
      response.writeHead(404);
      response.end("fixture source not found");
      return;
    }

    requestedUris.push(`${baseUrl}${requestUrl}`);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(validPayloadBySource[source]));
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    throw new Error("fixture HTTP server did not expose a TCP address");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
  const uriBySource = (Object.keys(sourcePathByName) as SourceName[]).reduce(
    (uris, source) => {
      uris[source] = `${baseUrl}${sourcePathByName[source]}`;
      return uris;
    },
    {} as Record<SourceName, string>,
  );

  return {
    uriBySource,
    requestedUris,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      }),
  };
}

type PublicBuildRun = {
  exitCode: number | null;
  stderr: string;
  requestedUris: string[];
  configuredUris: string[];
  artifactKind: "file" | "directory" | "missing";
  artifactContents: string | null;
  atomicTempEntries: string[];
};

async function runPublicGeneratorCli(options: {
  catalog?: unknown;
  appConfig?: Record<string, unknown>;
} = {}): Promise<PublicBuildRun> {
  if (!existsSync(GENERATOR_CLI_PATH) || !existsSync(TSX_CLI_PATH)) {
    throw new Error(`generate-location-artifact public CLI is not implemented: ${GENERATOR_CLI_PATH}`);
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), "location-artifact-build-"));
  const generatedDirectory = join(temporaryRoot, "public", "generated");
  const artifactPath = join(generatedDirectory, "location-data.json");
  let fixtureServer: FixtureServer | null = null;

  try {
    await mkdir(generatedDirectory, { recursive: true });
    await mkdir(join(temporaryRoot, "data"), { recursive: true });
    fixtureServer = await createFixtureServer();

    const appConfig = {
      ...validAppConfig,
      placesJsonLdUri: fixtureServer.uriBySource.placesJsonLd,
      osmMirrorUri: fixtureServer.uriBySource.osmMirror,
      townGeoJsonUri: fixtureServer.uriBySource.townGeoJson,
      categoryNamesUri: fixtureServer.uriBySource.categoryNames,
      wikidataMirrorUri: fixtureServer.uriBySource.wikidataMirror,
      ...options.appConfig,
    };
    const source = {
      placesUri: appConfig.placesJsonLdUri,
      osmMirrorUri: appConfig.osmMirrorUri,
    };
    const catalog = options.catalog ?? { ...validCatalog, source };

    await writeFile(
      join(temporaryRoot, "app-config.json"),
      JSON.stringify(appConfig),
      "utf8",
    );
    await writeFile(
      join(temporaryRoot, "data", "destinations.json"),
      JSON.stringify(catalog),
      "utf8",
    );

    let exitCode: number | null = 0;
    let stderr = "";
    try {
      const processResult = await execFileAsync(
        process.execPath,
        [TSX_CLI_PATH, GENERATOR_CLI_PATH],
        {
          cwd: temporaryRoot,
          env: { ...process.env, FORCE_COLOR: "0" },
          encoding: "utf8",
          maxBuffer: 1024 * 1024,
          timeout: 30_000,
          killSignal: "SIGTERM",
        },
      );
      stderr = String(processResult.stderr ?? "");
    } catch (error: unknown) {
      const processError = error as { code?: unknown; stderr?: unknown };
      exitCode = typeof processError.code === "number" ? processError.code : 1;
      stderr = String(processError.stderr ?? "");
    }

    let artifactKind: PublicBuildRun["artifactKind"] = "missing";
    let artifactContents: string | null = null;
    try {
      const artifactStats = await stat(artifactPath);
      if (artifactStats.isDirectory()) {
        artifactKind = "directory";
      } else if (artifactStats.isFile()) {
        artifactKind = "file";
        artifactContents = await readFile(artifactPath, "utf8");
      }
    } catch {
      artifactKind = "missing";
    }

    const directoryEntries = await readdir(generatedDirectory).catch(() => []);

    return {
      exitCode,
      stderr,
      requestedUris: fixtureServer.requestedUris,
      configuredUris: Object.values(appConfig).filter(
        (uri): uri is string => typeof uri === "string" && uri.startsWith("http"),
      ),
      artifactKind,
      artifactContents,
      atomicTempEntries: directoryEntries.filter(
        (entry) => entry !== "location-data.json",
      ),
    };
  } finally {
    await fixtureServer?.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

describe("public generator build lifecycle", () => {
  if (!existsSync(GENERATOR_CLI_PATH) || !existsSync(TSX_CLI_PATH)) {
    it("reports the missing public generator CLI as an actionable RED contract", () => {
      throw new Error(`public generator CLI is not implemented: ${GENERATOR_CLI_PATH}`);
    });
    return;
  }

  it("writes a validated artifact from the configured sources and catalog", async () => {
    const result = await runPublicGeneratorCli();

    expect(result.exitCode).toBe(0);
    expect(result.artifactKind).toBe("file");
    expect(result.artifactContents).not.toBeNull();
    expect(result.atomicTempEntries).toEqual([]);

    const artifact = JSON.parse(result.artifactContents ?? "") as {
      sources: { routeDestinations: unknown };
    };
    expect(artifact.sources.routeDestinations).toEqual(expectedRouteDestinations);
    expect(result.requestedUris.every((uri) => result.configuredUris.includes(uri))).toBe(true);
    expect(result.requestedUris).toHaveLength(5);
    expect(result.requestedUris.some((uri) => uri.includes("cdn.jsdelivr.net"))).toBe(false);
  });

  it("fails without writing the artifact when the catalog source does not match appConfig", async () => {
    const result = await runPublicGeneratorCli({
      catalog: {
        ...validCatalog,
        source: {
          placesUri: "https://fixtures.example.test/other.jsonld",
          osmMirrorUri: "https://fixtures.example.test/other-osm.json",
        },
      },
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/一致|places/u);
    expect(result.artifactKind).toBe("missing");
  });

  it("fails without writing the artifact when a source is unavailable", async () => {
    const result = await runPublicGeneratorCli({
      appConfig: { placesJsonLdUri: "http://127.0.0.1:1/places.jsonld" },
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.artifactKind).toBe("missing");
  });
});
