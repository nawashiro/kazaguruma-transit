import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type {
  LocationDataArtifactOptions,
  LocationDataLoadOptions,
  LocationDataLoader,
  LocationDataSnapshot,
  LocationPageCategory,
  LocationPageLocation,
  LocationSuggestionCategory,
} from "../../types/location-pages";

interface RawMainFacilityLocation extends Record<string, unknown> {
  name: string;
  lat: number;
  lng: number;
}

interface RawMainFacilityCategory extends Record<string, unknown> {
  category: string;
  locations: RawMainFacilityLocation[];
}

interface RawKeyLocation extends Record<string, unknown> {
  id: string;
  name: string;
  lat: number;
  lng: number;
  nodeCopyright: string;
  licence: string;
  licenceUri: string;
  description?: string | null;
  descriptionCopyright?: string | null;
  imageUri?: string | null;
  imageCopyright?: string | null;
  imageCopylight?: string | null;
  uri?: string | null;
  nodeSourceId?: number | null;
}

interface RawKeyLocationCategory extends Record<string, unknown> {
  category: string;
  "category:en": string;
  locations: RawKeyLocation[];
}

type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

type TownGeometry =
  | { type: "Polygon"; coordinates: Polygon }
  | { type: "MultiPolygon"; coordinates: MultiPolygon };

interface TownFeature {
  name: string;
  geometry: TownGeometry;
}

interface ParsedBuildInput {
  locationsDataVersion: string;
  generatedAt: string;
  mainFacilities: RawMainFacilityCategory[];
  keyLocations: RawKeyLocationCategory[];
  townFeatures: TownFeature[];
}

const INVALID_IDENTIFIER_CHARACTER_PATTERN = /[\\/?#\u0000-\u001f\u007f-\u009f]/;
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;
const LOCATION_UNKNOWN_AREA_NAME = "地域不明";
const CHIYODA_ADDRESS_PREFIX_PATTERN = /^東京都千代田区/;
const POINT_ON_RING_EPSILON = 1e-12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function invalidLocationData(): Error {
  return new Error("施設データの形式が不正です");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLatitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

function isValidIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !INVALID_IDENTIFIER_CHARACTER_PATTERN.test(value)
  );
}

function isValidCategoryId(value: unknown): value is string {
  return isValidIdentifier(value) && value !== "." && value !== ".." && value !== "location-detail";
}

function hasOptionalStringField(record: Record<string, unknown>, key: string): boolean {
  return !(key in record) || record[key] === null || typeof record[key] === "string";
}

function hasOptionalFiniteNumberField(record: Record<string, unknown>, key: string): boolean {
  return (
    !(key in record) ||
    record[key] === null ||
    (typeof record[key] === "number" && Number.isFinite(record[key]))
  );
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isValidGeneratedAt(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const match = value.match(ISO_DATE_TIME_PATTERN);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }

  const timezone = match[8];
  if (timezone !== "Z") {
    const timezoneMatch = timezone.match(/^[+-](\d{2}):(\d{2})$/);
    if (timezoneMatch === null) {
      return false;
    }

    const timezoneHour = Number(timezoneMatch[1]);
    const timezoneMinute = Number(timezoneMatch[2]);
    if (timezoneHour > 23 || timezoneMinute > 59) {
      return false;
    }
  }

  return Number.isFinite(Date.parse(value));
}

function parseMainFacilityLocation(value: unknown): RawMainFacilityLocation {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.name) ||
    !isValidLatitude(value.lat) ||
    !isValidLongitude(value.lng)
  ) {
    throw invalidLocationData();
  }

  return value as RawMainFacilityLocation;
}

