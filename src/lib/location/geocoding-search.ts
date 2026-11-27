import type { Location } from "@/types/core";

export type GeocodingStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface GeocodeCandidate {
  name: string;
  address: string;
  lat: number;
  lng: number;
  kind: string;
  /** 最寄り停留所までの徒歩距離（メートル）。測れないときは含まれない。 */
  walkMeters?: number;
}

export interface GeocodingSearchResult {
  candidates: GeocodeCandidate[];
  status: GeocodingStatus;
  error?: string;
}

export interface GeocodingReverseResult {
  location?: Location;
  status: GeocodingStatus;
  error?: string;
}

interface GeocodeSearchResponse {
  success?: boolean;
  results?: GeocodeCandidate[];
  error?: string;
}

interface GeocodeReverseResponse {
  success?: boolean;
  location?: {
    lat: number;
    lng: number;
    address: string;
    walkMeters?: number;
  };
  error?: string;
}

export function normalizeSearchAddress(address: string): string {
  return address.trim();
}

export function candidateToLocation(candidate: GeocodeCandidate): Location {
  return {
    lat: candidate.lat,
    lng: candidate.lng,
    address: candidate.name,
    ...(candidate.walkMeters === undefined
      ? {}
      : { walkMeters: candidate.walkMeters }),
  };
}

export async function searchGeocoding(
  address: string,
  fetcher: typeof fetch = fetch,
): Promise<GeocodingSearchResult> {
  const query = normalizeSearchAddress(address);
  if (!query) {
    return { candidates: [], status: "error", error: "住所を入力してください" };
  }
  try {
    const response = await fetcher(`/api/geocode?q=${encodeURIComponent(query)}`);
    const data = (await response.json()) as GeocodeSearchResponse;
    if (!response.ok) {
      return {
        candidates: [],
        status: "error",
        error: data.error || "地点の検索に失敗しました",
      };
    }
    const candidates = data.success && Array.isArray(data.results) ? data.results : [];
    if (candidates.length === 0) {
      return {
        candidates: [],
        status: "empty",
        error: "一致する地点が見つかりませんでした。住所や名前を変えて試してください。",
      };
    }
    return { candidates, status: "success" };
  } catch (error) {
    return {
      candidates: [],
      status: "error",
      error:
        error instanceof Error
          ? error.message
          : "ネットワーク接続を確認して、再度お試しください。",
    };
  }
}

export async function reverseGeocoding(
  lat: number,
  lng: number,
  fetcher: typeof fetch = fetch,
): Promise<GeocodingReverseResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { status: "error", error: "有効な座標が必要です" };
  }
  try {
    const response = await fetcher(`/api/geocode?lat=${lat}&lng=${lng}`);
    const data = (await response.json()) as GeocodeReverseResponse;
    if (!response.ok || !data.location) {
      return {
        status: "empty",
        error: data.error || "座標から住所を解決できませんでした",
      };
    }
    return {
      status: "success",
      location: {
        lat: data.location.lat,
        lng: data.location.lng,
        address: data.location.address,
        ...(data.location.walkMeters === undefined
          ? {}
          : { walkMeters: data.location.walkMeters }),
      },
    };
  } catch (error) {
    return {
      status: "error",
      error:
        error instanceof Error
          ? error.message
          : "ネットワーク接続を確認して、再度お試しください。",
    };
  }
}
