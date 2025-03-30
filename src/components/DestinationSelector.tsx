"use client";

import { useState } from "react";
import { Location } from "../types/transit";
import LocationSuggestions from "./LocationSuggestions";
import InputField from "./common/InputField";
import Button from "./common/Button";

interface DestinationSelectorProps {
  onDestinationSelected: (location: Location) => void;
}

export default function DestinationSelector({
  onDestinationSelected,
}: DestinationSelectorProps) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setError("行き先を入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 「千代田区」が含まれていない場合は接頭辞として追加
      let searchAddress = address.trim();
      if (!searchAddress.includes("千代田区")) {
        searchAddress = `千代田区 ${searchAddress}`;
      }

      // Google Maps Geocoding APIを呼び出し
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(searchAddress)}`
      );
      const data = await response.json();
      console.log("Geocode API Response:", data);

      if (!response.ok) {
        throw new Error(data.error || "ジオコーディングに失敗しました");
      }

      onDestinationSelected(data.data.location);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelected = (location: Location) => {
    onDestinationSelected(location);
  };

  return (
    <div>
      <div className="bg-base-200 p-4 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">
          最初に行き先を選択してください
        </h2>

        {error && (
          <div className="alert alert-error mb-4" data-testid="error-message">
            <span>{error}</span>
          </div>
        )}

        <LocationSuggestions onLocationSelected={handleLocationSelected} />

        <form onSubmit={handleAddressSubmit} className="space-y-4">
          <InputField
            label="または住所を入力"
            placeholder="えみふる"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loading}
            testId="destination-input"
          />

          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            fullWidth
            testId="search-destination-button"
          >
            この行き先で検索
          </Button>
        </form>
      </div>
    </div>
  );
}
