import {
  isKeyLocationCategory,
  loadKeyLocationsDataResult,
  type KeyLocationCategory,
  type KeyLocationsDataResult,
} from "@/utils/addressLoader";

export { groupLocationsByArea, loadGeoJSON } from "@/utils/geoUtils";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isKeyLocationCategoryArray(value: unknown): value is KeyLocationCategory[] {
  return Array.isArray(value) && value.length > 0 && value.every(isKeyLocationCategory);
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function hasDuplicateLocationIds(categories: KeyLocationCategory[]): boolean {
  const locationIds = new Set<string>();

  for (const category of categories) {
    for (const location of category.locations) {
      if (locationIds.has(location.id)) {
        return true;
      }
      locationIds.add(location.id);
    }
  }

  return false;
}

function dataError(message: string): KeyLocationsDataResult {
  return { status: "error", error: new Error(message) };
}

/**
 * Loads and validates the key-location dataset for server-rendered location pages.
 *
 * The upstream loader owns transport and decoding failures. Successful payloads
 * are checked again here because this boundary also owns page-level invariants,
 * including dataset-wide location ID uniqueness.
 */
export async function loadLocationPageData(): Promise<KeyLocationsDataResult> {
  try {
    const result: unknown = await loadKeyLocationsDataResult();

    if (!isRecord(result)) {
      return dataError("場所データの読み込み結果が不正です");
    }

    if (result.status === "error") {
      return result.error instanceof Error
        ? (result as unknown as KeyLocationsDataResult)
        : dataError("場所データの読み込み結果が不正です");
    }

    if (
      result.status !== "success" ||
      !isKeyLocationCategoryArray(result.categories)
    ) {
      return dataError("場所データの形式が不正です");
    }

    const categories = result.categories;
    if (hasDuplicateLocationIds(categories)) {
      return dataError("場所データに重複したIDがあります");
    }

    return result as unknown as KeyLocationsDataResult;
  } catch (error) {
    return { status: "error", error: normalizeError(error) };
  }
}
