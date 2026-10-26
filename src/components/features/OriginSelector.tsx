"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Location } from "@/types/core";
import InputField from "@/components/ui/InputField";
import Button from "@/components/ui/Button";
import SearchButton from "@/components/ui/SearchButton";
import LocationFieldset, { type LocationSelectionProps } from "./LocationFieldset";
import { useGeocodingSearch } from "./useGeocodingSearch";
import { LocateFixed } from "lucide-react";

interface OriginSelectorProps extends LocationSelectionProps {
  onOriginSelected: (location: Location) => void;
}

export default function OriginSelector({ onOriginSelected, selectedLocation, onEdit, validationError }: OriginSelectorProps) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const handleSelected = useCallback((location: Location) => onOriginSelected(location), [onOriginSelected]);
  const { error, setError, loading, setLoading, search } = useGeocodingSearch(handleSelected);

  const handleUseCurrentLocation = () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("お使いのブラウザではGPS機能に対応していません");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(async position => {
      const location: Location = { lat: position.coords.latitude, lng: position.coords.longitude };
      try {
        const response = await fetch(`/api/geocode?address=${location.lat},${location.lng}`);
        const data = await response.json();
        if (response.status === 429 && data.limitExceeded) {
          router.push("/rate-limit?source=home");
          return;
        }
        if (response.ok && data.success && data.results?.length > 0) location.address = data.results[0].formattedAddress;
      } catch {
        // 住所の逆引きは任意であり、GPSで取得した座標は利用できる。
      } finally {
        setLoading(false);
      }
      onOriginSelected(location);
    }, error => {
      setError("位置情報の取得に失敗しました: " + error.message);
      setLoading(false);
    });
  };

  return (
    <LocationFieldset label="出発地" selectedLocation={selectedLocation} onEdit={onEdit} testId="selected-origin">
      <form onSubmit={async event => { event.preventDefault(); await search(address); }} className="space-y-4 min-w-0">
        <InputField label="出発地" placeholder="千代田区役所" value={address}
          onChange={event => setAddress(event.target.value)} disabled={loading} testId="address-input" required
          error={error || validationError} description="建物名だけでも大丈夫な場合がほとんどです。"
          endAdornment={<SearchButton disabled={loading} loading={loading} joined testId="search-button" />} />
        <Button type="button" onClick={handleUseCurrentLocation} disabled={loading} loading={loading} testId="gps-button">
          <LocateFixed className="mr-2 h-5 w-5 shrink-0" aria-hidden="true" />
          端末のGPSを許可する
        </Button>
        {loading && <p role="status" className="text-base">位置を確認しています</p>}
      </form>
    </LocationFieldset>
  );
}
