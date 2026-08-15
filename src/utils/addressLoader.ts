import { Location } from "@/types/core";
import type { LocationDataLoadResult } from "@/types/access-route-pages";
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
  try {
    const version = process.env.NEXT_PUBLIC_LOCATIONS_DATA_VERSION || "1.0.0";
    const response = await fetch(
      `https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_main_facilities@${version}/kazaguruma_json_min/main_facilities.json`
    );
    if (response.ok) {
      logger.log("住所データを読み込みました");
    } else {
      throw new Error("住所データの取得に失敗しました");
    }
    const data = await response.json();
    return data as AddressCategory[];
  } catch (error) {
    logger.error("住所データ読み込みエラー:", error);
    return [];
  }
}

// key_locations.jsonからデータを読み込む関数
export async function loadKeyLocationsData(): Promise<KeyLocationCategory[]> {
  try {
    const version = process.env.NEXT_PUBLIC_LOCATIONS_DATA_VERSION || "1.0.0";
    const response = await fetch(
      `https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_main_facilities@${version}/kazaguruma_json_min/key_locations.json`
    );
    if (!response.ok) {
      throw new Error("主要施設データの取得に失敗しました");
    }
    const data = await response.json();
    return data as KeyLocationCategory[];
  } catch (error) {
    logger.error("主要施設データ読み込みエラー:", error);
    return [];
  }
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
    const version = process.env.NEXT_PUBLIC_LOCATIONS_DATA_VERSION || "1.0.0";
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
