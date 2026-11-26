"use client";

import { useCallback, useId } from "react";
import type { Location } from "@/types/core";
import type { RouteDestinationCategory } from "@/types/route-destinations";
import LocationSuggestions from "./LocationSuggestions";
import InputField from "@/components/ui/InputField";
import LocationFieldset, { type LocationSelectionProps } from "./LocationFieldset";
import LocationCandidates from "./LocationCandidates";
import { useGeocodingSearch } from "./useGeocodingSearch";
import { track } from "@/lib/analytics/tracking";

interface DestinationSelectorProps extends LocationSelectionProps {
  onDestinationSelected: (location: Location) => void;
  categories?: RouteDestinationCategory[];
}

export default function DestinationSelector({
  onDestinationSelected, categories = [], selectedLocation, onEdit, validationError,
}: DestinationSelectorProps) {
  const candidateListId = useId();
  const handleSelected = useCallback((location: Location) => onDestinationSelected(location), [onDestinationSelected]);
  const {
    query, setQuery, error, loading, candidates, search, selectCandidate,
    handleBlur, handleCompositionStart, handleCompositionEnd, handleEscape,
  } = useGeocodingSearch("destination", handleSelected);

  return (
    <LocationFieldset label="目的地" selectedLocation={selectedLocation} onEdit={onEdit} testId="selected-destination">
      <form onSubmit={async event => { event.preventDefault(); await search(); }} className="space-y-4 min-w-0">
        <h3 className="text-base font-bold ruby-text">名前で検索</h3>
        <InputField label="目的地" placeholder="神田駿河台" value={query}
          onChange={event => setQuery(event.target.value)} disabled={loading} testId="address-input"
          error={error || validationError} description="建物名だけでも大丈夫な場合がほとんどです。"
          autoComplete="off"
          controls={candidates.length > 0 ? candidateListId : undefined}
          onBlur={handleBlur} onCompositionStart={handleCompositionStart} onCompositionEnd={handleCompositionEnd}
          onKeyDown={event => { if (event.key === "Escape") handleEscape(); }} />
        <LocationCandidates id={candidateListId} candidates={candidates} label="目的地" onSelect={selectCandidate} />
        {loading && <p role="status" className="text-base">地点を検索しています</p>}
      </form>
      <div className="divider text-base">または</div>
      <LocationSuggestions categories={categories} onLocationSelected={location => {
        track("place_select", { field: "destination", source: "catalog" });
        handleSelected(location);
      }} />
    </LocationFieldset>
  );
}
