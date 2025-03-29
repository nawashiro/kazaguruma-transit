"use client";

import { useState, useEffect, FormEvent } from "react";
import { Stop, Route, TransitFormData } from "../types/transit";

interface TransitFormProps {
  onSubmit: (formData: TransitFormData) => void;
}

export default function TransitForm({ onSubmit }: TransitFormProps) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedStop, setSelectedStop] = useState<string>("");
  const [selectedRoute, setSelectedRoute] = useState<string>("");

  // APIからデータを取得
  useEffect(() => {
    const fetchTransitData = async () => {
      try {
        setLoading(true);
        // 駅と路線データを取得
        const response = await fetch("/api/transit?dataType=metadata");

        if (!response.ok) {
          throw new Error("データの取得に失敗しました");
        }

        const data = await response.json();

        if (data.stops) {
          setStops(data.stops);
        }

        if (data.routes) {
          setRoutes(data.routes);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "予期せぬエラーが発生しました"
        );
        console.error("データ取得エラー:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransitData();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedStop) {
      setError("駅を選択してください");
      return;
    }

    const formData: TransitFormData = {
      stopId: selectedStop,
      routeId: selectedRoute || undefined,
    };

    onSubmit(formData);
  };

  return (
    <div className="bg-base-200 p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">乗換案内</h2>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">駅名</span>
          </label>
          <select
            className="select select-bordered w-full text-base-content"
            value={selectedStop}
            onChange={(e) => setSelectedStop(e.target.value)}
            data-testid="stop-select"
            disabled={loading}
          >
            <option value="" className="text-base-content">
              駅を選択
            </option>
            {stops.map((stop) => (
              <option
                key={stop.id}
                value={stop.id}
                className="text-base-content"
              >
                {stop.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">路線（オプション）</span>
          </label>
          <select
            className="select select-bordered w-full text-base-content"
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            data-testid="route-select"
            disabled={loading}
          >
            <option value="" className="text-base-content">
              路線を選択
            </option>
            {routes.map((route) => (
              <option
                key={route.id}
                value={route.id}
                className="text-base-content"
              >
                {route.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={loading}
          data-testid="submit-button"
        >
          {loading ? <span className="loading loading-spinner"></span> : "検索"}
        </button>
      </form>
    </div>
  );
}
