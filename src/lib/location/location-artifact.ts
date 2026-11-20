import fs from "node:fs";
import path from "node:path";

import type {
  RouteDestinationCategory,
  RouteDestinationLocation,
} from "@/types/route-destinations";
import {
  isLocationImageData,
  type LocationImageData,
} from "@/lib/location/location-image";

const INVALID_URI_CHARACTER_PATTERN = /[\u0000-\u0020\u007f-\u009f]/;

export interface LocationArtifactSourceUris {
  placesJsonLdUri: string;
  osmMirrorUri: string;
  townGeoJsonUri: string;
  categoryNamesUri: string;
}

type JsonRecord = Record<string, unknown>;

const UUID_URN_PATTERN =
  /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CATEGORY_CODE_PATTERN = /^[0-9]{4}$/u;

export interface LocationEntry {
  id: string;
  name: string;
  lat: number;
  lng: number;
  imageUri?: string;
  imageCreator?: string;
  imageLicense?: string;
  image?: LocationImageData;
  relatedPages: Array<{ name: string; url: string }>;
  osmElement: { type: "node" | "way" | "relation"; id: number };
  wheelchair: "yes" | "limited" | "no" | null;
  phone?: { display: string; tel: string };
  websiteUri?: string;
  wikipediaUri?: string;
  osmEditUrl: string;
  openingHours?: string;
}

export interface LocationCategory {
  category: string;
  categoryId: string;
  locations: LocationEntry[];
}
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
    routeDestinations: RouteDestinationCategory[];
    locations: LocationCategory[];
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

function requireUuidUrn(value: unknown, fieldPath: string): string {
  if (typeof value !== "string" || !UUID_URN_PATTERN.test(value)) {
    fail(`${fieldPath} は urn:uuid 形式である必要があります`);
  }
  return value;
}

function validateOsmElement(value: unknown, fieldPath: string): LocationEntry["osmElement"] {
  if (!isRecord(value)) {
    fail(`${fieldPath} はオブジェクトである必要があります`);
  }
  const type = value["type"];
  if (type !== "node" && type !== "way" && type !== "relation") {
    fail(`${fieldPath}.type は node/way/relation である必要があります`);
  }
  const id = value["id"];
  if (typeof id !== "number" || !Number.isInteger(id)) {
    fail(`${fieldPath}.id は整数である必要があります`);
  }
  return { type, id } as LocationEntry["osmElement"];
}

function validateWheelchair(value: unknown, fieldPath: string): LocationEntry["wheelchair"] {
  if (value === null) {
    return null;
  }
  if (value === "yes" || value === "limited" || value === "no") {
    return value;
  }
  fail(`${fieldPath} は yes/limited/no/null である必要があります`);
}

function validateRelatedPages(value: unknown, fieldPath: string): LocationEntry["relatedPages"] {
  if (!Array.isArray(value)) {
    fail(`${fieldPath} は配列である必要があります`);
  }
  return value.map((raw, index) => {
    const pagePath = `${fieldPath}[${index}]`;
    if (!isRecord(raw)) {
      fail(`${pagePath} はオブジェクトである必要があります`);
    }
    return {
      name: requireNonEmptyString(raw["name"], `${pagePath}.name`),
      url: requireAbsoluteHttpUri(raw["url"], `${pagePath}.url`),
    };
  });
}

