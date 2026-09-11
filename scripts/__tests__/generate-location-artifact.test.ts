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

type BuildFailureMode = "transport" | "http" | "json";

type PublicBuildRun = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  notImplemented: boolean;
  requestedUris: string[];
  configuredUris: string[];
  artifactKind: "file" | "directory" | "missing";
  artifactContents: string | null;
  atomicTempEntries: string[];
};

type PublicBuildRunOptions = {
  appConfigOverrides?: Record<string, unknown>;
  payloadOverrides?: Partial<Record<SourceName, unknown>>;
  failureBySource?: Partial<Record<SourceName, BuildFailureMode>>;
  existingArtifact?: string;
  artifactAsDirectory?: boolean;
};

type SourceName = "mainFacilities" | "keyLocations" | "townGeoJson";

type GeneratorOptions = {
  appConfig: unknown;
  transport: Transport;
  writeArtifact: ArtifactWriter;
};

type ArtifactState = {
  current: unknown;
};

type GeneratorHarness = {
  options: GeneratorOptions;
  transport: jest.MockedFunction<Transport>;
  writeArtifact: jest.MockedFunction<ArtifactWriter>;
  artifactState: ArtifactState;
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
const NETWORK_GUARD_SOURCE = `
const allowedOrigin = process.env.LOCATION_ARTIFACT_FIXTURE_ORIGIN;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const href = typeof input === "string" ? input : input?.url ?? String(input);
  let origin = "";
  try {
    origin = new URL(href).origin;
  } catch {
    throw new Error("LOCATION_ARTIFACT_EXTERNAL_NETWORK_BLOCKED invalid URL");
  }
  if (origin !== allowedOrigin) {
    process.stderr.write(
      "LOCATION_ARTIFACT_EXTERNAL_NETWORK_BLOCKED " + href + "\\n",
    );
    throw new Error("external network blocked by generator contract");
  }
  return originalFetch(input, init);
};
`;

const validAppConfig = {
  mainFacilitiesUri: "https://fixtures.example.test/v2/main_facilities.json",
  keyLocationsUri: "https://fixtures.example.test/v2/key_locations.json",
  townGeoJsonUri: "https://fixtures.example.test/v2/chiyoda-towns.geojson",
  // This value is intentionally present to prove that URI fields are canonical.
  locationsDataVersion: "legacy-version-must-not-build-a-url",
};

const validMainFacilities = [
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
        imageUri: "https://fixtures.example.test/images/office.jpg",
        imageCopyright: "© Example",
        uri: "https://fixtures.example.test/office",
      },
    ],
  },
];

const validKeyLocations = [
  {
    category: "公共施設",
    "category:en": "public facilities",
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
        descriptionCopyright: "© Example",
        imageUri: "https://fixtures.example.test/images/library.jpg",
        imageCopyright: "© Example",
        imageCopylight: "© Example",
        uri: "https://fixtures.example.test/library",
        nodeSourceId: 42,
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
      properties: {
        name: "東京都千代田区神田和泉町",
        uri: "https://fixtures.example.test/towns/kanda-izumicho",
      },
      geometry: {
        type: "Polygon",
        coordinates: polygonCoordinates,
      },
    },
  ],
};

const validMultiPolygonTownGeoJson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "東京都千代田区神田和泉町",
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: [polygonCoordinates],
      },
    },
  ],
};

const sourceUriByName: Record<SourceName, string> = {
  mainFacilities: validAppConfig.mainFacilitiesUri,
  keyLocations: validAppConfig.keyLocationsUri,
  townGeoJson: validAppConfig.townGeoJsonUri,
};

const validPayloadBySource: Record<SourceName, unknown> = {
  mainFacilities: validMainFacilities,
  keyLocations: validKeyLocations,
  townGeoJson: validTownGeoJson,
};

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

function assertPublicGeneratorAvailable(state: ModuleState): void {
  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `generateLocationArtifact RED is blocked: public module ${GENERATOR_MODULE_PATH} is not implemented (${detail})`,
    );
  }
  if (!state.exports || typeof state.exports.generateLocationArtifact !== "function") {
    throw new Error(
      "generateLocationArtifact RED is blocked: the public generator export is not implemented",
    );
  }
}

function jsonResponse(payload: unknown, status = 200): TransportResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function jsonDecodeFailure(error: Error): TransportResponse {
  return {
    ok: true,
    status: 200,
    json: async () => {
      throw error;
    },
  };
}

