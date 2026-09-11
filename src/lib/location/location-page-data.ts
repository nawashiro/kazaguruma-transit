import {
  readLocationArtifact,
  type LocationArtifact,
} from "@/lib/location/location-artifact";
import {
  isKeyLocationCategory,
  type KeyLocationCategory,
  type KeyLocationsDataResult,
} from "@/utils/addressLoader";

export { groupLocationsByArea } from "@/utils/geoUtils";

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

function projectKeyLocations(artifact: LocationArtifact): KeyLocationCategory[] | null {
  const sourceCategories: unknown = artifact.sources.keyLocations;
  if (!isKeyLocationCategoryArray(sourceCategories)) {
    return null;
  }

  return sourceCategories.map((category) => ({
    ...category,
    locations: category.locations.map((location) => {
      const derivedArea = artifact.derivedRegions[location.id];
      return {
        ...location,
        area:
          typeof derivedArea === "string" && derivedArea.trim().length > 0
            ? derivedArea
            : "その他",
      };
    }),
  }));
}

/**
 * Loads and validates the key-location dataset for server-rendered location pages.
 *
 * The build artifact reader owns transport-free decoding and validation.
 * Successful payloads are projected into the existing page result shape here so
 * the page can display build-time derived regions without mutating source data.
 */
export function loadLocationPageData(): KeyLocationsDataResult {
  try {
    const result: unknown = readLocationArtifact();

    if (!isRecord(result)) {
      return dataError("場所データの読み込み結果が不正です");
    }

    if (result.status === "error") {
      return result.error instanceof Error
        ? { status: "error", error: result.error }
        : dataError("場所データの読み込み結果が不正です");
    }

    if (result.status !== "success" || !isRecord(result.artifact)) {
      return dataError("場所データの形式が不正です");
    }

    const categories = projectKeyLocations(
      result.artifact as unknown as LocationArtifact,
    );
    if (categories === null) {
      return dataError("場所データの形式が不正です");
    }

    if (hasDuplicateLocationIds(categories)) {
      return dataError("場所データに重複したIDがあります");
    }

    return { status: "success", categories };
  } catch (error) {
    return { status: "error", error: normalizeError(error) };
  }
}
