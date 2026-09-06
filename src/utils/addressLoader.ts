import { Location } from "@/types/core";
import type { LocationDataLoadResult } from "@/types/access-route-pages";
import generatedLocationData from "@/generated/location-data.json";
import { appConfig } from "@/lib/config/app-config";
import { logger } from "./logger";

export interface AddressLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface AddressCategory {
  category: string;
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

export async function loadAddressData(): Promise<AddressCategory[]> {
  return generatedLocationData.suggestionCategories.map(({ categoryName, locations }) => ({
    category: categoryName,
    locations: locations.map(({ name, lat, lng }) => ({ name, lat, lng })),
  }));
}

// 生成済みスナップショットから主要施設データを読み込む関数
export async function loadKeyLocationsData(): Promise<KeyLocationCategory[]> {
  return generatedLocationData.categories.map(({ id, name, locations }) => ({
    category: name,
    "category:en": id,
    locations: locations.map((location) => ({ ...location })),
  }));
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
    typeof value.name === "string" &&
    typeof value.lat === "number" &&
    Number.isFinite(value.lat) &&
    typeof value.lng === "number" &&
    Number.isFinite(value.lng) &&
    typeof value.nodeCopyright === "string" &&
    typeof value.licence === "string" &&
    typeof value.licenceUri === "string" &&
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
  if (!isRecord(value) || typeof value.category !== "string" || typeof value["category:en"] !== "string") {
    return false;
  }

  return Array.isArray(value.locations) && value.locations.every(isKeyLocation);
}

function isKeyLocationCategoryArray(value: unknown): value is KeyLocationCategory[] {
  return Array.isArray(value) && value.every(isKeyLocationCategory);
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
