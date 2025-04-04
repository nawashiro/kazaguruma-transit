"use client";

import { useState } from "react";
import { Location } from "../types/transit";
import LocationSuggestions from "./LocationSuggestions";
import InputField from "./common/InputField";
import Button from "./common/Button";
import { logger } from "../utils/logger";
import RateLimitModal from "./RateLimitModal";

interface DestinationSelectorProps {
  onDestinationSelected: (location: Location) => void;
}

export default function DestinationSelector({
  onDestinationSelected,
}: DestinationSelectorProps) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRateLimitModalOpen, setIsRateLimitModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 入力値のバリデーション
    if (!address.trim()) {
      setError("住所を入力してください");
      setLoading(false);
      return;
    }

    try {
      // 「千代田区」が含まれていない場合は接頭辞として追加
      let searchAddress = address.trim();
      if (!searchAddress.includes("千代田区")) {
        searchAddress = `千代田区 ${searchAddress}`;
      }

      // 実際のGoogle Maps Geocoding APIを呼び出し
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(searchAddress)}`
      );
      const data = await response.json();
      logger.log("Geocode API Response:", data);

      if (response.status === 429 && data.limitExceeded) {
        setIsRateLimitModalOpen(true);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "ジオコーディングに失敗しました");
      }

      if (data.success && data.results?.length > 0) {
        const firstResult = data.results[0];

        const location: Location = {
          lat: firstResult.lat,
          lng: firstResult.lng,
          address: firstResult.formattedAddress,
        };

        onDestinationSelected(location);
      } else {
        throw new Error("住所が見つかりませんでした");
      }
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
    <>
      <div className="bg-base-200/70 p-4 rounded-lg shadow-md backdrop-blur-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4">目的地を選択してください</h2>

        {error && (
          <div className="alert alert-error mb-4" data-testid="error-message">
            <span>{error}</span>
          </div>
        )}

        <LocationSuggestions onLocationSelected={handleLocationSelected} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            label="目的地の住所や場所"
            placeholder="神田駿河台"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loading}
            testId="address-input"
            required
          />

          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              testId="search-button"
            >
              検索
            </Button>
          </div>
        </form>
      </div>

      {/* レート制限モーダル */}
      <RateLimitModal
        isOpen={isRateLimitModalOpen}
        onClose={() => setIsRateLimitModalOpen(false)}
      />
    </>
  );
}
