"use client";

import { useState } from "react";
import { Location } from "../types/transit";

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
      // Google Maps Geocoding APIを呼び出し
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(address)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "ジオコーディングに失敗しました");
      }

      onDestinationSelected(data.location);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-base-200 p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">どこへ行きたいですか？</h2>

      {error && (
        <div className="alert alert-error mb-4" data-testid="error-message">
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleAddressSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">行き先の住所や場所</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="例: 東京都千代田区霞が関1-1-1"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loading}
            data-testid="destination-input"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={loading}
          data-testid="search-destination-button"
        >
          {loading ? (
            <span className="loading loading-spinner"></span>
          ) : (
            "この行き先で検索"
          )}
        </button>
      </form>
    </div>
  );
}
