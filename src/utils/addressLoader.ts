import { Location } from "@/types/core";
import type { LocationDataLoadResult } from "@/types/access-route-pages";

export interface AddressLocation {
  name: string;
  lat: number;
  lng: number;
  copyright?: string | null;
  licence?: string | null;
  licenceUri?: string | null;
  [key: string]: string | number | null | undefined;
}

export interface AddressCategory {
  category: string;
  "category:en"?: string;
  locations: AddressLocation[];
}

// 主要施設データ用の拡張インターフェース
export interface KeyLocation extends AddressLocation {
  id: string;
  description?: string | null;
  descriptionCopyright?: string | null;
  imageUri?: string | null;
  imageCopyright?: string | null;
  /** @deprecated Use imageCopyright instead. */
  imageCopylight?: string | null;
  uri?: string | null;
  nodeCopyright: string;
  nodeSourceId?: number | null;
  licence: string;
  licenceUri: string;
  [key: string]: string | number | null | undefined; // その他の属性（多言語名など）
}

export interface KeyLocationCategory {
  category: string;
  "category:en": string;
  locations: KeyLocation[];
}

export type KeyLocationsDataResult = LocationDataLoadResult<KeyLocationCategory>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const INVALID_LOCATION_ID_PATTERN = /[\\/?#\u0000-\u001f\u007f-\u009f]/;

function isValidLocationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !INVALID_LOCATION_ID_PATTERN.test(value)
  );
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

function isKeyLocation(value: unknown): value is KeyLocation {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isValidLocationId(value.id) &&
    isNonEmptyString(value.name) &&
    typeof value.lat === "number" &&
    Number.isFinite(value.lat) &&
    typeof value.lng === "number" &&
    Number.isFinite(value.lng) &&
    isNonEmptyString(value.nodeCopyright) &&
    isNonEmptyString(value.licence) &&
    isNonEmptyString(value.licenceUri) &&
    hasOptionalStringField(value, "description") &&
    hasOptionalStringField(value, "descriptionCopyright") &&
    hasOptionalStringField(value, "imageUri") &&
    hasOptionalStringField(value, "imageCopyright") &&
    hasOptionalStringField(value, "imageCopylight") &&
    hasOptionalStringField(value, "uri") &&
    hasOptionalFiniteNumberField(value, "nodeSourceId")
  );
}

/** Checks the documented category and primary-location wire shape. */
export function isKeyLocationCategory(value: unknown): value is KeyLocationCategory {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.category) ||
    !isNonEmptyString(value["category:en"])
  ) {
    return false;
  }

  return (
    Array.isArray(value.locations) &&
    value.locations.length > 0 &&
    value.locations.every(isKeyLocation)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function convertToLocation(address: {
  name: string;
  lat: number;
  lng: number;
}): Location {
  return {
    lat: address.lat,
    lng: address.lng,
    address: address.name,
  };
}
