import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import {
  findOsmElementKey,
  validateDestinationCatalog,
  type DestinationCatalog,
} from "../src/lib/location/destination-catalog";

const LOCATION_PREFIX = "東京都千代田区";
const INVALID_LOCATION_ID_PATTERN = /[\\/?#\u0000-\u001f\u007f-\u009f]/;
const INVALID_URI_CHARACTER_PATTERN = /[\u0000-\u0020\u007f-\u009f]/;

export interface LocationArtifactSourceUris {
  placesJsonLdUri: string;
  osmMirrorUri: string;
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
  destinationCatalog: unknown;
  transport: LocationArtifactTransport;
  writeArtifact: LocationArtifactWriter;
}

type JsonRecord = Record<string, unknown>;
type UnknownLocation = JsonRecord & {
  lat: number;
  lng: number;
};
type KeyLocation = UnknownLocation & {
  id: string;
  name: string;
  nodeCopyright: string;
  licence: string;
  licenceUri: string;
};

type KeyLocationCategory = JsonRecord & {
  category: string;
  "category:en": string;
  locations: KeyLocation[];
};

export interface RouteDestinationLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteDestinationCategory {
  category: string;
  "category:en": string;
  locations: RouteDestinationLocation[];
}

interface RouteDestinationGroup {
  category: string;
  "category:en": string;
  codes: readonly string[];
}

const ROUTE_DESTINATION_GROUPS: readonly RouteDestinationGroup[] = [
  {
    category: "行政・相談",
    "category:en": "government-and-consultation",
    codes: ["1302", "1304", "1219", "1606"],
  },
  {
    category: "子育て・福祉",
    "category:en": "childcare-and-welfare",
    codes: ["1307", "1402", "1403", "1499"],
  },
  {
    category: "学び・図書館",
    "category:en": "learning-and-libraries",
    codes: ["1512"],
  },
  {
    category: "博物館・美術館",
    "category:en": "museums-and-galleries",
    codes: ["0801", "0802", "0803"],
  },
  {
    category: "映画館",
    "category:en": "cinemas",
    codes: ["1011"],
  },
  {
    category: "公園・自然",
    "category:en": "parks-and-nature",
    codes: ["1003", "1004"],
  },
  {
    category: "寺社・教会",
    "category:en": "temples-and-churches",
    codes: ["0702", "0703"],
  },
  {
    category: "くらし・余暇",
    "category:en": "daily-life-and-leisure",
    codes: ["0903", "2603"],
  },
];

const GROUP_BY_CODE = new Map<string, RouteDestinationGroup>(
  ROUTE_DESTINATION_GROUPS.flatMap((group) =>
    group.codes.map((code) => [code, group] as const),
  ),
);

function parsePlacesJsonLd(value: unknown): Map<string, JsonRecord> {
  if (!isRecord(value) || !Array.isArray(value["@graph"])) {
    fail("places JSON-LD must contain an @graph array");
  }

  const records = new Map<string, JsonRecord>();
  for (const record of value["@graph"]) {
    if (!isRecord(record)) {
      continue;
    }
    const id = record["@id"];
    if (typeof id === "string" && id.startsWith("urn:uuid:")) {
      records.set(id, record);
    }
  }
  return records;
}

function parseOsmNames(value: unknown): Map<string, string | null> {
  if (!isRecord(value) || !Array.isArray(value.elements)) {
    fail("OSM tag mirror must contain an elements array");
  }

  const names = new Map<string, string | null>();
  for (const element of value.elements) {
    if (!isRecord(element)) {
      continue;
    }
    const type = element.type;
    const id = element.id;
    if (
      typeof type !== "string" ||
      (typeof id !== "number" && typeof id !== "string")
    ) {
      continue;
    }
    const tags = element.tags;
    const name = isRecord(tags) ? tags.name : undefined;
    names.set(`${type}/${id}`, isNonEmptyString(name) ? name.trim() : null);
  }
  return names;
}

function readRouteDestinationCoordinates(
  record: JsonRecord,
  id: string,
): { lat: number; lng: number } {
  const geo = record["schema:geo"];
  if (!isRecord(geo)) {
    fail(`掲載recordの座標が不正です: ${id}`);
  }
  const lat = geo["schema:latitude"];
  const lng = geo["schema:longitude"];
  if (
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    fail(`掲載recordの座標が不正です: ${id}`);
  }
  return { lat, lng };
}

function readGifPoiCode(record: JsonRecord, id: string): string {
  const identifiers = record["schema:identifier"];
  const codes = Array.isArray(identifiers)
    ? identifiers
        .filter(isRecord)
        .filter((identifier) => identifier["schema:propertyID"] === "gif-poi")
        .map((identifier) => identifier["schema:value"])
        .filter((value): value is string => isNonEmptyString(value))
    : [];

  if (codes.length !== 1) {
    fail(
      `掲載recordのgif-poi分類コードは1件である必要があります: ${id} (${codes.length}件)`,
    );
  }
  return codes[0];
}

function buildRouteDestinations(
  catalog: DestinationCatalog,
  placesPayload: unknown,
  osmPayload: unknown,
): RouteDestinationCategory[] {
  const records = parsePlacesJsonLd(placesPayload);
  const osmNames = parseOsmNames(osmPayload);
  const locationsByCategory = new Map<string, RouteDestinationLocation[]>();

  for (const entry of catalog.places) {
    if (!entry.includeInRouteForm) {
      continue;
    }

    const record = records.get(entry.id);
    if (record === undefined) {
      fail(`公開JSON-LDに掲載IDがありません: ${entry.id}`);
    }

    const coordinates = readRouteDestinationCoordinates(record, entry.id);
    const code = readGifPoiCode(record, entry.id);
    const group = GROUP_BY_CODE.get(code);
    if (group === undefined) {
      fail(`gif-poiコードが表示グループにありません: ${code} (${entry.id})`);
    }

    const osmElementKey = findOsmElementKey(record["rdfs:seeAlso"]);
    if (osmElementKey === null) {
      fail(`掲載recordにOSM要素の関連付けがありません: ${entry.id}`);
    }
    if (!osmNames.has(osmElementKey)) {
      fail(`OSMタグミラーに要素がありません: ${osmElementKey} (${entry.id})`);
    }
    const name = osmNames.get(osmElementKey);
    if (name === null || name === undefined) {
      fail(`OSM要素にnameがありません: ${osmElementKey} (${entry.id})`);
    }

    const locations = locationsByCategory.get(group["category:en"]) ?? [];
    locations.push({ name, lat: coordinates.lat, lng: coordinates.lng });
    locationsByCategory.set(group["category:en"], locations);
  }

  return ROUTE_DESTINATION_GROUPS.flatMap((group): RouteDestinationCategory[] => {
    const locations = locationsByCategory.get(group["category:en"]);
    if (locations === undefined || locations.length === 0) {
      return [];
    }
    return [
      {
        category: group.category,
        "category:en": group["category:en"],
        locations,
      },
    ];
  });
}

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
    routeDestinations: RouteDestinationCategory[];
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

function validateKeyLocationCategories(
  value: unknown,
  sourceName: string,
): KeyLocationCategory[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${sourceName} must be a non-empty category array`);
  }

  const categories: KeyLocationCategory[] = [];
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
      validateKeyLocation(
        location,
        `${categoryPath}.locations[${locationIndex}]`,
      ),
    );
    categories.push({
      ...rawCategory,
      locations,
    } as KeyLocationCategory);
  });

  return categories;
}

function validateKeyLocations(value: unknown): KeyLocationCategory[] {
  const categories = validateKeyLocationCategories(value, "keyLocations");
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
    placesJsonLdUri: requireAbsoluteHttpUri(
      value.placesJsonLdUri,
      "appConfig.placesJsonLdUri",
    ),
    osmMirrorUri: requireAbsoluteHttpUri(
      value.osmMirrorUri,
      "appConfig.osmMirrorUri",
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
 * Acquires, validates, and atomically publishes every location data source.
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
  const catalog = validateDestinationCatalog(options.destinationCatalog);
  if (catalog.source.placesUri !== sourceUris.placesJsonLdUri) {
    fail(
      "目録のsource.placesUriとappConfig.placesJsonLdUriが一致しません。目録を再生成してください",
    );
  }
  if (catalog.source.osmMirrorUri !== sourceUris.osmMirrorUri) {
    fail(
      "目録のsource.osmMirrorUriとappConfig.osmMirrorUriが一致しません。目録を再生成してください",
    );
  }

  const [placesPayload, osmPayload, keyPayload, townPayload] = await Promise.all([
    fetchJson("placesJsonLd", sourceUris.placesJsonLdUri, options.transport),
    fetchJson("osmMirror", sourceUris.osmMirrorUri, options.transport),
    fetchJson("keyLocations", sourceUris.keyLocationsUri, options.transport),
    fetchJson("townGeoJson", sourceUris.townGeoJsonUri, options.transport),
  ]);

  const routeDestinations = buildRouteDestinations(
    catalog,
    placesPayload,
    osmPayload,
  );
  const keyLocations = validateKeyLocations(keyPayload);
  const townGeoJson = validateTownGeoJson(townPayload);
  const artifact: LocationArtifact = {
    status: "validated",
    sourceUris,
    sources: {
      routeDestinations,
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
    const catalogPath = resolve(projectRoot, "data", "destinations.json");
    const destinationCatalog = JSON.parse(
      await readFile(catalogPath, "utf8"),
    ) as unknown;

    await generateLocationArtifact({
      appConfig,
      destinationCatalog,
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
