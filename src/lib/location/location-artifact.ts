import fs from "node:fs";
import path from "node:path";

const INVALID_LOCATION_ID_PATTERN = /[\\/?#\u0000-\u001f\u007f-\u009f]/;
const INVALID_URI_CHARACTER_PATTERN = /[\u0000-\u0020\u007f-\u009f]/;

export interface LocationArtifactSourceUris {
  mainFacilitiesUri: string;
  keyLocationsUri: string;
  townGeoJsonUri: string;
}

type JsonRecord = Record<string, unknown>;
type LocationRecord = JsonRecord & { lat: number; lng: number };
type MainFacilityCategory = JsonRecord & {
  category: string;
  "category:en": string;
  locations: LocationRecord[];
};
type KeyLocation = LocationRecord & {
  id: string;
};
type KeyLocationCategory = JsonRecord & {
  category: string;
  "category:en": string;
  locations: KeyLocation[];
};
type PolygonCoordinates = number[][][];
type MultiPolygonCoordinates = number[][][][];
type GeoJsonFeature = JsonRecord & {
  type: "Feature";
  properties: JsonRecord & { name: string };
  geometry: JsonRecord & {
    type: "Polygon" | "MultiPolygon";
    coordinates: PolygonCoordinates | MultiPolygonCoordinates;
  };
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

export type LocationArtifactReadResult =
  | { status: "success"; artifact: LocationArtifact }
  | { status: "error"; error: Error };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function fail(message: string): never {
  throw new Error(`場所データの形式が不正です: ${message}`);
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
    fail(`${fieldPath} は絶対 http(s) URI である必要があります`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, fieldPath: string): string {
  if (!isNonEmptyString(value)) {
    fail(`${fieldPath} は空でない文字列である必要があります`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, fieldPath: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${fieldPath} は有限な数値である必要があります`);
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
    fail(`${fieldPath} は存在する場合に文字列である必要があります`);
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
    fail(`${fieldPath} は有効な場所識別子である必要があります`);
  }
  return value;
}

function validateLocationFields(
  value: unknown,
  fieldPath: string,
  requireKeyFields: boolean,
): LocationRecord {
  if (!isRecord(value)) {
    fail(`${fieldPath} はオブジェクトである必要があります`);
  }

  const location = value as LocationRecord;
  if (requireKeyFields) {
    requireLocationId(location.id, `${fieldPath}.id`);
    requireNonEmptyString(location.nodeCopyright, `${fieldPath}.nodeCopyright`);
  } else {
    requireNonEmptyString(location.copyright, `${fieldPath}.copyright`);
  }
  requireNonEmptyString(location.name, `${fieldPath}.name`);
  requireFiniteNumber(location.lat, `${fieldPath}.lat`);
  requireFiniteNumber(location.lng, `${fieldPath}.lng`);
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
  if (requireKeyFields) {
    validateOptionalString(
      location,
      "descriptionCopyright",
      `${fieldPath}.descriptionCopyright`,
    );
    validateOptionalString(
      location,
      "imageCopylight",
      `${fieldPath}.imageCopylight`,
    );
    validateOptionalFiniteNumber(
      location,
      "nodeSourceId",
      `${fieldPath}.nodeSourceId`,
    );
  }

  return location;
}

function validateCategories(
  value: unknown,
  sourceName: string,
  requireKeyFields: boolean,
): MainFacilityCategory[] | KeyLocationCategory[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${sourceName} は空でないカテゴリ配列である必要があります`);
  }

  const categoryIds = new Set<string>();
  const categories = value.map((rawCategory, categoryIndex) => {
    const categoryPath = `${sourceName}[${categoryIndex}]`;
    if (!isRecord(rawCategory)) {
      fail(`${categoryPath} はオブジェクトである必要があります`);
    }

    const categoryId = requireNonEmptyString(
      rawCategory["category:en"],
      `${categoryPath}.category:en`,
    );
    requireNonEmptyString(rawCategory.category, `${categoryPath}.category`);
    if (categoryIds.has(categoryId)) {
      fail(`${sourceName} に重複カテゴリ識別子があります: ${categoryId}`);
    }
    categoryIds.add(categoryId);

    if (!Array.isArray(rawCategory.locations) || rawCategory.locations.length === 0) {
      fail(`${categoryPath}.locations は空でない配列である必要があります`);
    }

    const locations = rawCategory.locations.map((location, locationIndex) =>
      validateLocationFields(
        location,
        `${categoryPath}.locations[${locationIndex}]`,
        requireKeyFields,
      ),
    );
    return {
      ...rawCategory,
      locations,
    } as MainFacilityCategory | KeyLocationCategory;
  });

  return categories as MainFacilityCategory[] | KeyLocationCategory[];
}

function validateMainFacilities(value: unknown): MainFacilityCategory[] {
  return validateCategories(value, "sources.mainFacilities", false) as MainFacilityCategory[];
}

function validateKeyLocations(value: unknown): KeyLocationCategory[] {
  const categories = validateCategories(
    value,
    "sources.keyLocations",
    true,
  ) as KeyLocationCategory[];
  const locationIds = new Set<string>();

  for (const [categoryIndex, category] of categories.entries()) {
    for (const [locationIndex, location] of category.locations.entries()) {
      const locationId = requireLocationId(
        location.id,
        `sources.keyLocations[${categoryIndex}].locations[${locationIndex}].id`,
      );
      if (locationIds.has(locationId)) {
        fail(`sources.keyLocations に重複場所識別子があります: ${locationId}`);
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
    fail(`${fieldPath} は有限な座標配列である必要があります`);
  }
  return value as number[];
}

function validatePolygonCoordinates(
  value: unknown,
  fieldPath: string,
): PolygonCoordinates {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${fieldPath} は空でないリング配列である必要があります`);
  }
  return value.map((ring, ringIndex) => {
    const ringPath = `${fieldPath}[${ringIndex}]`;
    if (!Array.isArray(ring) || ring.length === 0) {
      fail(`${ringPath} は空でない座標配列である必要があります`);
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
    fail(`${fieldPath} は空でないポリゴン配列である必要があります`);
  }
  return value.map((polygon, polygonIndex) =>
    validatePolygonCoordinates(polygon, `${fieldPath}[${polygonIndex}]`),
  );
}

function validateTownGeoJson(value: unknown): TownGeoJson {
  if (!isRecord(value) || value.type !== "FeatureCollection") {
    fail("sources.townGeoJson.type は FeatureCollection である必要があります");
  }
  if (!Array.isArray(value.features) || value.features.length === 0) {
    fail("sources.townGeoJson.features は空でない配列である必要があります");
  }

  const features = value.features.map((rawFeature, featureIndex) => {
    const featurePath = `sources.townGeoJson.features[${featureIndex}]`;
    if (!isRecord(rawFeature) || rawFeature.type !== "Feature") {
      fail(`${featurePath}.type は Feature である必要があります`);
    }
    if (!isRecord(rawFeature.properties)) {
      fail(`${featurePath}.properties はオブジェクトである必要があります`);
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
      fail(`${featurePath}.geometry はオブジェクトである必要があります`);
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
      fail(`${featurePath}.geometry.type は Polygon または MultiPolygon である必要があります`);
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
    fail("sourceUris はオブジェクトである必要があります");
  }
  return {
    mainFacilitiesUri: requireAbsoluteHttpUri(
      value.mainFacilitiesUri,
      "sourceUris.mainFacilitiesUri",
    ),
    keyLocationsUri: requireAbsoluteHttpUri(
      value.keyLocationsUri,
      "sourceUris.keyLocationsUri",
    ),
    townGeoJsonUri: requireAbsoluteHttpUri(
      value.townGeoJsonUri,
      "sourceUris.townGeoJsonUri",
    ),
  };
}

function validateDerivedRegions(
  value: unknown,
  keyLocations: KeyLocationCategory[],
): Record<string, string> {
  if (!isRecord(value)) {
    fail("derivedRegions はオブジェクトである必要があります");
  }

  const derivedRegions: Record<string, string> = {};
  for (const category of keyLocations) {
    for (const location of category.locations) {
      if (!Object.prototype.hasOwnProperty.call(value, location.id)) {
        fail(`場所 ${location.id} の導出地域がありません`);
      }
      const region = value[location.id];
      if (typeof region !== "string") {
        fail(`場所 ${location.id} の導出地域は文字列である必要があります`);
      }
      derivedRegions[location.id] = region;
    }
  }
  return derivedRegions;
}

function validateArtifact(value: unknown): LocationArtifact {
  if (!isRecord(value) || value.status !== "validated") {
    fail("artifact.status は validated である必要があります");
  }
  if (!isRecord(value.sources)) {
    fail("sources はオブジェクトである必要があります");
  }

  const mainFacilities = validateMainFacilities(value.sources.mainFacilities);
  const keyLocations = validateKeyLocations(value.sources.keyLocations);
  const townGeoJson = validateTownGeoJson(value.sources.townGeoJson);
  const sourceUris = validateSourceUris(value.sourceUris);
  const derivedRegions = validateDerivedRegions(value.derivedRegions, keyLocations);

  return {
    status: "validated",
    sourceUris,
    sources: {
      mainFacilities,
      keyLocations,
      townGeoJson,
    },
    derivedRegions,
  };
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Reads and validates the build artifact synchronously from the local path. */
export function readLocationArtifact(): LocationArtifactReadResult {
  const artifactPath = path.resolve(
    process.cwd(),
    "public",
    "generated",
    "location-data.json",
  );

  try {
    const raw = fs.readFileSync(artifactPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return {
      status: "success",
      artifact: validateArtifact(parsed),
    };
  } catch (error) {
    return {
      status: "error",
      error: normalizeError(error),
    };
  }
}
