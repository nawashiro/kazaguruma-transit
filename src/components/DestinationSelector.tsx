"use client";

import { useState } from "react";
import { Location } from "../types/transit";
import LocationSuggestions from "./LocationSuggestions";
import InputField from "./common/InputField";
import Button from "./common/Button";
import Card from "./common/Card";
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

      // Google Maps Geocoding APIを呼び出し
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
        logger.log(`目的地選択: ${location.address}`);
      } else {
        // よりわかりやすいエラーメッセージを提供
        setError(
          "入力された住所が見つかりませんでした。住所をより具体的に入力するか、一般的な場所名を試してください。"
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "予期せぬエラーが発生しました。ネットワーク接続を確認して、再度お試しください。"
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
      <Card title="目的地を選択してください" className="mb-6">
        <LocationSuggestions onLocationSelected={handleLocationSelected} />

        <div className="divider">または</div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            label="目的地の住所や場所"
            placeholder="神田駿河台"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loading}
            testId="address-input"
            required={false}
            error={error || undefined}
            description="千代田区内の住所や場所名を入力してください。自動的に「千代田区」が先頭に追加されます。"
          />

          <div className="card-actions justify-center">
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
      </Card>

      {/* レート制限モーダル */}
      <RateLimitModal
        isOpen={isRateLimitModalOpen}
        onClose={() => setIsRateLimitModalOpen(false)}
      />
    </>
  );
}