function createHarness(
  payloadOverrides: Partial<Record<SourceName, unknown>> = {},
): GeneratorHarness {
  const payloadByUri: Record<string, unknown> = {
    [validAppConfig.mainFacilitiesUri]:
      payloadOverrides.mainFacilities ?? validPayloadBySource.mainFacilities,
    [validAppConfig.keyLocationsUri]:
      payloadOverrides.keyLocations ?? validPayloadBySource.keyLocations,
    [validAppConfig.townGeoJsonUri]:
      payloadOverrides.townGeoJson ?? validPayloadBySource.townGeoJson,
  };
  const transport = jest.fn<ReturnType<Transport>, Parameters<Transport>>();
  transport.mockImplementation(async (uri) => {
    if (!(uri in payloadByUri)) {
      throw new Error(`unexpected fixture URI: ${uri}`);
    }
    return jsonResponse(payloadByUri[uri]);
  });

  const artifactState: ArtifactState = { current: ARTIFACT_SENTINEL };
  const writeArtifact = jest.fn<ReturnType<ArtifactWriter>, Parameters<ArtifactWriter>>();
  writeArtifact.mockImplementation(async (artifact) => {
    artifactState.current = artifact;
  });

  return {
    options: {
      appConfig: validAppConfig,
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

function invalidRequiredStringCases(
  fields: readonly string[],
): Array<[string, Record<string, unknown>]> {
  return fields.flatMap((field) => [
    [`${field} missing`, { [field]: undefined }],
    [`${field} wrong type`, { [field]: 42 }],
    [`${field} null`, { [field]: null }],
    [`${field} empty`, { [field]: "" }],
    [`${field} whitespace-only`, { [field]: "   " }],
  ]);
}

function payloadForMainLocation(
  overrides: Record<string, unknown>,
): unknown {
  const category = validMainFacilities[0];
  const location = category.locations[0];
  return [
    {
      ...category,
      locations: [{ ...location, ...overrides }],
    },
  ];
}

function payloadForKeyLocation(
  overrides: Record<string, unknown>,
): unknown {
  const category = validKeyLocations[0];
  const location = category.locations[0];
  return [
    {
      ...category,
      locations: [{ ...location, ...overrides }],
    },
  ];
}

function payloadForGeoJsonFeature(
  overrides: Record<string, unknown>,
): unknown {
  const feature = validTownGeoJson.features[0];
  return {
    ...validTownGeoJson,
    features: [{ ...feature, ...overrides }],
  };
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
  configuredUris: readonly string[] = Object.values(sourceUriByName),
): void {
  const requestedUris = transport.mock.calls.map(([uri]) => uri);
  const configuredUriSet = new Set(configuredUris);

  expect(requestedUris.every((uri) => configuredUriSet.has(uri))).toBe(true);
  expect(requestedUris.some((uri) => uri.includes("cdn.jsdelivr.net"))).toBe(false);
  expect(
    requestedUris.some((uri) => uri.includes(validAppConfig.locationsDataVersion)),
  ).toBe(false);

  for (const uri of configuredUris) {
    expect(requestedUris.filter((requestedUri) => requestedUri === uri).length).toBeLessThanOrEqual(1);
  }
}

function expectEachConfiguredUriRequestedExactlyOnce(
  transport: jest.MockedFunction<Transport>,
  configuredUris: readonly string[] = Object.values(sourceUriByName),
): void {
  expectNoFallbackTransportRequests(transport, configuredUris);
  const requestedUris = transport.mock.calls.map(([uri]) => uri);

  for (const uri of configuredUris) {
    expect(requestedUris.filter((requestedUri) => requestedUri === uri)).toHaveLength(1);
  }
}

const sourcePathByName: Record<SourceName, string> = {
  mainFacilities: "/fixtures/main-facilities.json",
  keyLocations: "/fixtures/key-locations.json",
  townGeoJson: "/fixtures/town.geojson",
};

type FixtureServer = {
  uriBySource: Record<SourceName, string>;
  requestedUris: string[];
  close: () => Promise<void>;
};

async function createFixtureServer(
  options: Pick<PublicBuildRunOptions, "payloadOverrides" | "failureBySource">,
): Promise<FixtureServer> {
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
    const failureMode = options.failureBySource?.[source];
    if (failureMode === "transport") {
      request.socket.destroy();
      return;
    }
    if (failureMode === "http") {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: "fixture service unavailable" }));
      return;
    }
    if (failureMode === "json") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{ invalid fixture JSON");
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify(options.payloadOverrides?.[source] ?? validPayloadBySource[source]),
    );
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

async function runPublicGeneratorCli(
  options: PublicBuildRunOptions = {},
): Promise<PublicBuildRun> {
  if (!existsSync(GENERATOR_CLI_PATH) || !existsSync(TSX_CLI_PATH)) {
    return {
      exitCode: null,
      stdout: "",
      stderr: `generate-location-artifact public CLI is not implemented: ${GENERATOR_CLI_PATH}`,
      notImplemented: true,
      requestedUris: [],
      configuredUris: [],
      artifactKind: "missing",
      artifactContents: null,
      atomicTempEntries: [],
    };
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), "location-artifact-build-"));
  const generatedDirectory = join(temporaryRoot, "public", "generated");
  const artifactPath = join(generatedDirectory, "location-data.json");
  let fixtureServer: FixtureServer | null = null;

  try {
    await mkdir(generatedDirectory, { recursive: true });
    if (options.artifactAsDirectory) {
      await mkdir(artifactPath, { recursive: true });
    } else if (options.existingArtifact !== undefined) {
      await writeFile(artifactPath, options.existingArtifact, "utf8");
    }

    fixtureServer = await createFixtureServer(options);
    const networkGuardPath = join(temporaryRoot, "network-guard.cjs");
    await writeFile(networkGuardPath, NETWORK_GUARD_SOURCE, "utf8");
    const appConfig = {
      ...validAppConfig,
      mainFacilitiesUri: fixtureServer.uriBySource.mainFacilities,
      keyLocationsUri: fixtureServer.uriBySource.keyLocations,
      townGeoJsonUri: fixtureServer.uriBySource.townGeoJson,
      ...options.appConfigOverrides,
    };
    await writeFile(
      join(temporaryRoot, "app-config.json"),
      JSON.stringify(appConfig),
      "utf8",
    );

    let exitCode: number | null = 0;
    let stdout = "";
    let stderr = "";
    try {
      const processResult = await execFileAsync(
        process.execPath,
        [TSX_CLI_PATH, GENERATOR_CLI_PATH],
        {
          cwd: temporaryRoot,
          env: {
            ...process.env,
            FORCE_COLOR: "0",
            LOCATION_ARTIFACT_FIXTURE_ORIGIN: new URL(
              fixtureServer.uriBySource.mainFacilities,
            ).origin,
            NODE_OPTIONS: [
              process.env.NODE_OPTIONS,
              `--require=${networkGuardPath}`,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" "),
          },
          encoding: "utf8",
          maxBuffer: 1024 * 1024,
          timeout: 30_000,
          killSignal: "SIGTERM",
        },
      );
      stdout = String(processResult.stdout ?? "");
      stderr = String(processResult.stderr ?? "");
    } catch (error: unknown) {
      const processError = error as {
        code?: unknown;
        stdout?: unknown;
        stderr?: unknown;
      };
      exitCode = typeof processError.code === "number" ? processError.code : 1;
      stdout = String(processError.stdout ?? "");
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

    let directoryEntries: string[] = [];
    try {
      directoryEntries = await readdir(generatedDirectory);
    } catch {
      directoryEntries = [];
    }
    const atomicTempEntries = directoryEntries.filter(
      (entry) => entry !== "location-data.json",
    );
    const configuredUris = [
      appConfig.mainFacilitiesUri,
      appConfig.keyLocationsUri,
      appConfig.townGeoJsonUri,
    ].filter((uri): uri is string => typeof uri === "string");

    return {
      exitCode,
      stdout,
      stderr,
      notImplemented: false,
      requestedUris: fixtureServer.requestedUris,
      configuredUris,
      artifactKind,
      artifactContents,
      atomicTempEntries,
    };
  } finally {
    await fixtureServer?.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function expectPublicBuildFailure(
  result: PublicBuildRun,
  expectedStderr: RegExp,
  label: string,
): void {
  if (result.notImplemented) {
    throw new Error(`${label}: ${result.stderr}`);
  }
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toMatch(expectedStderr);
}

function expectPublicBuildSuccess(result: PublicBuildRun, label: string): void {
  if (result.notImplemented) {
    throw new Error(`${label}: ${result.stderr}`);
  }
  expect(result.exitCode).toBe(0);
  expect(result.artifactKind).toBe("file");
  expect(result.artifactContents).not.toBeNull();
}

function expectNoFallbackBuildRequests(result: PublicBuildRun): void {
  const configuredUriSet = new Set(result.configuredUris);
  expect(result.requestedUris.every((uri) => configuredUriSet.has(uri))).toBe(true);
  expect(result.stderr).not.toContain("LOCATION_ARTIFACT_EXTERNAL_NETWORK_BLOCKED");
  expect(result.requestedUris.some((uri) => uri.includes("cdn.jsdelivr.net"))).toBe(false);
  expect(
    result.requestedUris.some((uri) => uri.includes(validAppConfig.locationsDataVersion)),
  ).toBe(false);
  for (const uri of result.configuredUris) {
    expect(result.requestedUris.filter((requestedUri) => requestedUri === uri).length).toBeLessThanOrEqual(1);
  }
}

const moduleState = loadModule();

describe("generateLocationArtifact build boundary", () => {
  if (
    moduleState.error ||
    !moduleState.exports ||
    typeof moduleState.exports.generateLocationArtifact !== "function"
  ) {
    it("reports the missing public generator as an actionable RED contract", () => {
      assertPublicGeneratorAvailable(moduleState);
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
      ["root-relative path", "/data/location-data.json"],
      ["malformed absolute URI", "https://"],
      ["unsupported URI scheme", "ftp://fixtures.example.test/data.json"],
    ];

    it.each(invalidUriValues)(
      "fails before transport when mainFacilitiesUri is %s",
      async (_label, value) => {
        const harness = createHarness();
        const appConfig = { ...validAppConfig, mainFacilitiesUri: value };

        await expect(
          invokeGenerator(moduleState, { ...harness.options, appConfig }),
        ).rejects.toThrow();

        expect(harness.transport).not.toHaveBeenCalled();
        expectArtifactUnchanged(harness);
      },
    );

    it.each(invalidUriValues)(
      "fails before transport when keyLocationsUri is %s",
      async (_label, value) => {
        const harness = createHarness();
        const appConfig = { ...validAppConfig, keyLocationsUri: value };

        await expect(
          invokeGenerator(moduleState, { ...harness.options, appConfig }),
        ).rejects.toThrow();

        expect(harness.transport).not.toHaveBeenCalled();
        expectArtifactUnchanged(harness);
      },
    );

    it.each(invalidUriValues)(
      "fails before transport when townGeoJsonUri is %s",
      async (_label, value) => {
        const harness = createHarness();
        const appConfig = { ...validAppConfig, townGeoJsonUri: value };

        await expect(
          invokeGenerator(moduleState, { ...harness.options, appConfig }),
        ).rejects.toThrow();

        expect(harness.transport).not.toHaveBeenCalled();
        expectArtifactUnchanged(harness);
      },
    );

    it("uses the three complete appConfig URIs exactly and never constructs a legacy CDN URL", async () => {
      const harness = createHarness();

      await invokeGenerator(moduleState, harness.options);

      expectEachConfiguredUriRequestedExactlyOnce(harness.transport);
      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });
  });

  describe("transport, HTTP, and JSON decoding failures", () => {
    const sources: SourceName[] = [
      "mainFacilities",
      "keyLocations",
      "townGeoJson",
    ];

    it.each(sources)(
      "propagates a %s transport rejection as a build failure without updating the artifact",
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
      "propagates a %s HTTP error as a build failure without updating the artifact",
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
          /503/,
        );
        expectNoFallbackTransportRequests(harness.transport);
        expectArtifactUnchanged(harness);
      },
    );

    it.each(sources)(
      "propagates a %s JSON decode error as a build failure without updating the artifact",
      async (source) => {
        const harness = createHarness();
        const targetUri = sourceUriByName[source];
        harness.transport.mockImplementation(async (uri) => {
          if (uri === targetUri) {
            return jsonDecodeFailure(new SyntaxError(`${source} JSON is invalid`));
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

  describe("main_facilities.json required fields and empty categories", () => {
    const requiredFields: Array<[string, Record<string, unknown>]> = [
      ["name", { name: undefined }],
      ["lat", { lat: undefined }],
      ["lng", { lng: undefined }],
      ["copyright", { copyright: undefined }],
      ["licence", { licence: undefined }],
      ["licenceUri", { licenceUri: undefined }],
      ["finite latitude", { lat: Number.NaN }],
      ["finite longitude", { lng: Number.POSITIVE_INFINITY }],
      ["licenceUri format", { licenceUri: "not-a-uri" }],
      ...invalidRequiredStringCases(["name", "copyright", "licence", "licenceUri"]),
    ];

    it.each(requiredFields)(
      "rejects a main facility with invalid required field %s",
      async (_label, overrides) => {
        const harness = createHarness({
          mainFacilities: payloadForMainLocation(overrides),
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it.each([
      ["missing category label", [{ ...validMainFacilities[0], category: undefined }]],
      ["missing category identifier", [{ ...validMainFacilities[0], "category:en": undefined }]],
      ["missing category locations", [{ ...validMainFacilities[0], locations: undefined }]],
      ["wrong-type category locations", [{ ...validMainFacilities[0], locations: "not-an-array" }]],
      ["null category locations", [{ ...validMainFacilities[0], locations: null }]],
      ["empty category locations", [{ ...validMainFacilities[0], locations: [] }]],
      ["empty category set", []],
    ] as const)(
      "rejects main_facilities.json with %s",
      async (_label, payload) => {
        const harness = createHarness({ mainFacilities: payload });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it.each(invalidRequiredStringCases(["category", "category:en"]))(
      "rejects main_facilities.json with invalid required category field %s",
      async (_label, overrides) => {
        const harness = createHarness({
          mainFacilities: [{ ...validMainFacilities[0], ...overrides }],
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it("rejects duplicate main-facility category identifiers instead of selecting the first category", async () => {
      const firstCategory = validMainFacilities[0];
      const secondCategory = {
        ...firstCategory,
        category: "別カテゴリ",
        locations: [{ ...firstCategory.locations[0], name: "別施設" }],
      };
      const harness = createHarness({
        mainFacilities: [firstCategory, secondCategory],
      });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });
  });

  describe("main_facilities.json optional field type and format validation", () => {
    const invalidOptionalTypes: Array<[string, Record<string, unknown>]> = [
      ["description", { description: 42 }],
      ["imageUri", { imageUri: 42 }],
      ["imageCopyright", { imageCopyright: 42 }],
      ["uri", { uri: 42 }],
    ];

    it.each(invalidOptionalTypes)(
      "rejects an existing main-facility optional %s with an invalid type",
      async (_label, overrides) => {
        const harness = createHarness({
          mainFacilities: payloadForMainLocation(overrides),
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it.each([
      ["imageUri", { imageUri: "not-a-uri" }],
      ["uri", { uri: "relative/path" }],
    ] as const)(
      "rejects an existing main-facility optional %s with an invalid URI format",
      async (_label, overrides) => {
        const harness = createHarness({
          mainFacilities: payloadForMainLocation(overrides),
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it("accepts omitted optional main-facility metadata and still writes a validated artifact", async () => {
      const category = validMainFacilities[0];
      const location = category.locations[0];
      const minimalLocation = {
        name: location.name,
        lat: location.lat,
        lng: location.lng,
        copyright: location.copyright,
        licence: location.licence,
        licenceUri: location.licenceUri,
      };
      const harness = createHarness({
        mainFacilities: [{ ...category, locations: [minimalLocation] }],
      });

      await invokeGenerator(moduleState, harness.options);

      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expect(harness.artifactState.current).not.toBe(ARTIFACT_SENTINEL);
    });

    it("accepts explicit null main-facility optional metadata and preserves the null values", async () => {
      const nullOptionalMetadata = {
        description: null,
        imageUri: null,
        imageCopyright: null,
        uri: null,
      };
      const expectedMainFacilities = payloadForMainLocation(nullOptionalMetadata);
      const harness = createHarness({
        mainFacilities: expectedMainFacilities,
      });

      await invokeGenerator(moduleState, harness.options);

      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expect(harness.artifactState.current).toEqual(
        expect.objectContaining({
          sources: expect.objectContaining({
            mainFacilities: expectedMainFacilities,
          }),
        }),
      );
    });
  });

  describe("key_locations.json required fields, empty categories, and identifiers", () => {
    const requiredFields: Array<[string, Record<string, unknown>]> = [
      ["id", { id: undefined }],
      ["id format", { id: "invalid/location" }],
      ["name", { name: undefined }],
      ["lat", { lat: undefined }],
      ["lng", { lng: undefined }],
      ["nodeCopyright", { nodeCopyright: undefined }],
      ["licence", { licence: undefined }],
      ["licenceUri", { licenceUri: undefined }],
      ["finite latitude", { lat: Number.NEGATIVE_INFINITY }],
      ["finite longitude", { lng: Number.NaN }],
      ["licenceUri format", { licenceUri: "not-a-uri" }],
      ...invalidRequiredStringCases([
        "id",
        "name",
        "nodeCopyright",
        "licence",
        "licenceUri",
      ]),
    ];

    it.each(requiredFields)(
      "rejects a key location with invalid required field %s",
      async (_label, overrides) => {
        const harness = createHarness({
          keyLocations: payloadForKeyLocation(overrides),
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it.each([
      ["missing category label", [{ ...validKeyLocations[0], category: undefined }]],
      ["missing category identifier", [{ ...validKeyLocations[0], "category:en": undefined }]],
      ["missing category locations", [{ ...validKeyLocations[0], locations: undefined }]],
      ["wrong-type category locations", [{ ...validKeyLocations[0], locations: "not-an-array" }]],
      ["null category locations", [{ ...validKeyLocations[0], locations: null }]],
      ["empty category locations", [{ ...validKeyLocations[0], locations: [] }]],
      ["empty category set", []],
    ] as const)(
      "rejects key_locations.json with %s",
      async (_label, payload) => {
        const harness = createHarness({ keyLocations: payload });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it.each(invalidRequiredStringCases(["category", "category:en"]))(
      "rejects key_locations.json with invalid required category field %s",
      async (_label, overrides) => {
        const harness = createHarness({
          keyLocations: [{ ...validKeyLocations[0], ...overrides }],
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it("rejects duplicate category:en values instead of selecting the first category", async () => {
      const firstCategory = validKeyLocations[0];
      const secondCategory = {
        ...firstCategory,
        category: "別カテゴリ",
        locations: [{ ...firstCategory.locations[0], id: "second-location" }],
      };
      const harness = createHarness({
        keyLocations: [firstCategory, secondCategory],
      });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });

    it("rejects duplicate location IDs across categories instead of selecting one location", async () => {
      const firstCategory = validKeyLocations[0];
      const secondCategory = {
        ...firstCategory,
        category: "別カテゴリ",
        "category:en": "another-category",
        locations: [
          {
            ...firstCategory.locations[0],
            name: "同じIDの別施設",
          },
        ],
      };
      const harness = createHarness({
        keyLocations: [firstCategory, secondCategory],
      });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });

    it("rejects duplicate location IDs within one category instead of selecting one location", async () => {
      const category = validKeyLocations[0];
      const duplicateLocation = {
        ...category.locations[0],
        name: "同一カテゴリ内の重複施設",
      };
      const harness = createHarness({
        keyLocations: [
          {
            ...category,
            locations: [category.locations[0], duplicateLocation],
          },
        ],
      });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });
  });

  describe("key_locations.json optional field type and format validation", () => {
    const invalidOptionalTypes: Array<[string, Record<string, unknown>]> = [
      ["description", { description: 42 }],
      ["descriptionCopyright", { descriptionCopyright: 42 }],
      ["imageUri", { imageUri: 42 }],
      ["imageCopyright", { imageCopyright: 42 }],
      ["imageCopylight", { imageCopylight: 42 }],
      ["uri", { uri: 42 }],
      ["nodeSourceId", { nodeSourceId: "42" }],
      ["nodeSourceId finiteness", { nodeSourceId: Number.POSITIVE_INFINITY }],
    ];

    it.each(invalidOptionalTypes)(
      "rejects an existing key-location optional %s with an invalid type or value",
      async (_label, overrides) => {
        const harness = createHarness({
          keyLocations: payloadForKeyLocation(overrides),
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it.each([
      ["imageUri", { imageUri: "not-a-uri" }],
      ["uri", { uri: "relative/path" }],
    ] as const)(
      "rejects an existing key-location optional %s with an invalid URI format",
      async (_label, overrides) => {
        const harness = createHarness({
          keyLocations: payloadForKeyLocation(overrides),
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it("accepts omitted optional key-location metadata without adding an area field to source data", async () => {
      const category = validKeyLocations[0];
      const location = category.locations[0];
      const minimalLocation = {
        id: location.id,
        name: location.name,
        lat: location.lat,
        lng: location.lng,
        nodeCopyright: location.nodeCopyright,
        licence: location.licence,
        licenceUri: location.licenceUri,
      };
      const harness = createHarness({
        keyLocations: [{ ...category, locations: [minimalLocation] }],
      });

      await invokeGenerator(moduleState, harness.options);

      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expect(harness.artifactState.current).not.toBe(ARTIFACT_SENTINEL);
      expect(minimalLocation).not.toHaveProperty("area");
    });

    it("accepts explicit null key-location optional metadata and preserves the null values", async () => {
      const nullOptionalMetadata = {
        description: null,
        descriptionCopyright: null,
        imageUri: null,
        imageCopyright: null,
        imageCopylight: null,
        uri: null,
        nodeSourceId: null,
      };
      const expectedKeyLocations = payloadForKeyLocation(nullOptionalMetadata);
      const harness = createHarness({
        keyLocations: expectedKeyLocations,
      });

      await invokeGenerator(moduleState, harness.options);

      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expect(harness.artifactState.current).toEqual(
        expect.objectContaining({
          sources: expect.objectContaining({
            keyLocations: expectedKeyLocations,
          }),
        }),
      );
    });
  });

  describe("town GeoJSON FeatureCollection and feature geometry validation", () => {
    const malformedFeatureCases: Array<[string, Record<string, unknown>]> = [
      ["feature type", { type: "Polygon" }],
      ["feature type wrong type", { type: 42 }],
      ["feature type null", { type: null }],
      ["feature type empty", { type: "" }],
      ["feature type whitespace-only", { type: "   " }],
      ["missing properties", { properties: undefined }],
      ["properties wrong type", { properties: "not-an-object" }],
      ["properties null", { properties: null }],
      ["empty properties.name", { properties: { name: "" } }],
      ["whitespace-only properties.name", { properties: { name: "   " } }],
      ["wrong-type properties.name", { properties: { name: 42 } }],
      ["null properties.name", { properties: { name: null } }],
      ["missing properties.name", { properties: {} }],
      ["missing geometry", { geometry: undefined }],
      ["null geometry", { geometry: null }],
      ["unsupported geometry type", {
        geometry: { type: "Point", coordinates: [139.768, 35.694] },
      }],
      ["empty Polygon coordinates", {
        geometry: { type: "Polygon", coordinates: [] },
      }],
      ["non-finite Polygon coordinate", {
        geometry: {
          type: "Polygon",
          coordinates: [[
            [Number.NaN, 35.6],
            [139.8, 35.6],
            [139.8, 35.8],
            [139.7, 35.8],
            [139.7, 35.6],
          ]],
        },
      }],
      ["non-finite MultiPolygon coordinate", {
        geometry: {
          type: "MultiPolygon",
          coordinates: [[[
            [139.7, 35.6],
            [139.8, 35.6],
            [Number.POSITIVE_INFINITY, 35.8],
            [139.7, 35.8],
            [139.7, 35.6],
          ]]],
        },
      }],
    ];

    it.each([
      ["missing root type", { ...validTownGeoJson, type: undefined }],
      ["wrong root type", { ...validTownGeoJson, type: "Feature" }],
      ["wrong-type root type", { ...validTownGeoJson, type: 42 }],
      ["null root type", { ...validTownGeoJson, type: null }],
      ["empty root type", { ...validTownGeoJson, type: "" }],
      ["whitespace-only root type", { ...validTownGeoJson, type: "   " }],
      ["missing features", { type: "FeatureCollection" }],
      ["empty features", { ...validTownGeoJson, features: [] }],
      ["features is not an array", { ...validTownGeoJson, features: {} }],
      ["features is null", { ...validTownGeoJson, features: null }],
    ] as const)(
      "rejects GeoJSON with %s",
      async (_label, payload) => {
        const harness = createHarness({ townGeoJson: payload });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it.each(malformedFeatureCases)(
      "rejects a GeoJSON feature with invalid %s",
      async (_label, overrides) => {
        const harness = createHarness({
          townGeoJson: payloadForGeoJsonFeature(overrides),
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );

    it("rejects an invalid coordinate in one feature of a multi-feature collection", async () => {
      const validFeature = validTownGeoJson.features[0];
      const invalidFeature = {
        ...validFeature,
        properties: { name: "東京都千代田区麹町" },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [139.7, 35.6],
            [139.8, Number.NaN],
            [139.8, 35.8],
            [139.7, 35.8],
            [139.7, 35.6],
          ]],
        },
      };
      const harness = createHarness({
        townGeoJson: {
          ...validTownGeoJson,
          features: [validFeature, invalidFeature],
        },
      });

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
      expectArtifactUnchanged(harness);
    });

    it("accepts valid Polygon coordinates and writes a validated artifact", async () => {
      const harness = createHarness();

      await invokeGenerator(moduleState, harness.options);

      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expect(harness.artifactState.current).not.toBe(ARTIFACT_SENTINEL);
    });

    it("accepts valid MultiPolygon coordinates", async () => {
      const harness = createHarness({ townGeoJson: validMultiPolygonTownGeoJson });

      await invokeGenerator(moduleState, harness.options);

      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expect(harness.artifactState.current).not.toBe(ARTIFACT_SENTINEL);
    });

    it("accepts a feature without the optional properties.uri", async () => {
      const feature = validTownGeoJson.features[0];
      const harness = createHarness({
        townGeoJson: {
          ...validTownGeoJson,
          features: [
            {
              ...feature,
              properties: { name: feature.properties.name },
            },
          ],
        },
      });

      await invokeGenerator(moduleState, harness.options);

      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
    });

    it("accepts explicit null GeoJSON properties.uri and preserves the null value", async () => {
      const expectedTownGeoJson = payloadForGeoJsonFeature({
        properties: {
          name: validTownGeoJson.features[0].properties.name,
          uri: null,
        },
      });
      const harness = createHarness({
        townGeoJson: expectedTownGeoJson,
      });

      await invokeGenerator(moduleState, harness.options);

      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expect(harness.artifactState.current).toEqual(
        expect.objectContaining({
          sources: expect.objectContaining({
            townGeoJson: expectedTownGeoJson,
          }),
        }),
      );
    });

    it.each([
      ["type", { properties: { ...validTownGeoJson.features[0].properties, uri: 42 } }],
      ["format", { properties: { ...validTownGeoJson.features[0].properties, uri: "relative/path" } }],
    ] as const)(
      "rejects an existing optional GeoJSON properties.uri with invalid %s",
      async (_label, overrides) => {
        const harness = createHarness({
          townGeoJson: payloadForGeoJsonFeature(overrides),
        });

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();
        expectArtifactUnchanged(harness);
      },
    );
  });

  describe("atomic validated-artifact output and GeoJSON-derived display region", () => {
    it("writes only after every source is verified and includes a prefix-free derived region", async () => {
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
          sourceUris: expect.objectContaining({
            mainFacilitiesUri: validAppConfig.mainFacilitiesUri,
            keyLocationsUri: validAppConfig.keyLocationsUri,
            townGeoJsonUri: validAppConfig.townGeoJsonUri,
          }),
          derivedRegions: expect.objectContaining({
            "kanda-library": "神田和泉町",
          }),
        }),
      );
      expect(harness.artifactState.current).toEqual(
        expect.objectContaining({
          sources: expect.objectContaining({
            mainFacilities: validMainFacilities,
            keyLocations: validKeyLocations,
            townGeoJson: validTownGeoJson,
          }),
        }),
      );
      expect(validKeyLocations[0].locations[0]).not.toHaveProperty("area");
    });

    it("propagates an atomic writer failure without exposing a partial artifact", async () => {
      const harness = createHarness();
      const writerFailure = new Error("atomic temp-file rename failed");
      harness.writeArtifact.mockRejectedValue(writerFailure);

      await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow(
        "atomic temp-file rename failed",
      );

      expect(harness.writeArtifact).toHaveBeenCalledTimes(1);
      expectArtifactUnchanged(harness, 1);
    });

    it.each([
      ["mainFacilities", { mainFacilities: [] }],
      ["keyLocations", { keyLocations: [] }],
      ["townGeoJson", { townGeoJson: { ...validTownGeoJson, features: [] } }],
    ] as const)(
      "does not update the previous artifact when %s validation fails after other sources are valid",
      async (_source, payloadOverrides) => {
        const harness = createHarness(payloadOverrides);

        await expect(invokeGenerator(moduleState, harness.options)).rejects.toThrow();

        expectArtifactUnchanged(harness);
      },
    );
  });
});

describe("public generator build lifecycle", () => {
  if (!existsSync(GENERATOR_CLI_PATH) || !existsSync(TSX_CLI_PATH)) {
    it("reports the missing public generator CLI as an actionable RED contract", () => {
      throw new Error(
        `public generator CLI is not implemented: ${GENERATOR_CLI_PATH}`,
      );
    });
    return;
  }

  const invalidUriValues: Array<[string, unknown]> = [
    ["unset", undefined],
    ["null", null],
    ["empty", ""],
    ["whitespace-only", "   "],
    ["wrong type", 42],
    ["relative path", "data/location-data.json"],
    ["root-relative path", "/data/location-data.json"],
    ["malformed absolute URI", "https://"],
    ["unsupported URI scheme", "ftp://fixtures.example.test/data.json"],
  ];

  const publicBuildFailureCases: Array<
    [string, PublicBuildRunOptions, RegExp]
  > = [];
  const configuredUriFields = [
    "mainFacilitiesUri",
    "keyLocationsUri",
    "townGeoJsonUri",
  ] as const;

  for (const uriField of configuredUriFields) {
    for (const [label, value] of invalidUriValues) {
      publicBuildFailureCases.push([
        `${uriField} ${label}`,
        { appConfigOverrides: { [uriField]: value } },
        /URI|uri|config|absolute|invalid|failed/i,
      ]);
    }
  }

  const sourceNames: SourceName[] = [
    "mainFacilities",
    "keyLocations",
    "townGeoJson",
  ];
  for (const source of sourceNames) {
    publicBuildFailureCases.push(
      [
        `${source} transport failure`,
        { failureBySource: { [source]: "transport" } },
        /fetch|network|transport|socket|ECONN|failed/i,
      ],
      [
        `${source} HTTP failure`,
        { failureBySource: { [source]: "http" } },
        /HTTP|503|status|failed/i,
      ],
      [
        `${source} JSON failure`,
        { failureBySource: { [source]: "json" } },
        /JSON|json|parse|decode|failed/i,
      ],
    );
  }

  for (const [label, overrides] of invalidRequiredStringCases([
    "name",
    "copyright",
    "licence",
    "licenceUri",
  ])) {
    publicBuildFailureCases.push([
      `main facility ${label}`,
      { payloadOverrides: { mainFacilities: payloadForMainLocation(overrides) } },
      /main|facility|field|validation|invalid|failed/i,
    ]);
  }
  for (const [label, overrides] of invalidRequiredStringCases([
    "id",
    "name",
    "nodeCopyright",
    "licence",
    "licenceUri",
  ])) {
    publicBuildFailureCases.push([
      `key location ${label}`,
      { payloadOverrides: { keyLocations: payloadForKeyLocation(overrides) } },
      /key|location|field|validation|invalid|failed/i,
    ]);
  }
  for (const source of ["mainFacilities", "keyLocations"] as const) {
    for (const [label, overrides] of invalidRequiredStringCases([
      "category",
      "category:en",
    ])) {
      const payload =
        source === "mainFacilities"
          ? [{ ...validMainFacilities[0], ...overrides }]
          : [{ ...validKeyLocations[0], ...overrides }];
      publicBuildFailureCases.push([
        `${source} category ${label}`,
        { payloadOverrides: { [source]: payload } },
        /category|field|validation|invalid|failed/i,
      ]);
    }
  }

  for (const [label, overrides] of [
    ["lat wrong type", { lat: "35.694" }],
    ["lat null", { lat: null }],
    ["lat non-finite", { lat: Number.NaN }],
    ["lng wrong type", { lng: "139.753" }],
    ["lng null", { lng: null }],
    ["lng non-finite", { lng: Number.POSITIVE_INFINITY }],
    ["licenceUri invalid URI", { licenceUri: "not-a-uri" }],
  ] as Array<[string, Record<string, unknown>]>) {
    publicBuildFailureCases.push([
      `main facility ${label}`,
      { payloadOverrides: { mainFacilities: payloadForMainLocation(overrides) } },
      /main|facility|coordinate|licence|URI|field|validation|invalid|failed/i,
    ]);
  }
  for (const [label, overrides] of [
    ["id invalid identifier", { id: "invalid/location" }],
    ["lat wrong type", { lat: "35.694" }],
    ["lat null", { lat: null }],
    ["lat non-finite", { lat: Number.NaN }],
    ["lng wrong type", { lng: "139.768" }],
    ["lng null", { lng: null }],
    ["lng non-finite", { lng: Number.NEGATIVE_INFINITY }],
    ["licenceUri invalid URI", { licenceUri: "not-a-uri" }],
  ] as Array<[string, Record<string, unknown>]>) {
    publicBuildFailureCases.push([
      `key location ${label}`,
      { payloadOverrides: { keyLocations: payloadForKeyLocation(overrides) } },
      /key|location|coordinate|licence|URI|identifier|field|validation|invalid|failed/i,
    ]);
  }

  for (const [source, payloadFactory] of [
    ["mainFacilities", (overrides: Record<string, unknown>) => [
      { ...validMainFacilities[0], ...overrides },
    ]],
    ["keyLocations", (overrides: Record<string, unknown>) => [
      { ...validKeyLocations[0], ...overrides },
    ]],
  ] as const) {
    for (const [label, overrides] of [
      ["locations missing", { locations: undefined }],
      ["locations wrong type", { locations: "not-an-array" }],
      ["locations null", { locations: null }],
      ["locations empty", { locations: [] }],
    ] as Array<[string, Record<string, unknown>]>) {
      publicBuildFailureCases.push([
        `${source} ${label}`,
        { payloadOverrides: { [source]: payloadFactory(overrides) } },
        /category|locations|empty|array|validation|invalid|failed/i,
      ]);
    }
  }

  const mainOptionalFailureCases: Array<[string, Record<string, unknown>]> = [
    ["description wrong type", { description: 42 }],
    ["imageUri wrong type", { imageUri: 42 }],
    ["imageUri invalid URI", { imageUri: "relative/image.jpg" }],
    ["imageCopyright wrong type", { imageCopyright: 42 }],
    ["uri wrong type", { uri: 42 }],
    ["uri invalid URI", { uri: "relative/location" }],
  ];
  for (const [label, overrides] of mainOptionalFailureCases) {
    publicBuildFailureCases.push([
      `main facility optional ${label}`,
      { payloadOverrides: { mainFacilities: payloadForMainLocation(overrides) } },
      /main|facility|optional|image|URI|field|validation|invalid|failed/i,
    ]);
  }

  const keyOptionalFailureCases: Array<[string, Record<string, unknown>]> = [
    ["description wrong type", { description: 42 }],
    ["descriptionCopyright wrong type", { descriptionCopyright: 42 }],
    ["imageUri wrong type", { imageUri: 42 }],
    ["imageUri invalid URI", { imageUri: "relative/image.jpg" }],
    ["imageCopyright wrong type", { imageCopyright: 42 }],
    ["imageCopylight wrong type", { imageCopylight: 42 }],
    ["uri wrong type", { uri: 42 }],
    ["uri invalid URI", { uri: "relative/location" }],
    ["nodeSourceId wrong type", { nodeSourceId: "42" }],
  ];
  for (const [label, overrides] of keyOptionalFailureCases) {
    publicBuildFailureCases.push([
      `key location optional ${label}`,
      { payloadOverrides: { keyLocations: payloadForKeyLocation(overrides) } },
      /key|location|optional|image|node|URI|field|validation|invalid|failed/i,
    ]);
  }

  const malformedGeoJsonFeatures: Array<[string, Record<string, unknown>]> = [
    ["feature type wrong type", { type: 42 }],
    ["feature type null", { type: null }],
    ["feature type empty", { type: "" }],
    ["feature type whitespace-only", { type: "   " }],
    ["properties wrong type", { properties: "not-an-object" }],
    ["properties null", { properties: null }],
    ["properties.name wrong type", { properties: { name: 42 } }],
    ["properties.name null", { properties: { name: null } }],
    ["properties.name empty", { properties: { name: "" } }],
    ["properties.name whitespace-only", { properties: { name: "   " } }],
    ["missing properties.name", { properties: {} }],
    ["missing geometry", { geometry: undefined }],
    ["geometry null", { geometry: null }],
    ["unsupported geometry", {
      geometry: { type: "Point", coordinates: [139.768, 35.694] },
    }],
    ["empty Polygon coordinates", {
      geometry: { type: "Polygon", coordinates: [] },
    }],
    ["non-finite Polygon coordinate", {
      geometry: {
        type: "Polygon",
        coordinates: [[
          [Number.NaN, 35.6],
          [139.8, 35.6],
          [139.8, 35.8],
          [139.7, 35.8],
          [139.7, 35.6],
        ]],
      },
    }],
    ["non-finite MultiPolygon coordinate", {
      geometry: {
        type: "MultiPolygon",
        coordinates: [[[
          [139.7, 35.6],
          [139.8, 35.6],
          [Number.POSITIVE_INFINITY, 35.8],
          [139.7, 35.8],
          [139.7, 35.6],
        ]]],
      },
    }],
  ];
  for (const [label, overrides] of malformedGeoJsonFeatures) {
    publicBuildFailureCases.push([
      `town GeoJSON ${label}`,
      { payloadOverrides: { townGeoJson: payloadForGeoJsonFeature(overrides) } },
      /GeoJSON|geojson|feature|geometry|coordinate|field|validation|invalid|failed/i,
    ]);
  }

  for (const [label, properties] of [
    ["properties.uri wrong type", { ...validTownGeoJson.features[0].properties, uri: 42 }],
    ["properties.uri invalid URI", { ...validTownGeoJson.features[0].properties, uri: "relative/town" }],
  ] as Array<[string, Record<string, unknown>]>) {
    publicBuildFailureCases.push([
      `town GeoJSON ${label}`,
      {
        payloadOverrides: {
          townGeoJson: payloadForGeoJsonFeature({ properties }),
        },
      },
      /GeoJSON|geojson|properties|URI|feature|field|validation|invalid|failed/i,
    ]);
  }

  publicBuildFailureCases.push(
    [
      "missing GeoJSON root type",
      { payloadOverrides: { townGeoJson: { ...validTownGeoJson, type: undefined } } },
      /GeoJSON|geojson|shape|type|validation|invalid|failed/i,
    ],
    [
      "wrong GeoJSON root type",
      { payloadOverrides: { townGeoJson: { ...validTownGeoJson, type: "Feature" } } },
      /GeoJSON|geojson|shape|type|validation|invalid|failed/i,
    ],
    [
      "wrong-type GeoJSON root type",
      { payloadOverrides: { townGeoJson: { ...validTownGeoJson, type: 42 } } },
      /GeoJSON|geojson|shape|type|validation|invalid|failed/i,
    ],
    [
      "null GeoJSON root type",
      { payloadOverrides: { townGeoJson: { ...validTownGeoJson, type: null } } },
      /GeoJSON|geojson|shape|type|validation|invalid|failed/i,
    ],
    [
      "empty GeoJSON root type",
      { payloadOverrides: { townGeoJson: { ...validTownGeoJson, type: "" } } },
      /GeoJSON|geojson|shape|type|validation|invalid|failed/i,
    ],
    [
      "whitespace-only GeoJSON root type",
      { payloadOverrides: { townGeoJson: { ...validTownGeoJson, type: "   " } } },
      /GeoJSON|geojson|shape|type|validation|invalid|failed/i,
    ],
    [
      "missing GeoJSON features",
      { payloadOverrides: { townGeoJson: { ...validTownGeoJson, features: undefined } } },
      /GeoJSON|geojson|features|shape|validation|invalid|failed/i,
    ],
    [
      "wrong-type GeoJSON features",
      { payloadOverrides: { townGeoJson: { ...validTownGeoJson, features: "not-an-array" } } },
      /GeoJSON|geojson|features|array|shape|validation|invalid|failed/i,
    ],
    [
      "null GeoJSON features",
      { payloadOverrides: { townGeoJson: { ...validTownGeoJson, features: null } } },
      /GeoJSON|geojson|features|shape|validation|invalid|failed/i,
    ],
    [
      "empty main-facilities category set",
      { payloadOverrides: { mainFacilities: [] } },
      /main|category|empty|validation|invalid|failed/i,
    ],
    [
      "empty key-locations category set",
      { payloadOverrides: { keyLocations: [] } },
      /key|location|category|empty|validation|invalid|failed/i,
    ],
    [
      "empty town GeoJSON feature set",
      { payloadOverrides: { townGeoJson: { ...validTownGeoJson, features: [] } } },
      /GeoJSON|feature|empty|validation|invalid|failed/i,
    ],
    [
      "duplicate main-facilities category identifier",
      {
        payloadOverrides: {
          mainFacilities: [
            validMainFacilities[0],
            {
              ...validMainFacilities[0],
              category: "別カテゴリ",
              locations: [{ ...validMainFacilities[0].locations[0], name: "別施設" }],
            },
          ],
        },
      },
      /main|facility|category|duplicate|identifier|validation|invalid|failed/i,
    ],
    [
      "duplicate category identifier",
      {
        payloadOverrides: {
          keyLocations: [
            validKeyLocations[0],
            {
              ...validKeyLocations[0],
              category: "別カテゴリ",
              locations: [{ ...validKeyLocations[0].locations[0], id: "second-location" }],
            },
          ],
        },
      },
      /duplicate|category|identifier|validation|invalid|failed/i,
    ],
    [
      "duplicate location identifier within one category",
      {
        payloadOverrides: {
          keyLocations: [
            {
              ...validKeyLocations[0],
              locations: [
                validKeyLocations[0].locations[0],
                { ...validKeyLocations[0].locations[0], name: "同一カテゴリ内の重複施設" },
              ],
            },
          ],
        },
      },
      /duplicate|location|identifier|validation|invalid|failed/i,
    ],
    [
      "duplicate location identifier across categories",
      {
        payloadOverrides: {
          keyLocations: [
            validKeyLocations[0],
            {
              ...validKeyLocations[0],
              category: "別カテゴリ",
              "category:en": "another-category",
              locations: [{ ...validKeyLocations[0].locations[0], name: "同じIDの別施設" }],
            },
          ],
        },
      },
      /duplicate|location|identifier|validation|invalid|failed/i,
    ],
    [
      "invalid coordinate in a later GeoJSON feature",
      {
        payloadOverrides: {
          townGeoJson: {
            ...validTownGeoJson,
            features: [
              validTownGeoJson.features[0],
              {
                ...validTownGeoJson.features[0],
                properties: { name: "東京都千代田区麹町" },
                geometry: {
                  type: "Polygon",
                  coordinates: [[
                    [139.7, 35.6],
                    [139.8, Number.NaN],
                    [139.8, 35.8],
                    [139.7, 35.8],
                    [139.7, 35.6],
                  ]],
                },
              },
            ],
          },
        },
      },
      /GeoJSON|feature|coordinate|validation|invalid|failed/i,
    ],
  );

  it("executes the configured public generator CLI and atomically publishes a validated artifact", async () => {
    const result = await runPublicGeneratorCli();

    expectPublicBuildSuccess(result, "public generator CLI");
    expectNoFallbackBuildRequests(result);
    expect(result.requestedUris).toHaveLength(3);
    expect(result.configuredUris).toHaveLength(3);
    expect(result.atomicTempEntries).toEqual([]);
    expect(result.artifactContents).toContain('"status":"validated"');
  });

  it("accepts omitted optional metadata through the public build lifecycle", async () => {
    const result = await runPublicGeneratorCli({
      payloadOverrides: {
        mainFacilities: payloadForMainLocation({
          description: undefined,
          imageUri: undefined,
          imageCopyright: undefined,
          uri: undefined,
        }),
        keyLocations: payloadForKeyLocation({
          description: undefined,
          descriptionCopyright: undefined,
          imageUri: undefined,
          imageCopyright: undefined,
          imageCopylight: undefined,
          uri: undefined,
          nodeSourceId: undefined,
        }),
        townGeoJson: payloadForGeoJsonFeature({
          properties: { name: validTownGeoJson.features[0].properties.name },
        }),
      },
    });

    expectPublicBuildSuccess(result, "public generator optional metadata");
    expectNoFallbackBuildRequests(result);
    expect(result.requestedUris).toHaveLength(3);
    expect(result.atomicTempEntries).toEqual([]);
  });

  it("accepts explicit null optional metadata and preserves null values through the public build lifecycle", async () => {
    const expectedMainFacilities = payloadForMainLocation({
      description: null,
      imageUri: null,
      imageCopyright: null,
      uri: null,
    });
    const expectedKeyLocations = payloadForKeyLocation({
      description: null,
      descriptionCopyright: null,
      imageUri: null,
      imageCopyright: null,
      imageCopylight: null,
      uri: null,
      nodeSourceId: null,
    });
    const expectedTownGeoJson = payloadForGeoJsonFeature({
      properties: {
        name: validTownGeoJson.features[0].properties.name,
        uri: null,
      },
    });
    const result = await runPublicGeneratorCli({
      payloadOverrides: {
        mainFacilities: expectedMainFacilities,
        keyLocations: expectedKeyLocations,
        townGeoJson: expectedTownGeoJson,
      },
    });

    expectPublicBuildSuccess(result, "public generator explicit null metadata");
    expectNoFallbackBuildRequests(result);
    expect(result.requestedUris).toHaveLength(3);
    expect(result.atomicTempEntries).toEqual([]);
    expect(result.artifactContents).not.toBeNull();

    const artifact = JSON.parse(result.artifactContents as string) as {
      sources: {
        mainFacilities: unknown;
        keyLocations: unknown;
        townGeoJson: unknown;
      };
    };
    expect(artifact.sources).toEqual({
      mainFacilities: expectedMainFacilities,
      keyLocations: expectedKeyLocations,
      townGeoJson: expectedTownGeoJson,
    });
  });

  it("accepts a valid MultiPolygon through the public build lifecycle", async () => {
    const result = await runPublicGeneratorCli({
      payloadOverrides: { townGeoJson: validMultiPolygonTownGeoJson },
    });

    expectPublicBuildSuccess(result, "public generator MultiPolygon");
    expectNoFallbackBuildRequests(result);
    expect(result.requestedUris).toHaveLength(3);
    expect(result.atomicTempEntries).toEqual([]);
  });

  it.each(publicBuildFailureCases)(
    "projects %s validation/acquisition failure into a non-zero public build",
    async (label, options, expectedStderr) => {
      const result = await runPublicGeneratorCli(options);

      expectPublicBuildFailure(result, expectedStderr, label);
      expectNoFallbackBuildRequests(result);
      expect(result.artifactKind).toBe("missing");
      expect(result.atomicTempEntries).toEqual([]);
    },
  );

  it("projects a real artifact writer failure into a non-zero build without a partial file", async () => {
    const result = await runPublicGeneratorCli({ artifactAsDirectory: true });

    expectPublicBuildFailure(result, /directory|EISDIR|rename|write|artifact|failed/i, "writer failure");
    expectNoFallbackBuildRequests(result);
    expect(result.artifactKind).toBe("directory");
    expect(result.atomicTempEntries).toEqual([]);
  });

  it("preserves the previous artifact when validation fails before the atomic rename", async () => {
    const previousArtifact = JSON.stringify(ARTIFACT_SENTINEL);
    const result = await runPublicGeneratorCli({
      existingArtifact: previousArtifact,
      payloadOverrides: { keyLocations: [] },
    });

    expectPublicBuildFailure(result, /empty|key|location|validation|invalid|failed/i, "partial-write prevention");
    expectNoFallbackBuildRequests(result);
    expect(result.artifactKind).toBe("file");
    expect(result.artifactContents).toBe(previousArtifact);
    expect(result.atomicTempEntries).toEqual([]);
  });
});
