import { Location } from "@/types/core";
import type { LocationDataLoadResult } from "@/types/access-route-pages";
import { appConfig } from "@/lib/config/app-config";
import { logger } from "./logger";

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

export type AddressDataResult = LocationDataLoadResult<AddressCategory>;

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

function isKeyLocationCategoryArray(value: unknown): value is KeyLocationCategory[] {
  return Array.isArray(value) && value.length > 0 && value.every(isKeyLocationCategory);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isAddressLocation(value: unknown): value is AddressLocation {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.name) &&
    isFiniteNumber(value.lat) &&
    isFiniteNumber(value.lng) &&
    isNonEmptyString(value.copyright) &&
    isNonEmptyString(value.licence) &&
    isNonEmptyString(value.licenceUri)
  );
}

function isAddressCategory(value: unknown): value is AddressCategory {
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
    value.locations.every(isAddressLocation)
  );
}

function isAddressCategoryArray(value: unknown): value is AddressCategory[] {
  return Array.isArray(value) && value.length > 0 && value.every(isAddressCategory);
}

/** Loads popular facilities while preserving transport and decoding failures. */
export async function loadAddressDataResult(): Promise<AddressDataResult> {
  try {
    const version = appConfig.locationsDataVersion;
    const response = await fetch(
      `https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_main_facilities@${version}/kazaguruma_json_min/main_facilities.json`,
    );
    if (!response.ok) {
      throw new Error(`住所データの取得に失敗しました (HTTP ${response.status})`);
    }

    const data: unknown = await response.json();
    if (!isAddressCategoryArray(data)) {
      throw new Error("住所データの形式が不正です");
    }

    return { status: "success", categories: data };
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    logger.error("住所データ読み込みエラー:", normalizedError);
    return { status: "error", error: normalizedError };
  }
}

/** Loads key locations while preserving transport and decoding failures. */
export async function loadKeyLocationsDataResult(): Promise<KeyLocationsDataResult> {
  try {
    const version = appConfig.locationsDataVersion;
    const response = await fetch(
      `https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_main_facilities@${version}/kazaguruma_json_min/key_locations.json`
    );
    if (!response.ok) {
      throw new Error(`主要施設データの取得に失敗しました (HTTP ${response.status})`);
    }
    const data: unknown = await response.json();
    if (!isKeyLocationCategoryArray(data)) {
      throw new Error("主要施設データの形式が不正です");
    }
    return { status: "success", categories: data };
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    logger.error("主要施設データ読み込みエラー:", normalizedError);
    return { status: "error", error: normalizedError };
  }
}

export function convertToLocation(address: AddressLocation): Location {
  return {
    lat: address.lat,
    lng: address.lng,
    address: address.name,
  };
}
