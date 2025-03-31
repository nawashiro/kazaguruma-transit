"use client";

import { useState } from "react";
import { Location } from "../types/transit";
import InputField from "./common/InputField";
import Button from "./common/Button";
import { logger } from "../utils/logger";
import RateLimitModal from "./RateLimitModal";

interface OriginSelectorProps {
  onOriginSelected: (location: Location) => void;
}

export default function OriginSelector({
  onOriginSelected,
}: OriginSelectorProps) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRateLimitModalOpen, setIsRateLimitModalOpen] = useState(false);

  const handleAddressSubmit = async (e: React.FormEvent) => {
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
        onOriginSelected(location);
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

  const handleUseCurrentLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("お使いのブラウザではGPS機能に対応していません");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const location: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          // 逆ジオコーディングで住所を取得（オプション）
          try {
            const response = await fetch(
              `/api/geocode?address=${location.lat},${location.lng}`
            );
            const data = await response.json();
            logger.log("Reverse Geocode API Response:", data);

            if (response.status === 429 && data.limitExceeded) {
              setIsRateLimitModalOpen(true);
              return;
            }

            if (response.ok && data.success && data.results?.length > 0) {
              location.address = data.results[0].formattedAddress;
            }
          } catch (error) {
            logger.error("逆ジオコーディングエラー:", error);
            // 逆ジオコーディングに失敗しても続行する
          }

          onOriginSelected(location);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "予期せぬエラーが発生しました"
          );
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError("位置情報の取得に失敗しました: " + err.message);
        setLoading(false);
      }
    );
  };

  return (
    <>
      <div className="bg-base-200/70 p-4 rounded-lg shadow-md backdrop-blur-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4">次に出発地を選択してください</h2>

        {error && (
          <div className="alert alert-error mb-4" data-testid="error-message">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAddressSubmit} className="space-y-4">
          <InputField
            label="住所や場所"
            placeholder="千代田区役所"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loading}
            testId="address-input"
            required
          />

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              className="flex-1"
              testId="search-button"
            >
              この住所で検索
            </Button>

            <Button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={loading}
              loading={loading}
              className="flex-1"
              testId="gps-button"
            >
              現在地を使用
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
