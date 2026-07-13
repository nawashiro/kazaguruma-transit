"use client";

import { useState, useId } from "react";
import { Location } from "@/types/core";
import InputField from "@/components/ui/InputField";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { logger } from "@/utils/logger";
import RateLimitModal from "./RateLimitModal";
import { FiSearch } from "react-icons/fi";
import { MdMyLocation } from "react-icons/md";

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
  const uniqueId = useId();
  const buttonGroupId = `origin-actions-${uniqueId}`;

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
        onOriginSelected(location);
        logger.log(`出発地選択: ${location.address}`);
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
      <Card testId="origin-selector-card" title="次に出発地を選択してください">
        <form onSubmit={handleAddressSubmit} className="space-y-4">
          <InputField
            placeholder="千代田区役所"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loading}
            testId="address-input"
            required={true}
            error={error || undefined}
            description="千代田区内の住所や場所名を入力してください。自動的に「千代田区」が先頭に追加されます。"
            endAdornment={
              <Button
                type="submit"
                disabled={loading}
                loading={loading}
                iconOnly
                className="join-item h-11 w-11 p-0 focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-base-content"
                testId="search-button"
                aria-label="住所や場所を検索"
              >
                <FiSearch className="h-5 w-5" aria-hidden="true" />
              </Button>
            }
          />

          <fieldset aria-describedby={buttonGroupId}>
            <legend id={buttonGroupId} className="sr-only">
              検索オプション
            </legend>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <Button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={loading}
                loading={loading}
                className="flex-1"
                testId="gps-button"
                aria-label="現在地を使用して経路を検索"
              >
                <span className="flex items-center justify-center gap-2 whitespace-nowrap">
                  <MdMyLocation
                    className="h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>現在地を使用</span>
                </span>
              </Button>
            </div>
          </fieldset>
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
