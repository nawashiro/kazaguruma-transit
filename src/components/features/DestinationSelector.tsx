"use client";

import { useState, useCallback } from "react";
import type { Location } from "@/types/core";
import type { RouteDestinationCategory } from "@/types/route-destinations";
import LocationSuggestions from "./LocationSuggestions";
import InputField from "@/components/ui/InputField";
import SearchButton from "@/components/ui/SearchButton";
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
  const [address, setAddress] = useState("");
  const handleSelected = useCallback((location: Location) => onDestinationSelected(location), [onDestinationSelected]);
  const { error, loading, candidates, search, selectCandidate } = useGeocodingSearch("destination", handleSelected);

  return (
    <LocationFieldset label="目的地" selectedLocation={selectedLocation} onEdit={onEdit} testId="selected-destination">
      <form onSubmit={async event => { event.preventDefault(); await search(address); }} className="space-y-4 min-w-0">
        <h3 className="text-base font-bold ruby-text">名前で検索</h3>
        <InputField label="目的地" placeholder="神田駿河台" value={address}
          onChange={event => setAddress(event.target.value)} disabled={loading} testId="address-input"
          error={error || validationError} description="建物名だけでも大丈夫な場合がほとんどです。"
          endAdornment={<SearchButton disabled={loading} loading={loading} joined testId="search-button" />} />
        <LocationCandidates candidates={candidates} label="目的地" onSelect={selectCandidate} />
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
