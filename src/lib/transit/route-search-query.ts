import type { Location, RouteQuery } from "@/types/core";

export type RouteSearchQuery = Required<
  Pick<RouteQuery, "origin" | "destination" | "time" | "isDeparture" | "prioritizeSpeed">
>;

export type ParsedRouteSearchParams =
  | { isValid: true; query: RouteSearchQuery }
  | { isValid: false; error: string };

const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function isCoordinateInRange(location: Location): boolean {
  return (
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180
  );
}

function parseLocation(value: string): Location | null {
  const parts = value.split(",");
  if (parts.length !== 2 || parts.some((part) => part.trim() === "")) {
    return null;
  }

  const location = { lat: Number(parts[0]), lng: Number(parts[1]) };
  return isCoordinateInRange(location) ? location : null;
}

function isValidLocalDateTime(value: string): boolean {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
  );
}

function parseBoolean(value: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function findParsedValue<T>(
  searchParams: URLSearchParams,
  name: string,
  parse: (value: string) => T | null,
): T | null {
  for (const value of searchParams.getAll(name)) {
    const parsed = parse(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function createSearchParams(query: RouteSearchQuery): URLSearchParams {
  return new URLSearchParams({
    origin: `${query.origin.lat},${query.origin.lng}`,
    destination: `${query.destination.lat},${query.destination.lng}`,
    time: query.time,
    isDeparture: String(query.isDeparture),
    prioritizeSpeed: String(query.prioritizeSpeed),
  });
}

export function parseRouteSearchParams(
  searchParams: URLSearchParams,
): ParsedRouteSearchParams {
  const origin = findParsedValue(searchParams, "origin", parseLocation);
  const destination = findParsedValue(searchParams, "destination", parseLocation);
  const time = findParsedValue(searchParams, "time", (value) =>
    isValidLocalDateTime(value) ? value : null,
  );
  const isDeparture = findParsedValue(searchParams, "isDeparture", parseBoolean);
  const prioritizeSpeed = findParsedValue(
    searchParams,
    "prioritizeSpeed",
    parseBoolean,
  );

  if (
    !origin ||
    !destination ||
    !time ||
    isDeparture === null ||
    prioritizeSpeed === null
  ) {
    return {
      isValid: false,
      error: "検索条件が不足しているか、正しくありません。",
    };
  }

  return {
    isValid: true,
    query: { origin, destination, time, isDeparture, prioritizeSpeed },
  };
}

export function buildRouteResultsUrl(query: RouteSearchQuery): string {
  return `/routes?${createSearchParams(query).toString()}`;
}

export function buildTransitApiUrl(query: RouteSearchQuery): string {
  const searchParams = createSearchParams(query);
  searchParams.set("type", "route");

  const orderedSearchParams = new URLSearchParams({ type: "route" });
  for (const [key, value] of searchParams) {
    if (key !== "type") orderedSearchParams.set(key, value);
  }
  return `/api/transit?${orderedSearchParams.toString()}`;
}