function validateLocationEntry(value: unknown, fieldPath: string): LocationEntry {
  if (!isRecord(value)) {
    fail(`${fieldPath} はオブジェクトである必要があります`);
  }
  const id = requireUuidUrn(value["id"], `${fieldPath}.id`);
  const name = requireNonEmptyString(value["name"], `${fieldPath}.name`);
  const lat = requireFiniteNumber(value["lat"], `${fieldPath}.lat`);
  const lng = requireFiniteNumber(value["lng"], `${fieldPath}.lng`);
  const osmElement = validateOsmElement(value["osmElement"], `${fieldPath}.osmElement`);
  const wheelchair = validateWheelchair(value["wheelchair"], `${fieldPath}.wheelchair`);
  const relatedPages = validateRelatedPages(value["relatedPages"], `${fieldPath}.relatedPages`);

  const hasImageUri = value["imageUri"] !== undefined && value["imageUri"] !== null;
  const hasImageCreator = value["imageCreator"] !== undefined && value["imageCreator"] !== null;
  const hasImageLicense = value["imageLicense"] !== undefined && value["imageLicense"] !== null;
  const hasAnyImage = hasImageUri || hasImageCreator || hasImageLicense;
  let imageUri: string | undefined;
  let imageCreator: string | undefined;
  let imageLicense: string | undefined;
  if (hasAnyImage) {
    imageUri = requireAbsoluteHttpUri(value["imageUri"], `${fieldPath}.imageUri`);
    imageCreator = requireNonEmptyString(value["imageCreator"], `${fieldPath}.imageCreator`);
    imageLicense = requireNonEmptyString(value["imageLicense"], `${fieldPath}.imageLicense`);
  }

  const hasImage = value["image"] !== undefined && value["image"] !== null;
  let image: LocationImageData | undefined;
  if (hasImage) {
    if (!isLocationImageData(value["image"])) {
      fail(`${fieldPath}.image は派生画像の形式が不正です`);
    }
    image = value["image"];
  }

  const hasPhone = value["phone"] !== undefined && value["phone"] !== null;
  let phone: { display: string; tel: string } | undefined;
  if (hasPhone) {
    const rawPhone = value["phone"];
    if (!isRecord(rawPhone)) {
      fail(`${fieldPath}.phone はオブジェクトである必要があります`);
    }
    phone = {
      display: requireNonEmptyString(rawPhone["display"], `${fieldPath}.phone.display`),
      tel: requireNonEmptyString(rawPhone["tel"], `${fieldPath}.phone.tel`),
    };
    if (!phone.tel.startsWith("tel:")) {
      fail(`${fieldPath}.phone.tel は tel: で始まる必要があります`);
    }
  }

  const hasWebsite = value["websiteUri"] !== undefined && value["websiteUri"] !== null;
  let websiteUri: string | undefined;
  if (hasWebsite) {
    websiteUri = requireAbsoluteHttpUri(value["websiteUri"], `${fieldPath}.websiteUri`);
  }

  const hasWikipedia = value["wikipediaUri"] !== undefined && value["wikipediaUri"] !== null;
  let wikipediaUri: string | undefined;
  if (hasWikipedia) {
    wikipediaUri = requireAbsoluteHttpUri(value["wikipediaUri"], `${fieldPath}.wikipediaUri`);
  }

  const osmEditUrl = requireAbsoluteHttpUri(value["osmEditUrl"], `${fieldPath}.osmEditUrl`);

  const hasOpeningHours = value["openingHours"] !== undefined && value["openingHours"] !== null;
  let openingHours: string | undefined;
  if (hasOpeningHours) {
    openingHours = requireNonEmptyString(value["openingHours"], `${fieldPath}.openingHours`);
  }

  const entry: LocationEntry = {
    id,
    name,
    lat,
    lng,
    relatedPages,
    osmElement,
    wheelchair,
    osmEditUrl,
  };
  if (imageUri !== undefined && imageCreator !== undefined && imageLicense !== undefined) {
    entry.imageUri = imageUri;
    entry.imageCreator = imageCreator;
    entry.imageLicense = imageLicense;
  }
  if (image !== undefined) {
    entry.image = image;
  }
  if (phone !== undefined) {
    entry.phone = phone;
  }
  if (websiteUri !== undefined) {
    entry.websiteUri = websiteUri;
  }
  if (wikipediaUri !== undefined) {
    entry.wikipediaUri = wikipediaUri;
  }
  if (openingHours !== undefined) {
    entry.openingHours = openingHours;
  }
  return entry;
}

function validateLocations(value: unknown): LocationCategory[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail("sources.locations は空でないカテゴリ配列である必要があります");
  }
  const categoryIds = new Set<string>();
  const locationIds = new Set<string>();
  return value.map((rawCategory, categoryIndex) => {
    const categoryPath = `sources.locations[${categoryIndex}]`;
    if (!isRecord(rawCategory)) {
      fail(`${categoryPath} はオブジェクトである必要があります`);
    }
    const categoryId = requireNonEmptyString(rawCategory["categoryId"], `${categoryPath}.categoryId`);
    if (!CATEGORY_CODE_PATTERN.test(categoryId)) {
      fail(`${categoryPath}.categoryId は4桁コードである必要があります`);
    }
    requireNonEmptyString(rawCategory["category"], `${categoryPath}.category`);
    if (categoryIds.has(categoryId)) {
      fail(`sources.locations に重複カテゴリ識別子があります: ${categoryId}`);
    }
    categoryIds.add(categoryId);
    if (!Array.isArray(rawCategory["locations"]) || (rawCategory["locations"] as unknown[]).length === 0) {
      fail(`${categoryPath}.locations は空でない配列である必要があります`);
    }
    const locations = (rawCategory["locations"] as unknown[]).map((loc, locIndex) => {
      const validated = validateLocationEntry(loc, `${categoryPath}.locations[${locIndex}]`);
      if (locationIds.has(validated.id)) {
        fail(`sources.locations に重複場所識別子があります: ${validated.id}`);
      }
      locationIds.add(validated.id);
      return validated;
    });
    return {
      category: rawCategory["category"] as string,
      categoryId,
      locations,
    } as LocationCategory;
  });
}