function parseMainFacilities(value: unknown): RawMainFacilityCategory[] {
  if (!Array.isArray(value)) {
    throw invalidLocationData();
  }

  return value.map((categoryValue) => {
    if (
      !isRecord(categoryValue) ||
      !isNonEmptyString(categoryValue.category) ||
      !Array.isArray(categoryValue.locations)
    ) {
      throw invalidLocationData();
    }

    return {
      ...(categoryValue as Record<string, unknown>),
      category: categoryValue.category,
      locations: categoryValue.locations.map(parseMainFacilityLocation),
    } as RawMainFacilityCategory;
  });
}

function parseKeyLocation(value: unknown): RawKeyLocation {
  if (
    !isRecord(value) ||
    !isValidIdentifier(value.id) ||
    !isNonEmptyString(value.name) ||
    !isValidLatitude(value.lat) ||
    !isValidLongitude(value.lng) ||
    !isNonEmptyString(value.nodeCopyright) ||
    !isNonEmptyString(value.licence) ||
    !isNonEmptyString(value.licenceUri) ||
    !hasOptionalStringField(value, "description") ||
    !hasOptionalStringField(value, "descriptionCopyright") ||
    !hasOptionalStringField(value, "imageUri") ||
    !hasOptionalStringField(value, "imageCopyright") ||
    !hasOptionalStringField(value, "imageCopylight") ||
    !hasOptionalStringField(value, "uri") ||
    !hasOptionalFiniteNumberField(value, "nodeSourceId")
  ) {
    throw invalidLocationData();
  }

  return value as RawKeyLocation;
}

function parseKeyLocations(value: unknown): RawKeyLocationCategory[] {
  if (!Array.isArray(value)) {
    throw invalidLocationData();
  }

  return value.map((categoryValue) => {
    if (
      !isRecord(categoryValue) ||
      !isNonEmptyString(categoryValue.category) ||
      !isValidCategoryId(categoryValue["category:en"]) ||
      !Array.isArray(categoryValue.locations)
    ) {
      throw invalidLocationData();
    }

    return {
      ...(categoryValue as Record<string, unknown>),
      category: categoryValue.category,
      "category:en": categoryValue["category:en"],
      locations: categoryValue.locations.map(parseKeyLocation),
    } as RawKeyLocationCategory;
  });
}

function parsePosition(value: unknown): Position {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    !value.every((coordinate) => isFiniteNumber(coordinate))
  ) {
    throw invalidLocationData();
  }

  const longitude = value[0];
  const latitude = value[1];
  if (!isValidLongitude(longitude) || !isValidLatitude(latitude)) {
    throw invalidLocationData();
  }

  return [longitude, latitude];
}

function parseRing(value: unknown): Ring {
  if (!Array.isArray(value) || value.length < 4) {
    throw invalidLocationData();
  }

  const ring = value.map(parsePosition);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw invalidLocationData();
  }

  return ring;
}

function parsePolygon(value: unknown): Polygon {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalidLocationData();
  }

  return value.map(parseRing);
}

function parseMultiPolygon(value: unknown): MultiPolygon {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalidLocationData();
  }

  return value.map(parsePolygon);
}

