import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const LOCATION_PREFIX = "東京都千代田区";
const INVALID_LOCATION_ID_PATTERN = /[\\/?#\u0000-\u001f\u007f-\u009f]/;
const INVALID_URI_CHARACTER_PATTERN = /[\u0000-\u0020\u007f-\u009f]/;

export interface LocationArtifactSourceUris {
  mainFacilitiesUri: string;
  keyLocationsUri: string;
  townGeoJsonUri: string;
}

export interface LocationArtifactTransportResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type LocationArtifactTransport = (
  uri: string,
) => Promise<LocationArtifactTransportResponse>;

export type LocationArtifactWriter = (
  artifact: LocationArtifact,
) => Promise<void> | void;

export interface GenerateLocationArtifactOptions {
  appConfig: unknown;
  transport: LocationArtifactTransport;
  writeArtifact: LocationArtifactWriter;
}

type JsonRecord = Record<string, unknown>;
type UnknownLocation = JsonRecord & {
  lat: number;
  lng: number;
};
type MainFacility = UnknownLocation & {
  name: string;
  copyright: string;
  licence: string;
  licenceUri: string;
};
type KeyLocation = UnknownLocation & {
  id: string;
  name: string;
  nodeCopyright: string;
  licence: string;
  licenceUri: string;
};

type MainFacilityCategory = JsonRecord & {
  category: string;
  "category:en": string;
  locations: MainFacility[];
};
type KeyLocationCategory = JsonRecord & {
  category: string;
  "category:en": string;
  locations: KeyLocation[];
};

type PolygonCoordinates = number[][][];
type MultiPolygonCoordinates = number[][][][];
type GeoJsonGeometry = JsonRecord &
  (
    | { type: "Polygon"; coordinates: PolygonCoordinates }
    | { type: "MultiPolygon"; coordinates: MultiPolygonCoordinates }
  );

type GeoJsonFeature = JsonRecord & {
  type: "Feature";
  properties: JsonRecord & { name: string };
  geometry: GeoJsonGeometry;
};

type TownGeoJson = JsonRecord & {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

export interface LocationArtifact {
  status: "validated";
  sourceUris: LocationArtifactSourceUris;
  sources: {
    mainFacilities: MainFacilityCategory[];
    keyLocations: KeyLocationCategory[];
    townGeoJson: TownGeoJson;
  };
  derivedRegions: Record<string, string>;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function fail(message: string): never {
  throw new Error(`Location artifact validation failed: ${message}`);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAbsoluteHttpUri(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    INVALID_URI_CHARACTER_PATTERN.test(value)
  ) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function requireAbsoluteHttpUri(value: unknown, fieldPath: string): string {
  if (!isAbsoluteHttpUri(value)) {
    fail(`${fieldPath} must be an absolute http(s) URI`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, fieldPath: string): string {
  if (!isNonEmptyString(value)) {
    fail(`${fieldPath} must be a non-empty string`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, fieldPath: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${fieldPath} must be a finite number`);
  }
  return value;
}

function validateOptionalString(
  record: JsonRecord,
  fieldName: string,
  fieldPath: string,
): void {
  if (
    !(fieldName in record) ||
    record[fieldName] === undefined ||
    record[fieldName] === null
  ) {
    return;
  }
  if (typeof record[fieldName] !== "string") {
    fail(`${fieldPath} must be a string when present`);
  }
}

function validateOptionalUri(
  record: JsonRecord,
  fieldName: string,
  fieldPath: string,
): void {
  if (
    !(fieldName in record) ||
    record[fieldName] === undefined ||
    record[fieldName] === null
  ) {
    return;
  }
  requireAbsoluteHttpUri(record[fieldName], fieldPath);
}

function validateOptionalFiniteNumber(
  record: JsonRecord,
  fieldName: string,
  fieldPath: string,
): void {
  if (
    !(fieldName in record) ||
    record[fieldName] === undefined ||
    record[fieldName] === null
  ) {
    return;
  }
  requireFiniteNumber(record[fieldName], fieldPath);
}

function validateMainFacility(
  value: unknown,
  fieldPath: string,
): MainFacility {
  if (!isRecord(value)) {
    fail(`${fieldPath} must be an object`);
  }

  const location: MainFacility = value as MainFacility;
  requireNonEmptyString(location.name, `${fieldPath}.name`);
  requireFiniteNumber(location.lat, `${fieldPath}.lat`);
  requireFiniteNumber(location.lng, `${fieldPath}.lng`);
  requireNonEmptyString(location.copyright, `${fieldPath}.copyright`);
  requireNonEmptyString(location.licence, `${fieldPath}.licence`);
  requireAbsoluteHttpUri(location.licenceUri, `${fieldPath}.licenceUri`);
  validateOptionalString(location, "description", `${fieldPath}.description`);
  validateOptionalUri(location, "imageUri", `${fieldPath}.imageUri`);
  validateOptionalString(
    location,
    "imageCopyright",
    `${fieldPath}.imageCopyright`,
  );
  validateOptionalUri(location, "uri", `${fieldPath}.uri`);

  return location;
}

function isValidLocationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !INVALID_LOCATION_ID_PATTERN.test(value)
  );
}

function requireLocationId(value: unknown, fieldPath: string): string {
  if (!isValidLocationId(value)) {
    fail(`${fieldPath} must be a valid location identifier`);
  }
  return value;
}

function validateKeyLocation(value: unknown, fieldPath: string): KeyLocation {
  if (!isRecord(value)) {
    fail(`${fieldPath} must be an object`);
  }

  const location: KeyLocation = value as KeyLocation;
  requireLocationId(location.id, `${fieldPath}.id`);
  requireNonEmptyString(location.name, `${fieldPath}.name`);
  requireFiniteNumber(location.lat, `${fieldPath}.lat`);
  requireFiniteNumber(location.lng, `${fieldPath}.lng`);
  requireNonEmptyString(location.nodeCopyright, `${fieldPath}.nodeCopyright`);
  requireNonEmptyString(location.licence, `${fieldPath}.licence`);
  requireAbsoluteHttpUri(location.licenceUri, `${fieldPath}.licenceUri`);
  validateOptionalString(location, "description", `${fieldPath}.description`);
  validateOptionalString(
    location,
    "descriptionCopyright",
    `${fieldPath}.descriptionCopyright`,
  );
  validateOptionalUri(location, "imageUri", `${fieldPath}.imageUri`);
  validateOptionalString(
    location,
    "imageCopyright",
    `${fieldPath}.imageCopyright`,
  );
  validateOptionalString(
    location,
    "imageCopylight",
    `${fieldPath}.imageCopylight`,
  );
  validateOptionalUri(location, "uri", `${fieldPath}.uri`);
  validateOptionalFiniteNumber(
    location,
    "nodeSourceId",
    `${fieldPath}.nodeSourceId`,
  );

  return location;
}

function validateCategoryArray(
  value: unknown,
  sourceName: string,
  locationValidator: (value: unknown, fieldPath: string) => UnknownLocation,
): Array<MainFacilityCategory | KeyLocationCategory> {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${sourceName} must be a non-empty category array`);
  }

  const categories: Array<MainFacilityCategory | KeyLocationCategory> = [];
  const categoryIds = new Set<string>();

  value.forEach((rawCategory, categoryIndex) => {
    const categoryPath = `${sourceName}[${categoryIndex}]`;
    if (!isRecord(rawCategory)) {
      fail(`${categoryPath} must be an object`);
    }

    const categoryId = requireNonEmptyString(
      rawCategory["category:en"],
      `${categoryPath}.category:en`,
    );
    requireNonEmptyString(rawCategory.category, `${categoryPath}.category`);
    if (categoryIds.has(categoryId)) {
      fail(`${sourceName} contains duplicate category identifier ${categoryId}`);
    }
    categoryIds.add(categoryId);

    const rawLocations = rawCategory.locations;
    if (!Array.isArray(rawLocations) || rawLocations.length === 0) {
      fail(`${categoryPath}.locations must be a non-empty array`);
    }

    const locations = rawLocations.map((location, locationIndex) =>
      locationValidator(location, `${categoryPath}.locations[${locationIndex}]`),
    );
    categories.push({
      ...rawCategory,
      locations,
    } as MainFacilityCategory | KeyLocationCategory);
  });

  return categories;
}

function validateMainFacilities(value: unknown): MainFacilityCategory[] {
  return validateCategoryArray(
    value,
    "mainFacilities",
    validateMainFacility,
  ) as MainFacilityCategory[];
}

function validateKeyLocations(value: unknown): KeyLocationCategory[] {
  const categories = validateCategoryArray(
    value,
    "keyLocations",
    validateKeyLocation,
  ) as KeyLocationCategory[];
  const locationIds = new Set<string>();

  for (const [categoryIndex, category] of categories.entries()) {
    for (const [locationIndex, location] of category.locations.entries()) {
      const fieldPath = `keyLocations[${categoryIndex}].locations[${locationIndex}].id`;
      const locationId = requireLocationId(location.id, fieldPath);
      if (locationIds.has(locationId)) {
        fail(`keyLocations contains duplicate location identifier ${locationId}`);
      }
      locationIds.add(locationId);
    }
  }

  return categories;
}

function validatePosition(value: unknown, fieldPath: string): number[] {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    !value.every(
      (coordinate) =>
        typeof coordinate === "number" && Number.isFinite(coordinate),
    )
  ) {
    fail(`${fieldPath} must contain only finite coordinate numbers`);
  }
  return value as number[];
}

function validatePolygonCoordinates(
  value: unknown,
  fieldPath: string,
): PolygonCoordinates {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${fieldPath} must contain at least one ring`);
  }

  return value.map((ring, ringIndex) => {
    const ringPath = `${fieldPath}[${ringIndex}]`;
    if (!Array.isArray(ring) || ring.length === 0) {
      fail(`${ringPath} must contain at least one position`);
    }
    return ring.map((position, positionIndex) =>
      validatePosition(position, `${ringPath}[${positionIndex}]`),
    );
  });
}

function validateMultiPolygonCoordinates(
  value: unknown,
  fieldPath: string,
): MultiPolygonCoordinates {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${fieldPath} must contain at least one polygon`);
  }

  return value.map((polygon, polygonIndex) =>
    validatePolygonCoordinates(polygon, `${fieldPath}[${polygonIndex}]`),
  );
}

function validateTownGeoJson(value: unknown): TownGeoJson {
  if (!isRecord(value) || value.type !== "FeatureCollection") {
    fail("townGeoJson must be a FeatureCollection");
  }
  if (!Array.isArray(value.features) || value.features.length === 0) {
    fail("townGeoJson.features must be a non-empty array");
  }

  const features: GeoJsonFeature[] = value.features.map((rawFeature, featureIndex) => {
    const featurePath = `townGeoJson.features[${featureIndex}]`;
    if (!isRecord(rawFeature) || rawFeature.type !== "Feature") {
      fail(`${featurePath}.type must be Feature`);
    }
    if (!isRecord(rawFeature.properties)) {
      fail(`${featurePath}.properties must be an object`);
    }
    requireNonEmptyString(
      rawFeature.properties.name,
      `${featurePath}.properties.name`,
    );
    validateOptionalUri(
      rawFeature.properties,
      "uri",
      `${featurePath}.properties.uri`,
    );

    if (!isRecord(rawFeature.geometry)) {
      fail(`${featurePath}.geometry must be an object`);
    }

    let coordinates: PolygonCoordinates | MultiPolygonCoordinates;
    if (rawFeature.geometry.type === "Polygon") {
      coordinates = validatePolygonCoordinates(
        rawFeature.geometry.coordinates,
        `${featurePath}.geometry.coordinates`,
      );
    } else if (rawFeature.geometry.type === "MultiPolygon") {
      coordinates = validateMultiPolygonCoordinates(
        rawFeature.geometry.coordinates,
        `${featurePath}.geometry.coordinates`,
      );
    } else {
      fail(`${featurePath}.geometry.type must be Polygon or MultiPolygon`);
    }

    return {
      ...rawFeature,
      geometry: {
        ...rawFeature.geometry,
        coordinates,
      },
    } as GeoJsonFeature;
  });

  return {
    ...value,
    features,
  } as TownGeoJson;
}

function validateSourceUris(value: unknown): LocationArtifactSourceUris {
  if (!isRecord(value)) {
    fail("appConfig must be an object");
  }

  return {
    mainFacilitiesUri: requireAbsoluteHttpUri(
      value.mainFacilitiesUri,
      "appConfig.mainFacilitiesUri",
    ),
    keyLocationsUri: requireAbsoluteHttpUri(
      value.keyLocationsUri,
      "appConfig.keyLocationsUri",
    ),
    townGeoJsonUri: requireAbsoluteHttpUri(
      value.townGeoJsonUri,
      "appConfig.townGeoJsonUri",
    ),
  };
}

function pointOnSegment(
  point: [number, number],
  start: number[],
  end: number[],
): boolean {
  const [x, y] = point;
  const [startX, startY] = start;
  const [endX, endY] = end;
  const cross = (x - startX) * (endY - startY) - (y - startY) * (endX - startX);
  if (Math.abs(cross) > Number.EPSILON) {
    return false;
  }
  return (
    x >= Math.min(startX, endX) &&
    x <= Math.max(startX, endX) &&
    y >= Math.min(startY, endY) &&
    y <= Math.max(startY, endY)
  );
}

function isPointInRing(point: [number, number], ring: PolygonCoordinates[number]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (pointOnSegment(point, currentPoint, previousPoint)) {
      return true;
    }

    const intersects =
      currentPoint[1] > point[1] !== previousPoint[1] > point[1] &&
      point[0] <
        ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])) /
          (previousPoint[1] - currentPoint[1]) +
          currentPoint[0];
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function isPointInPolygon(
  point: [number, number],
  polygon: PolygonCoordinates,
): boolean {
  if (!isPointInRing(point, polygon[0])) {
    return false;
  }
  return polygon.slice(1).every((hole) => !isPointInRing(point, hole));
}

function isPointInGeometry(
  point: [number, number],
  geometry: GeoJsonFeature["geometry"],
): boolean {
  if (geometry.type === "Polygon") {
    return isPointInPolygon(point, geometry.coordinates);
  }
  return geometry.coordinates.some((polygon) => isPointInPolygon(point, polygon));
}

function displayRegionName(name: string): string {
  return name.startsWith(LOCATION_PREFIX)
    ? name.slice(LOCATION_PREFIX.length)
    : name;
}

function deriveRegions(
  keyLocations: KeyLocationCategory[],
  townGeoJson: TownGeoJson,
): Record<string, string> {
  const derivedRegions: Record<string, string> = {};

  for (const category of keyLocations) {
    for (const location of category.locations) {
      let regionName = "その他";
      const point: [number, number] = [location.lng, location.lat];
      for (const feature of townGeoJson.features) {
        if (isPointInGeometry(point, feature.geometry)) {
          regionName = displayRegionName(feature.properties.name);
          break;
        }
      }
      derivedRegions[location.id] = regionName;
    }
  }

  return derivedRegions;
}

async function fetchJson(
  sourceName: string,
  uri: string,
  transport: LocationArtifactTransport,
): Promise<unknown> {
  const response = await transport(uri);
  if (!response || typeof response !== "object") {
    fail(`${sourceName} transport returned an invalid response`);
  }
  if (!response.ok || response.status < 200 || response.status >= 300) {
    throw new Error(`${sourceName} request failed with HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Acquires, validates, and atomically publishes the three location data sources.
 * The writer is called exactly once, after every source and derived region has
 * passed validation.
 */
export async function generateLocationArtifact(
  options: GenerateLocationArtifactOptions,
): Promise<LocationArtifact> {
  if (!isRecord(options)) {
    throw new Error("Location artifact generator options must be an object");
  }
  if (typeof options.transport !== "function") {
    throw new Error("Location artifact generator requires a transport function");
  }
  if (typeof options.writeArtifact !== "function") {
    throw new Error("Location artifact generator requires a writer function");
  }

  const sourceUris = validateSourceUris(options.appConfig);
  const [mainPayload, keyPayload, townPayload] = await Promise.all([
    fetchJson("mainFacilities", sourceUris.mainFacilitiesUri, options.transport),
    fetchJson("keyLocations", sourceUris.keyLocationsUri, options.transport),
    fetchJson("townGeoJson", sourceUris.townGeoJsonUri, options.transport),
  ]);

  const mainFacilities = validateMainFacilities(mainPayload);
  const keyLocations = validateKeyLocations(keyPayload);
  const townGeoJson = validateTownGeoJson(townPayload);
  const artifact: LocationArtifact = {
    status: "validated",
    sourceUris,
    sources: {
      mainFacilities,
      keyLocations,
      townGeoJson,
    },
    derivedRegions: deriveRegions(keyLocations, townGeoJson),
  };

  await options.writeArtifact(artifact);
  return artifact;
}

async function fetchFromNetwork(
  uri: string,
): Promise<LocationArtifactTransportResponse> {
  const response = await fetch(uri);
  return {
    ok: response.ok,
    status: response.status,
    json: async () => {
      try {
        return await response.json();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`JSON decode failed for ${uri}: ${detail}`, {
          cause: error,
        });
      }
    },
  };
}

async function writeArtifactAtomically(
  artifact: LocationArtifact,
  artifactPath: string,
): Promise<void> {
  const artifactDirectory = dirname(artifactPath);
  let temporaryPath: string | null = null;

  try {
    await mkdir(artifactDirectory, { recursive: true });
    temporaryPath = resolve(
      artifactDirectory,
      `.location-data.json.${process.pid}.${randomUUID()}.tmp`,
    );
    await writeFile(
      temporaryPath,
      `${JSON.stringify(artifact)}\n`,
      "utf8",
    );
    await rename(temporaryPath, artifactPath);
    temporaryPath = null;
  } finally {
    if (temporaryPath !== null) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

async function runCli(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const appConfigPath = resolve(projectRoot, "app-config.json");
    const artifactPath = resolve(
      projectRoot,
      "public",
      "generated",
      "location-data.json",
    );
    const appConfig = JSON.parse(await readFile(appConfigPath, "utf8")) as unknown;

    await generateLocationArtifact({
      appConfig,
      transport: fetchFromNetwork,
      writeArtifact: (artifact) => writeArtifactAtomically(artifact, artifactPath),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${detail}\n`);
    process.exitCode = 1;
  }
}

function isDirectCliInvocation(): boolean {
  const entrypoint = process.argv[1];
  return (
    typeof entrypoint === "string" &&
    basename(entrypoint) === "generate-location-artifact.ts"
  );
}

if (isDirectCliInvocation()) {
  void runCli();
}
