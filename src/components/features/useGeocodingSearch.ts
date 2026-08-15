"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Location } from "@/types/core";
import { searchGeocoding } from "@/lib/location/geocoding-search";

export function useGeocodingSearch(onSelected: (location: Location) => void) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    const result = await searchGeocoding(address);
    setLoading(false);
    if (result.isRateLimited) {
      router.push("/rate-limit?source=home");
      return false;
    }
    if (result.location) {
      onSelected(result.location);
      return true;
    }
    setError(result.error ?? "ジオコーディングに失敗しました");
    return false;
  }, [onSelected, router]);

  return { error, setError, loading, setLoading, search };
}
