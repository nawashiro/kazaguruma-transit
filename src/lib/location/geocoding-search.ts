import type { Location } from "@/types/core";

export type GeocodingStatus = "idle" | "loading" | "success" | "empty" | "rate-limited" | "error";

export interface GeocodingSearchResult {
  location?: Location;
  status: GeocodingStatus;
  error?: string;
  isRateLimited?: boolean;
}

interface GeocodeResponse {
  success?: boolean;
  limitExceeded?: boolean;
  error?: string;
  results?: Array<{ lat: number; lng: number; formattedAddress: string }>;
}

export function normalizeSearchAddress(address: string): string {
  const trimmed = address.trim();
  return trimmed && trimmed.includes("千代田区") ? trimmed : trimmed ? `千代田区 ${trimmed}` : "";
}

export async function searchGeocoding(address: string, fetcher: typeof fetch = fetch): Promise<GeocodingSearchResult> {
  const normalized = normalizeSearchAddress(address);
  if (!normalized) return { status: "error", error: "住所を入力してください" };
  try {
    const response = await fetcher(`/api/geocode?address=${encodeURIComponent(normalized)}`);
    const data = (await response.json()) as GeocodeResponse;
    if (response.status === 429 && data.limitExceeded) {
      return { status: "rate-limited", isRateLimited: true };
    }
    if (!response.ok) return { status: "error", error: data.error || "ジオコーディングに失敗しました" };
    const first = data.success && data.results?.[0];
    if (!first) return { status: "empty", error: "入力された住所が見つかりませんでした。住所をより具体的に入力するか、一般的な場所名を試してください。" };
    return { status: "success", location: { lat: first.lat, lng: first.lng, address: first.formattedAddress } };
  } catch (error) {
    return { status: "error", error: error instanceof Error ? error.message : "ネットワーク接続を確認して、再度お試しください。" };
  }
}
