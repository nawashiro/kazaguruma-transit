import type { Location } from "@/types/core";
import {
  loadKeyLocationsData,
  type KeyLocation,
  type KeyLocationCategory,
} from "@/utils/addressLoader";
import {
  formatAreaName,
  getAreaNameFromCoordinates,
  groupLocationsByArea,
  loadGeoJSON,
} from "@/utils/clientGeoUtils";

export type LocationListStatus = "loading" | "ready" | "error";
export type LocationListOperation = "categories" | "position" | "detail";

export interface LocationWithDistance {
  lat: number;
  lng: number;
  distance?: number;
  [key: string]: unknown;
}

export interface GeocodingSuccess {
  status: "success";
  position: Location;
}

export interface GeocodingFailure {
  status: "rate-limited" | "error";
  message: string;
}

export type GeocodingResult = GeocodingSuccess | GeocodingFailure;

export interface LocationListState {
  status: LocationListStatus;
  requestId: number;
  categories: KeyLocationCategory[];
  activeCategory: string | null;
  position: Location | null;
  error: string | null;
}

export type LocationListAction =
  | { type: "start"; requestId: number; operation: LocationListOperation }
  | { type: "categories-ready"; requestId: number; categories: KeyLocationCategory[] }
  | { type: "position-ready"; requestId: number; position: Location }
  | { type: "error"; requestId: number; message: string }
  | { type: "reset-error" };

export function createInitialLocationListState(): LocationListState {
  return {
    status: "loading",
    requestId: 0,
    categories: [],
    activeCategory: null,
    position: null,
    error: null,
  };
}

export function reduceLocationListState(
  state: LocationListState,
  action: LocationListAction,
): LocationListState {
  if (action.type === "reset-error") {
    return { ...state, error: null };
  }

  if (action.requestId < state.requestId) {
    return state;
  }

  switch (action.type) {
    case "start":
      return { ...state, status: "loading", requestId: action.requestId, error: null };
    case "categories-ready":
      return {
        ...state,
        status: "ready",
        requestId: action.requestId,
        categories: action.categories,
        activeCategory: state.activeCategory ?? action.categories[0]?.category ?? null,
        error: null,
      };
    case "position-ready":
      return { ...state, status: "ready", requestId: action.requestId, position: action.position, error: null };
    case "error":
      return { ...state, status: "error", requestId: action.requestId, error: action.message };
  }
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function sortLocationsByDistance<T extends LocationWithDistance>(
  locations: T[],
): T[] {
  return [...locations].sort(
    (first, second) => (first.distance ?? Infinity) - (second.distance ?? Infinity),
  );
}

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  if (!address.trim()) {
    return { status: "error", message: "住所を入力してください" };
  }

  const searchAddress = address.includes("千代田区")
    ? address.trim()
    : `千代田区 ${address.trim()}`;

  try {
    const response = await fetch(`/api/geocode?address=${encodeURIComponent(searchAddress)}`);
    const data = (await response.json()) as {
      success?: boolean;
      limitExceeded?: boolean;
      results?: Array<{ lat: number; lng: number }>;
      error?: string;
    };

    if (response.status === 429 && data.limitExceeded) {
      return { status: "rate-limited", message: "利用制限に達しました" };
    }
    if (!response.ok) {
      return { status: "error", message: data.error ?? "ジオコーディングに失敗しました" };
    }
    const firstResult = data.results?.[0];
    if (!data.success || !firstResult) {
      return { status: "error", message: "住所が見つかりませんでした" };
    }
    return { status: "success", position: { lat: firstResult.lat, lng: firstResult.lng } };
  } catch {
    return { status: "error", message: "ジオコーディングに失敗しました" };
  }
}

export function loadLocationCategories(): Promise<KeyLocationCategory[]> {
  return loadKeyLocationsData();
}

export async function groupCategoryLocationsByArea(
  locations: KeyLocation[],
): Promise<{ [areaName: string]: KeyLocation[] }> {
  const geoJSON = await loadGeoJSON();
  return groupLocationsByArea(locations, geoJSON) as {
    [areaName: string]: KeyLocation[];
  };
}

export async function findLocationAreaName(
  location: Pick<KeyLocation, "lat" | "lng">,
): Promise<string> {
  const geoJSON = await loadGeoJSON();
  const area = getAreaNameFromCoordinates(location.lat, location.lng, geoJSON);
  return area ? formatAreaName(area) : "不明";
}
