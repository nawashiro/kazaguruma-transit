"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Location } from "@/types/core";
import { searchGeocoding } from "@/lib/location/geocoding-search";
import { track, type PlaceField } from "@/lib/analytics/tracking";

export function useGeocodingSearch(
  field: PlaceField,
  onSelected: (location: Location) => void,
) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    const result = await searchGeocoding(address);
    setLoading(false);
    if (result.isRateLimited) {
      track("place_search", { field, outcome: "rate_limited" });
      router.push("/rate-limit?source=home");
      return false;
    }
    track("place_search", {
      field,
      outcome: result.location ? "found" : result.status === "empty" ? "not_found" : "failed",
    });
    if (result.location) {
      track("place_select", { field, source: "address" });
      onSelected(result.location);
      return true;
    }
    setError(result.error ?? "ジオコーディングに失敗しました");
    return false;
  }, [field, onSelected, router]);

  return { error, setError, loading, setLoading, search };
}
