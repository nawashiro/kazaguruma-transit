import {
  readLocationArtifact,
  type LocationArtifact,
  type LocationCategory,
  type LocationEntry,
} from "@/lib/location/location-artifact";

export { groupLocationsByArea } from "@/utils/geoUtils";

export type LocationWithArea = LocationEntry & {
  area: string;
};

export type LocationCategoryWithArea = {
  category: string;
  categoryId: string;
  locations: LocationWithArea[];
};

export type LocationPageDataResult =
  | { status: "success"; categories: LocationCategoryWithArea[] }
  | { status: "error"; error: Error };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLocationCategoryArray(value: unknown): value is LocationCategory[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (category) =>
        isRecord(category) &&
        typeof category.category === "string" &&
        typeof category.categoryId === "string" &&
        Array.isArray(category.locations) &&
        category.locations.length > 0,
    )
  );
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function hasDuplicateLocationIds(categories: LocationCategoryWithArea[]): boolean {
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

function dataError(message: string): LocationPageDataResult {
  return { status: "error", error: new Error(message) };
}

function projectLocations(artifact: LocationArtifact): LocationCategoryWithArea[] | null {
  const sourceCategories: unknown = artifact.sources.locations;
  if (!isLocationCategoryArray(sourceCategories)) {
    return null;
  }

  return sourceCategories.map((category) => ({
    category: category.category,
    categoryId: category.categoryId,
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
 * Loads and validates the locations dataset for server-rendered location pages.
 *
 * The build artifact reader owns transport-free decoding and validation.
 * Successful payloads are projected into the existing page result shape here so
 * the page can display build-time derived regions without mutating source data.
 */
export function loadLocationPageData(): LocationPageDataResult {
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

    const categories = projectLocations(
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