function parseTownGeoJson(value: unknown): TownFeature[] {
  if (!isRecord(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    throw invalidLocationData();
  }

  return value.features.map((featureValue) => {
    if (
      !isRecord(featureValue) ||
      featureValue.type !== "Feature" ||
      !isRecord(featureValue.properties) ||
      !isNonEmptyString(featureValue.properties.name) ||
      !isRecord(featureValue.geometry)
    ) {
      throw invalidLocationData();
    }

    const geometryValue = featureValue.geometry;
    if (geometryValue.type === "Polygon") {
      return {
        name: featureValue.properties.name,
        geometry: {
          type: "Polygon",
          coordinates: parsePolygon(geometryValue.coordinates),
        },
      };
    }

    if (geometryValue.type === "MultiPolygon") {
      return {
        name: featureValue.properties.name,
        geometry: {
          type: "MultiPolygon",
          coordinates: parseMultiPolygon(geometryValue.coordinates),
        },
      };
    }

    throw invalidLocationData();
  });
}

function parseBuildInput(input: unknown): ParsedBuildInput {
  if (
    !isRecord(input) ||
    !isNonEmptyString(input.locationsDataVersion) ||
    !isValidGeneratedAt(input.generatedAt)
  ) {
    throw invalidLocationData();
  }

  const mainFacilities = parseMainFacilities(input.mainFacilities);
  const keyLocations = parseKeyLocations(input.keyLocations);
  const townFeatures = parseTownGeoJson(input.townGeoJson);

  return {
    locationsDataVersion: input.locationsDataVersion,
    generatedAt: input.generatedAt,
    mainFacilities,
    keyLocations,
    townFeatures,
  };
}

function isPointOnSegment(point: Position, start: Position, end: Position): boolean {
  const crossProduct =
    (point[1] - start[1]) * (end[0] - start[0]) -
    (point[0] - start[0]) * (end[1] - start[1]);
  if (Math.abs(crossProduct) > POINT_ON_RING_EPSILON) {
    return false;
  }

  return (
    point[0] >= Math.min(start[0], end[0]) - POINT_ON_RING_EPSILON &&
    point[0] <= Math.max(start[0], end[0]) + POINT_ON_RING_EPSILON &&
    point[1] >= Math.min(start[1], end[1]) - POINT_ON_RING_EPSILON &&
    point[1] <= Math.max(start[1], end[1]) + POINT_ON_RING_EPSILON
  );
}

function isPointInRing(point: Position, ring: Ring): boolean {
  let inside = false;

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index++) {
    const start = ring[index];
    const end = ring[previousIndex];
    if (isPointOnSegment(point, start, end)) {
      return true;
    }

    const crossesLatitude = (start[1] > point[1]) !== (end[1] > point[1]);
    if (crossesLatitude) {
      const intersectionLongitude =
        ((end[0] - start[0]) * (point[1] - start[1])) / (end[1] - start[1]) + start[0];
      if (point[0] < intersectionLongitude) {
        inside = !inside;
      }
    }
  }

  return inside;
}

function isPointInPolygon(point: Position, polygon: Polygon): boolean {
  const [exteriorRing, ...holeRings] = polygon;
  return (
    isPointInRing(point, exteriorRing) &&
    !holeRings.some((holeRing) => isPointInRing(point, holeRing))
  );
}

function isPointInGeometry(point: Position, geometry: TownGeometry): boolean {
  if (geometry.type === "Polygon") {
    return isPointInPolygon(point, geometry.coordinates);
  }

  return geometry.coordinates.some((polygon) => isPointInPolygon(point, polygon));
}

function getAreaName(lat: number, lng: number, townFeatures: TownFeature[]): string {
  const point: Position = [lng, lat];
  for (const feature of townFeatures) {
    if (isPointInGeometry(point, feature.geometry)) {
      return feature.name.replace(CHIYODA_ADDRESS_PREFIX_PATTERN, "");
    }
  }

  return LOCATION_UNKNOWN_AREA_NAME;
}

function createSuggestionCategories(
  mainFacilities: RawMainFacilityCategory[],
): LocationSuggestionCategory[] {
  return mainFacilities.map((category) => ({
    categoryName: category.category,
    locations: category.locations.map((location) => ({
      name: location.name,
      lat: location.lat,
      lng: location.lng,
    })),
  }));
}

function createDetailedCategories(
  keyLocations: RawKeyLocationCategory[],
  townFeatures: TownFeature[],
): LocationPageCategory[] {
  const seenCategoryIds = new Set<string>();
  const seenFacilityIds = new Set<string>();

  for (const category of keyLocations) {
    const categoryId = category["category:en"];
    if (seenCategoryIds.has(categoryId)) {
      throw invalidLocationData();
    }
    seenCategoryIds.add(categoryId);

    for (const location of category.locations) {
      if (seenFacilityIds.has(location.id)) {
        throw invalidLocationData();
      }
      seenFacilityIds.add(location.id);
    }
  }

  return keyLocations.map((category) => ({
    id: category["category:en"],
    name: category.category,
    locations: category.locations.map((location) => {
      const locationWithArea: LocationPageLocation = {
        ...location,
        areaName: getAreaName(location.lat, location.lng, townFeatures),
      };
      return locationWithArea;
    }),
  }));
}