function validateRouteDestinations(value: unknown): RouteDestinationCategory[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail("sources.routeDestinations は空でないカテゴリ配列である必要があります");
  }

  const categoryIds = new Set<string>();
  return value.map((rawCategory, categoryIndex) => {
    const categoryPath = `sources.routeDestinations[${categoryIndex}]`;
    if (!isRecord(rawCategory)) {
      fail(`${categoryPath} はオブジェクトである必要があります`);
    }

    const categoryId = requireNonEmptyString(
      rawCategory.categoryId,
      `${categoryPath}.categoryId`,
    );
    requireNonEmptyString(rawCategory.category, `${categoryPath}.category`);
    if (categoryIds.has(categoryId)) {
      fail(`sources.routeDestinations に重複カテゴリ識別子があります: ${categoryId}`);
    }
    categoryIds.add(categoryId);

    if (!Array.isArray(rawCategory.locations) || rawCategory.locations.length === 0) {
      fail(`${categoryPath}.locations は空でない配列である必要があります`);
    }

    const locations = rawCategory.locations.map((location, locationIndex) => {
      const locationPath = `${categoryPath}.locations[${locationIndex}]`;
      if (!isRecord(location)) {
        fail(`${locationPath} はオブジェクトである必要があります`);
      }
      return {
        name: requireNonEmptyString(location.name, `${locationPath}.name`),
        lat: requireFiniteNumber(location.lat, `${locationPath}.lat`),
        lng: requireFiniteNumber(location.lng, `${locationPath}.lng`),
      } satisfies RouteDestinationLocation;
    });

    return {
      ...rawCategory,
      locations,
    } as RouteDestinationCategory;
  });
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
    placesJsonLdUri: requireAbsoluteHttpUri(
      value.placesJsonLdUri,
      "sourceUris.placesJsonLdUri",
    ),
    osmMirrorUri: requireAbsoluteHttpUri(
      value.osmMirrorUri,
      "sourceUris.osmMirrorUri",
    ),
    townGeoJsonUri: requireAbsoluteHttpUri(
      value.townGeoJsonUri,
      "sourceUris.townGeoJsonUri",
    ),
    categoryNamesUri: requireAbsoluteHttpUri(
      value.categoryNamesUri,
      "sourceUris.categoryNamesUri",
    ),
  };
}

function validateDerivedRegions(
  value: unknown,
  locations: LocationCategory[],
): Record<string, string> {
  if (!isRecord(value)) {
    fail("derivedRegions はオブジェクトである必要があります");
  }

  const derivedRegions: Record<string, string> = {};
  const requireRegion = (id: string) => {
    if (!Object.prototype.hasOwnProperty.call(value, id)) {
      fail(`場所 ${id} の導出地域がありません`);
    }
    const region = (value as Record<string, unknown>)[id];
    if (typeof region !== "string") {
      fail(`場所 ${id} の導出地域は文字列である必要があります`);
    }
    derivedRegions[id] = region;
  };
  for (const category of locations) {
    for (const location of category.locations) {
      requireRegion(location.id);
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

  const routeDestinations = validateRouteDestinations(
    value.sources.routeDestinations,
  );
  const locations = validateLocations(value.sources.locations);
  const townGeoJson = validateTownGeoJson(value.sources.townGeoJson);
  const sourceUris = validateSourceUris(value.sourceUris);
  const derivedRegions = validateDerivedRegions(value.derivedRegions, locations);

  return {
    status: "validated",
    sourceUris,
    sources: {
      routeDestinations,
      locations,
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
