import { useCallback, useEffect, useRef, useState } from "react";
import type { Location } from "@/types/core";
import {
  candidateToLocation,
  searchGeocoding,
  type GeocodeCandidate,
} from "@/lib/location/geocoding-search";
import { track, type PlaceField } from "@/lib/analytics/tracking";

const SUGGEST_DEBOUNCE_MS = 250;
const SUGGEST_MIN_LENGTH = 2;

type SearchTrigger = "suggest" | "commit" | "blur";

export interface UseGeocodingSearchResult {
  query: string;
  setQuery: (value: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  candidates: GeocodeCandidate[];
  search: (address?: string) => Promise<boolean>;
  selectCandidate: (candidate: GeocodeCandidate) => void;
  handleBlur: () => void;
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
  handleEscape: () => void;
}

function hasEnoughInput(value: string): boolean {
  return value.trim().length >= SUGGEST_MIN_LENGTH;
}

export function useGeocodingSearch(
  field: PlaceField,
  onSelected: (location: Location) => void,
): UseGeocodingSearchResult {
  const [query, setQueryState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);
  const queryRef = useRef("");
  const candidatesRef = useRef<GeocodeCandidate[]>([]);
  const composingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const lastSuggestRef = useRef<{ term: string; result: Awaited<ReturnType<typeof searchGeocoding>> } | null>(null);
  const inFlightCommitRef = useRef<string | null>(null);

  candidatesRef.current = candidates;

  const cancelScheduled = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSearch = useCallback(
    async (term: string, trigger: SearchTrigger): Promise<boolean> => {
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      const trimmed = term.trim();
      const committed = trigger === "commit";
      if (committed) {
        inFlightCommitRef.current = trimmed;
        setLoading(true);
        setError(null);
      }
      if (!trimmed) {
        if (committed) {
          setLoading(false);
          setError("住所を入力してください");
        }
        return false;
      }
      const result = await searchGeocoding(trimmed);
      if (committed && inFlightCommitRef.current === trimmed) {
        inFlightCommitRef.current = null;
      }
      if (generation !== generationRef.current) {
        return false;
      }
      lastSuggestRef.current = trigger === "suggest" ? { term: trimmed, result } : null;
      if (committed) {
        setLoading(false);
      }
      if (trigger !== "suggest") {
        track("place_search", {
          field,
          outcome:
            result.status === "success"
              ? "found"
              : result.status === "empty"
                ? "not_found"
                : "failed",
        });
      }
      if (result.candidates.length > 0) {
        setCandidates(result.candidates);
        setError(null);
        return false;
      }
      setCandidates([]);
      if (trigger !== "suggest") {
        setError(result.error ?? "地点の検索に失敗しました");
      }
      return false;
    },
    [field],
  );

  const scheduleSuggest = useCallback(
    (term: string) => {
      cancelScheduled();
      if (!hasEnoughInput(term)) {
        return;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runSearch(term, "suggest");
      }, SUGGEST_DEBOUNCE_MS);
    },
    [cancelScheduled, runSearch],
  );

  useEffect(() => {
    if (composingRef.current) {
      cancelScheduled();
      return;
    }
    if (!hasEnoughInput(query)) {
      cancelScheduled();
      return;
    }
    scheduleSuggest(query);
    return cancelScheduled;
  }, [query, scheduleSuggest, cancelScheduled]);

  useEffect(() => cancelScheduled, [cancelScheduled]);

  const setQuery = useCallback((value: string) => {
    queryRef.current = value;
    setQueryState(value);
    setError(null);
    setCandidates([]);
  }, []);

  const selectCandidate = useCallback(
    (candidate: GeocodeCandidate) => {
      track("place_select", { field, source: "address" });
      cancelScheduled();
      generationRef.current += 1;
      setCandidates([]);
      onSelected(candidateToLocation(candidate));
    },
    [cancelScheduled, field, onSelected],
  );

  const search = useCallback(
    async (address?: string) => {
      cancelScheduled();
      return runSearch(address ?? queryRef.current, "commit");
    },
    [cancelScheduled, runSearch],
  );

  const handleBlur = useCallback(() => {
    if (composingRef.current) {
      return;
    }
    const term = queryRef.current.trim();
    if (!term || candidatesRef.current.length > 0 || inFlightCommitRef.current === term) {
      return;
    }
    cancelScheduled();
    const suggestion = lastSuggestRef.current;
    if (suggestion !== null && suggestion.term === term) {
      setError(suggestion.result.error ?? "地点の検索に失敗しました");
      return;
    }
    void runSearch(term, "blur");
  }, [cancelScheduled, runSearch]);

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
    cancelScheduled();
  }, [cancelScheduled]);

  const handleCompositionEnd = useCallback(() => {
    composingRef.current = false;
    scheduleSuggest(queryRef.current);
  }, [scheduleSuggest]);

  const handleEscape = useCallback(() => {
    cancelScheduled();
    setCandidates([]);
  }, [cancelScheduled]);

  return {
    query,
    setQuery,
    error,
    setError,
    loading,
    setLoading,
    candidates,
    search,
    selectCandidate,
    handleBlur,
    handleCompositionStart,
    handleCompositionEnd,
    handleEscape,
  };
}
