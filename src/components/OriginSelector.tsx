"use client";

import { useState } from "react";
import { Location } from "../types/transit";

interface OriginSelectorProps {
  onOriginSelected: (location: Location) => void;
}

export default function OriginSelector({
  onOriginSelected,
}: OriginSelectorProps) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setError("住所を入力してください");
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

      // 実際のGoogle Maps Geocoding APIを呼び出し
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(searchAddress)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "ジオコーディングに失敗しました");
      }

      onOriginSelected(data.location);
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

            if (response.ok && data.location) {
              location.address = data.location.address;
            }
          } catch (error) {
            console.error("逆ジオコーディングエラー:", error);
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
    <div className="bg-base-200 p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">どこから行きますか？</h2>

      {error && (
        <div className="alert alert-error mb-4" data-testid="error-message">
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleAddressSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">住所や場所</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="千代田区役所"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loading}
            data-testid="address-input"
          />
        </div>

        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <button
            type="submit"
            className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2 shadow-sm flex-1"
            disabled={loading}
            data-testid="search-button"
          >
            {loading ? (
              <span className="loading loading-spinner"></span>
            ) : (
              "この住所で検索"
            )}
          </button>

          <button
            type="button"
            className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2 shadow-sm flex-1"
            onClick={handleUseCurrentLocation}
            disabled={loading}
            data-testid="gps-button"
          >
            {loading ? (
              <span className="loading loading-spinner"></span>
            ) : (
              "現在地を使用"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
