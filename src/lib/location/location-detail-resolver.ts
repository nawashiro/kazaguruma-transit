import type {
  LocationDetailErrorReason,
  LocationDetailResult,
} from "@/types/access-route-pages";
import { isKeyLocationCategory } from "@/utils/addressLoader";
import type {
  KeyLocation,
  KeyLocationsDataResult,
} from "@/utils/addressLoader";

const INVALID_LOCATION_ID_PATTERN = /[\\/?#\u0000-\u001f\u007f-\u009f]/;

type ResolvedLocationDetail = LocationDetailResult<KeyLocation>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createMalformedDataError(): Error {
  return new Error("場所データの形式が不正です");
}

function isKeyLocationsDataResult(value: unknown): value is KeyLocationsDataResult {
  if (!isRecord(value)) {
    return false;
  }

  if (value.status === "error") {
    return value.error instanceof Error;
  }

  return (
    value.status === "success" &&
    Array.isArray(value.categories) &&
    value.categories.every(isKeyLocationCategory)
  );
}

function isValidLocationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !INVALID_LOCATION_ID_PATTERN.test(value)
  );
}

function hasInvalidLoadedLocationId(value: unknown): boolean {
  if (!isRecord(value) || value.status !== "success" || !Array.isArray(value.categories)) {
    return false;
  }

  return value.categories.some((category) => {
    if (!isRecord(category) || !Array.isArray(category.locations)) {
      return false;
    }

    return category.locations.some(
      (location) => isRecord(location) && !isValidLocationId(location.id),
    );
  });
}

function collectLocations(
  categories: Extract<KeyLocationsDataResult, { status: "success" }>["categories"],
):
  | { status: "success"; locations: KeyLocation[] }
  | {
      status: "error";
      error: Error;
      reason: LocationDetailErrorReason;
    } {
  const locations: KeyLocation[] = [];
  const seenIds = new Set<string>();

  if (!Array.isArray(categories)) {
    return {
      status: "error",
      reason: "invalid-data",
      error: new Error("場所データの形式が不正です"),
    };
  }

  for (const category of categories) {
    if (!isKeyLocationCategory(category)) {
      return {
        status: "error",
        reason: "invalid-data",
        error: new Error("場所データの形式が不正です"),
      };
    }

    for (const location of category.locations) {
      if (
        typeof location !== "object" ||
        location === null ||
        !isValidLocationId(location.id)
      ) {
        return {
          status: "error",
          reason: "invalid-data",
          error: new Error("場所識別子が不正です"),
        };
      }

      if (seenIds.has(location.id)) {
        return {
          status: "error",
          reason: "duplicate-id",
          error: new Error("場所識別子が重複しています"),
        };
      }

      seenIds.add(location.id);
      locations.push(location);
    }
  }

  return { status: "success", locations };
}

/** Resolves one location ID while preserving transport and identity failures. */
export function resolveLocationDetail(
  id: unknown,
  data: KeyLocationsDataResult,
): ResolvedLocationDetail {
  if (!isValidLocationId(id)) {
    return {
      status: "error",
      reason: "invalid-request-id",
      error: new Error("場所識別子が不正です"),
    };
  }

  if (!isKeyLocationsDataResult(data)) {
    if (hasInvalidLoadedLocationId(data)) {
      return {
        status: "error",
        reason: "invalid-data",
        error: new Error("場所識別子が不正です"),
      };
    }

    return {
      status: "error",
      reason: "invalid-data",
      error: createMalformedDataError(),
    };
  }

  if (data.status === "error") {
    return {
      status: "data-load-error",
      error: data.error,
    };
  }

  const collected = collectLocations(data.categories);
  if (collected.status === "error") {
    return collected;
  }

  const matches = collected.locations.filter((location) => location.id === id);
  if (matches.length === 0) {
    return { status: "not-found" };
  }
  if (matches.length !== 1) {
    return {
      status: "error",
      reason: "duplicate-id",
      error: new Error("場所識別子が重複しています"),
    };
  }

  return { status: "success", location: matches[0] };
}