/** Builds the validated snapshot shape used by location pages. */
export function buildLocationData(input: unknown): LocationDataSnapshot {
  const parsed = parseBuildInput(input);

  return {
    locationsDataVersion: parsed.locationsDataVersion,
    generatedAt: parsed.generatedAt,
    suggestionCategories: createSuggestionCategories(parsed.mainFacilities),
    categories: createDetailedCategories(parsed.keyLocations, parsed.townFeatures),
  };
}

function isLocationDataLoader(value: unknown): value is LocationDataLoader {
  return typeof value === "function";
}

function parseLoadOptions(options: unknown): LocationDataLoadOptions {
  if (
    !isRecord(options) ||
    typeof options.locationsDataVersion !== "string" ||
    typeof options.generatedAt !== "string" ||
    !isLocationDataLoader(options.loadMainFacilities) ||
    !isLocationDataLoader(options.loadKeyLocations) ||
    !isLocationDataLoader(options.loadTownGeoJson)
  ) {
    throw invalidLocationData();
  }

  return {
    locationsDataVersion: options.locationsDataVersion,
    generatedAt: options.generatedAt,
    loadMainFacilities: options.loadMainFacilities,
    loadKeyLocations: options.loadKeyLocations,
    loadTownGeoJson: options.loadTownGeoJson,
  };
}

function invokeLoader(loader: LocationDataLoader): Promise<unknown> {
  return Promise.resolve().then(() => loader());
}

/** Loads all three build inputs and validates one shared snapshot. */
export async function loadAndBuildLocationData(
  options: LocationDataLoadOptions,
): Promise<LocationDataSnapshot> {
  const parsedOptions = parseLoadOptions(options);
  const [mainFacilities, keyLocations, townGeoJson] = await Promise.all([
    invokeLoader(parsedOptions.loadMainFacilities),
    invokeLoader(parsedOptions.loadKeyLocations),
    invokeLoader(parsedOptions.loadTownGeoJson),
  ]);

  return buildLocationData({
    locationsDataVersion: parsedOptions.locationsDataVersion,
    generatedAt: parsedOptions.generatedAt,
    mainFacilities,
    keyLocations,
    townGeoJson,
  });
}

function parseArtifactOptions(options: unknown): LocationDataArtifactOptions {
  if (!isRecord(options) || typeof options.outputPath !== "string" || options.outputPath.trim() === "") {
    throw invalidLocationData();
  }

  const loadOptions = parseLoadOptions(options);
  return {
    ...loadOptions,
    outputPath: options.outputPath,
  };
}

/** Generates an artifact atomically, preserving the previous file on failure. */
export async function generateLocationDataArtifact(
  options: LocationDataArtifactOptions,
): Promise<LocationDataSnapshot> {
  const parsedOptions = parseArtifactOptions(options);
  const snapshot = await loadAndBuildLocationData(parsedOptions);
  const outputDirectory = dirname(parsedOptions.outputPath);
  await mkdir(outputDirectory, { recursive: true });

  const temporaryPath = join(
    outputDirectory,
    `.${basename(parsedOptions.outputPath)}.${randomUUID()}.tmp`,
  );

  try {
    const serializedSnapshot = JSON.stringify(snapshot, null, 2);
    if (typeof serializedSnapshot !== "string") {
      throw invalidLocationData();
    }

    await writeFile(temporaryPath, `${serializedSnapshot}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, parsedOptions.outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }

  return snapshot;
}
