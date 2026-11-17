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

type SourceName = "placesJsonLd" | "osmMirror" | "keyLocations" | "townGeoJson";

type GeneratorOptions = {
  appConfig: unknown;
  destinationCatalog: unknown;
  transport: Transport;
  writeArtifact: ArtifactWriter;
};

type GeneratorHarness = {
  options: GeneratorOptions;
  transport: jest.MockedFunction<Transport>;
  writeArtifact: jest.MockedFunction<ArtifactWriter>;
  artifactState: { current: unknown };
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
const KEY_LOCATIONS_URI = "https://fixtures.example.test/key_locations.json";
const TOWN_GEOJSON_URI = "https://fixtures.example.test/chiyoda-towns.geojson";

const validAppConfig = {
  placesJsonLdUri: PLACES_URI,
  osmMirrorUri: OSM_MIRROR_URI,
  keyLocationsUri: KEY_LOCATIONS_URI,
  townGeoJsonUri: TOWN_GEOJSON_URI,
};

const LAT = 35.694;
const LNG = 139.753;
const LIBRARY_LAT = 35.695;
const LIBRARY_LNG = 139.754;

const ID = {
  cityOffice: "urn:uuid:00000000-0000-4000-8000-000000000001",
  library: "urn:uuid:00000000-0000-4000-8000-000000000002",
  cinema: "urn:uuid:00000000-0000-4000-8000-000000000003",
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

const validCatalog = {
  source: { placesUri: PLACES_URI, osmMirrorUri: OSM_MIRROR_URI },
  places: [
    { id: ID.cityOffice, name: "目録の区役所", includeInRouteForm: true },
    { id: ID.library, name: "目録の図書館", includeInRouteForm: true },
    { id: ID.cinema, name: "目録の映画館", includeInRouteForm: false },
  ],
};

const validKeyLocations = [
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
      },
    ],
  },
];

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
  keyLocations: KEY_LOCATIONS_URI,
  townGeoJson: TOWN_GEOJSON_URI,
};

const validPayloadBySource: Record<SourceName, unknown> = {
  placesJsonLd: validPlacesJsonLd,
  osmMirror: validOsmMirror,
  keyLocations: validKeyLocations,
  townGeoJson: validTownGeoJson,
};

const expectedRouteDestinations = [
  {
    category: "行政・相談",
    "category:en": "government-and-consultation",
    locations: [{ name: "千代田区役所", lat: LAT, lng: LNG }],
  },
  {
    category: "学び・図書館",
    "category:en": "learning-and-libraries",
    locations: [
      { name: "千代田区立千代田図書館", lat: LIBRARY_LAT, lng: LIBRARY_LNG },
    ],
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

function createHarness(
  payloadOverrides: Partial<Record<SourceName, unknown>> = {},
  options: { catalog?: unknown; appConfig?: unknown } = {},
): GeneratorHarness {
  const payloadByUri: Record<string, unknown> = {
    [PLACES_URI]: payloadOverrides.placesJsonLd ?? validPayloadBySource.placesJsonLd,
    [OSM_MIRROR_URI]: payloadOverrides.osmMirror ?? validPayloadBySource.osmMirror,
    [KEY_LOCATIONS_URI]: payloadOverrides.keyLocations ?? validPayloadBySource.keyLocations,
    [TOWN_GEOJSON_URI]: payloadOverrides.townGeoJson ?? validPayloadBySource.townGeoJson,
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

  return {
    options: {
      appConfig: options.appConfig ?? validAppConfig,
      destinationCatalog: options.catalog ?? validCatalog,
      transport,
      writeArtifact,
    },
    transport,
    writeArtifact,
    artifactState,
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
      ["keyLocationsUri", "keyLocationsUri"],
      ["townGeoJsonUri", "townGeoJsonUri"],
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

    it("uses the four configured URIs exactly once", async () => {
      const harness = createHarness();

      await invokeGenerator(moduleState, harness.options);

      expectNoFallbackTransportRequests(harness.transport);
      const requestedUris = harness.transport.mock.calls.map(([uri]) => uri);
      for (const uri of Object.values(sourceUriByName)) {
        expect(requestedUris.filter((requested) => requested === uri)).toHaveLength(1);
      }
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });
  });

  describe("transport, HTTP, and JSON decoding failures", () => {
    const sources: SourceName[] = [
      "placesJsonLd",
      "osmMirror",
      "keyLocations",
      "townGeoJson",
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

  describe("route destinations from the catalog", () => {
    it("writes only the selected entries, grouped in definition order and omitting empty groups", async () => {
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
        keyLocationsUri: KEY_LOCATIONS_URI,
        townGeoJsonUri: TOWN_GEOJSON_URI,
      });
      expect(JSON.stringify(artifact.sources.routeDestinations)).not.toContain("神保町シアター");
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expect(harness.artifactState.current).toBe(artifact);
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
      expect(names).toEqual(["千代田区役所", "千代田区立千代田図書館"]);
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
        /9999|グループ/u,
      );
      expectArtifactUnchanged(harness);
    });

    it("fails when the selected record has no OSM association", async () => {
      const places = graphWith({ "rdfs:seeAlso": ["https://www.wikidata.org/entity/Q1"] });
      const harness = createHarness(
        { placesJsonLd: places },
        { catalog: selectOnly(ID.cityOffice) },
      );

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
        /OSM|seeAlso/u,
      );
      expectArtifactUnchanged(harness);
    });

    it("fails when the OSM element is missing from the mirror", async () => {
      const harness = createHarness(
        { osmMirror: { ...validOsmMirror, elements: [] } },
        { catalog: selectOnly(ID.cityOffice) },
      );

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
        /OSM/u,
      );
      expectArtifactUnchanged(harness);
    });

    it("fails when the OSM element has no name", async () => {
      const harness = createHarness(
        { osmMirror: osmWith({ tags: {} }, 0) },
        { catalog: selectOnly(ID.cityOffice) },
      );

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
        /name|名前/u,
      );
      expectArtifactUnchanged(harness);
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

  describe("key locations and town GeoJSON validation", () => {
    it("rejects a key location without a name", async () => {
      const harness = createHarness({
        keyLocations: [
          {
            ...validKeyLocations[0],
            locations: [{ ...validKeyLocations[0].locations[0], name: undefined }],
          },
        ],
      });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });

    it("rejects duplicate key location IDs", async () => {
      const location = validKeyLocations[0].locations[0];
      const harness = createHarness({
        keyLocations: [
          { ...validKeyLocations[0], locations: [location, { ...location }] },
        ],
      });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });

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

      expect(artifact.derivedRegions).toEqual({ "kanda-library": "神田和泉町" });
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
            keyLocations: validKeyLocations,
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

    it("does not update the previous artifact when key locations are invalid", async () => {
      const harness = createHarness({ keyLocations: [] });

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
  keyLocations: "/fixtures/key-locations.json",
  townGeoJson: "/fixtures/town.geojson",
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
      keyLocationsUri: fixtureServer.uriBySource.keyLocations,
      townGeoJsonUri: fixtureServer.uriBySource.townGeoJson,
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
    expect(result.requestedUris).toHaveLength(4);
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
