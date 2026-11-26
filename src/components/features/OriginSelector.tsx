"use client";

import { useCallback, useId } from "react";
import type { Location } from "@/types/core";
import InputField from "@/components/ui/InputField";
import Button from "@/components/ui/Button";
import LocationFieldset, { type LocationSelectionProps } from "./LocationFieldset";
import LocationCandidates from "./LocationCandidates";
import { useGeocodingSearch } from "./useGeocodingSearch";
import { reverseGeocoding } from "@/lib/location/geocoding-search";
import { track } from "@/lib/analytics/tracking";
import { LocateFixed } from "lucide-react";

interface OriginSelectorProps extends LocationSelectionProps {
  onOriginSelected: (location: Location) => void;
}

export default function OriginSelector({ onOriginSelected, selectedLocation, onEdit, validationError }: OriginSelectorProps) {
  const candidateListId = useId();
  const handleSelected = useCallback((location: Location) => onOriginSelected(location), [onOriginSelected]);
  const {
    query, setQuery, error, setError, loading, setLoading, candidates, search, selectCandidate,
    handleBlur, handleCompositionStart, handleCompositionEnd, handleEscape,
  } = useGeocodingSearch("origin", handleSelected);

  const handleUseCurrentLocation = () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      track("gps_result", { outcome: "unsupported" });
      setError("お使いのブラウザではGPS機能に対応していません");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(async position => {
      track("gps_result", { outcome: "granted" });
      const location: Location = { lat: position.coords.latitude, lng: position.coords.longitude };
      try {
        const result = await reverseGeocoding(location.lat, location.lng);
        if (result.location?.address) location.address = result.location.address;
      } finally {
        setLoading(false);
      }
      track("place_select", { field: "origin", source: "gps" });
      onOriginSelected(location);
    }, error => {
      track("gps_result", { outcome: error.code === 3 ? "timeout" : "denied" });
      setError("位置情報の取得に失敗しました: " + error.message);
      setLoading(false);
    });
  };

  return (
    <LocationFieldset label="出発地" selectedLocation={selectedLocation} onEdit={onEdit} testId="selected-origin">
      <form onSubmit={async event => { event.preventDefault(); await search(); }} className="space-y-4 min-w-0">
        <InputField label="出発地" placeholder="千代田区役所" value={query}
          onChange={event => setQuery(event.target.value)} disabled={loading} testId="address-input" required
          error={error || validationError} description="建物名だけでも大丈夫な場合がほとんどです。"
          autoComplete="off"
          controls={candidates.length > 0 ? candidateListId : undefined}
          onBlur={handleBlur} onCompositionStart={handleCompositionStart} onCompositionEnd={handleCompositionEnd}
          onKeyDown={event => { if (event.key === "Escape") handleEscape(); }} />
        <LocationCandidates id={candidateListId} candidates={candidates} label="出発地" onSelect={selectCandidate} />
        <Button type="button" onClick={handleUseCurrentLocation} disabled={loading} loading={loading} testId="gps-button">
          <LocateFixed className="mr-2 h-5 w-5 shrink-0" aria-hidden="true" />
          端末のGPSを許可する
        </Button>
        {loading && <p role="status" className="text-base">位置を確認しています</p>}
      </form>
    </LocationFieldset>
  );
}
