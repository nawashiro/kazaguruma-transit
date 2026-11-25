import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Location } from "@/types/core";
import {
  candidateToLocation,
  searchGeocoding,
  type GeocodeCandidate,
} from "@/lib/location/geocoding-search";
import { track, type PlaceField } from "@/lib/analytics/tracking";

export interface UseGeocodingSearchResult {
  error: string | null;
  setError: (error: string | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  candidates: GeocodeCandidate[];
  clearCandidates: () => void;
  search: (address: string) => Promise<boolean>;
  selectCandidate: (candidate: GeocodeCandidate) => void;
}

export function useGeocodingSearch(
  field: PlaceField,
  onSelected: (location: Location) => void,
): UseGeocodingSearchResult {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);

  const clearCandidates = useCallback(() => {
    setCandidates([]);
  }, []);

  const selectCandidate = useCallback(
    (candidate: GeocodeCandidate) => {
      track("place_select", { field, source: "address" });
      setCandidates([]);
      onSelected(candidateToLocation(candidate));
    },
    [field, onSelected],
  );

  const search = useCallback(
    async (address: string) => {
      setLoading(true);
      setError(null);
      setCandidates([]);
      const result = await searchGeocoding(address);
      setLoading(false);
      if (result.isRateLimited) {
        track("place_search", { field, outcome: "rate_limited" });
        router.push("/rate-limit?source=home");
        return false;
      }
      track("place_search", {
        field,
        outcome:
          result.status === "success"
            ? "found"
            : result.status === "empty"
              ? "not_found"
              : "failed",
      });
      if (result.candidates.length > 0) {
        setCandidates(result.candidates);
        return false;
      }
      setError(result.error ?? "地点の検索に失敗しました");
      return false;
    },
    [field, router],
  );

  return {
    error,
    setError,
    loading,
    setLoading,
    candidates,
    clearCandidates,
    search,
    selectCandidate,
  };
}
