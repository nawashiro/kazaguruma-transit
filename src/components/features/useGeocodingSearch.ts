"use client";

import { useCallback, useState } from "react";
import type { Location } from "@/types/core";
import { searchGeocoding } from "@/lib/location/geocoding-search";

export function useGeocodingSearch(onSelected: (location: Location) => void) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRateLimitModalOpen, setIsRateLimitModalOpen] = useState(false);

  const search = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    const result = await searchGeocoding(address);
    setLoading(false);
    if (result.isRateLimited) {
      setIsRateLimitModalOpen(true);
      return false;
    }
    if (result.location) {
      onSelected(result.location);
      return true;
    }
    setError(result.error ?? "ジオコーディングに失敗しました");
    return false;
  }, [onSelected]);

  return { error, setError, loading, setLoading, isRateLimitModalOpen, setIsRateLimitModalOpen, search };
}
