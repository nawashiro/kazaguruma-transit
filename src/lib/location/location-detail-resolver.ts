import { isDeepStrictEqual } from "node:util";

import type {
  LocationDetailErrorReason,
  LocationDetailResult,
} from "@/types/access-route-pages";
import type {
  LocationCategoryWithArea,
  LocationPageDataResult,
  LocationWithArea,
} from "@/lib/location/location-page-data";

const UUID_URN_PATTERN =
  /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

type ResolvedLocationDetail = LocationDetailResult<LocationWithArea>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createMalformedDataError(): Error {
  return new Error("場所データの形式が不正です");
}

function isLocationsDataResult(value: unknown): value is LocationPageDataResult {
  if (!isRecord(value)) {
    return false;
  }

  if (value.status === "error") {
    return value.error instanceof Error;
  }

  return (
    value.status === "success" &&
    Array.isArray(value.categories) &&
    value.categories.every(
      (category) =>
        isRecord(category) &&
        typeof category.category === "string" &&
        typeof category.categoryId === "string" &&
        Array.isArray(category.locations) &&
        category.locations.length > 0,
    )
  );
}

function isValidLocationId(value: unknown): value is string {
  return typeof value === "string" && UUID_URN_PATTERN.test(value);
}

function hasInvalidLoadedLocationId(value: unknown): boolean {
  if (!isRecord(value) || value.status !== "success" || !Array.isArray(value.categories)) {
    return false;
  }

  return (value.categories as unknown[]).some((category) => {
    if (!isRecord(category) || !Array.isArray(category.locations)) {
      return false;
    }

    return (category.locations as unknown[]).some(
      (location) => isRecord(location) && !isValidLocationId(location.id),
    );
  });
}

function collectLocations(
  categories: Extract<LocationPageDataResult, { status: "success" }>["categories"],
):
  | { status: "success"; locations: LocationWithArea[] }
  | {
      status: "error";
      error: Error;
      reason: LocationDetailErrorReason;
    } {
  const locations = new Map<string, LocationWithArea>();

  if (!Array.isArray(categories)) {
    return {
      status: "error",
      reason: "invalid-data",
      error: new Error("場所データの形式が不正です"),
    };
  }

  for (const category of categories) {
    if (
      !isRecord(category) ||
      typeof category.category !== "string" ||
      typeof category.categoryId !== "string" ||
      !Array.isArray(category.locations)
    ) {
      return {
        status: "error",
        reason: "invalid-data",
        error: new Error("場所データの形式が不正です"),
      };
    }

    for (const location of category.locations as unknown[]) {
      if (
        typeof location !== "object" ||
        location === null ||
        !isRecord(location) ||
        !isValidLocationId(location.id) ||
        typeof location.name !== "string" ||
        location.name.trim().length === 0 ||
        typeof location.lat !== "number" ||
        !Number.isFinite(location.lat) ||
        typeof location.lng !== "number" ||
        !Number.isFinite(location.lng)
      ) {
        return {
          status: "error",
          reason: "invalid-data",
          error: new Error("場所識別子が不正です"),
        };
      }

      const existing = locations.get(location.id as string);
      if (existing !== undefined) {
        if (!isDeepStrictEqual(existing, location)) {
          return {
            status: "error",
            reason: "duplicate-id",
            error: new Error("場所識別子が重複しています"),
          };
        }
        continue;
      }

      locations.set(location.id as string, location as unknown as LocationWithArea);
    }
  }

  return { status: "success", locations: [...locations.values()] };
}

/** Resolves one location ID while preserving transport and identity failures. */
export function resolveLocationDetail(
  id: unknown,
  data: LocationPageDataResult,
): ResolvedLocationDetail {
  if (!isValidLocationId(id)) {
    return {
      status: "error",
      reason: "invalid-request-id",
      error: new Error("場所識別子が不正です"),
    };
  }

  if (!isLocationsDataResult(data)) {
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

  const collected = collectLocations(data.categories as LocationCategoryWithArea[]);
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
