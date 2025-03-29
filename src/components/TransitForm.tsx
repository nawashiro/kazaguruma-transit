"use client";

import React, { useState, useEffect } from "react";
import { Stop, Route } from "../types/transit";

interface TransitFormProps {
  initialStopId?: string;
  onSubmit: (formData: {
    stopId: string;
    routeId: string;
    dateTime?: string;
    isDeparture: boolean;
  }) => void;
}

const TransitForm: React.FC<TransitFormProps> = ({
  initialStopId,
  onSubmit,
}) => {
  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedStop, setSelectedStop] = useState<string>(initialStopId || "");
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const [dateTime, setDateTime] = useState<string>("");
  const [isDeparture, setIsDeparture] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/transit?dataType=metadata");
        if (!response.ok) {
          throw new Error("メタデータの取得に失敗しました");
        }
        const data = await response.json();
        setStops(data.stops);
        setRoutes(data.routes);

        // 現在の日時を初期値として設定
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        setDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);

        setError(null);
      } catch (err) {
        setError("データ取得中にエラーが発生しました");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, []);

  useEffect(() => {
    if (initialStopId) {
      setSelectedStop(initialStopId);
    }
  }, [initialStopId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      stopId: selectedStop,
      routeId: selectedRoute,
      dateTime: dateTime || undefined,
      isDeparture,
    });
  };

  const toggleTimeType = () => {
    setIsDeparture(!isDeparture);
  };

  if (loading) return <div>データを読み込み中...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <form onSubmit={handleSubmit} className="transit-form">
      <div className="form-group">
        <label htmlFor="stop-select">バス停</label>
        <select
          id="stop-select"
          value={selectedStop}
          onChange={(e) => setSelectedStop(e.target.value)}
          required
        >
          <option value="">バス停を選択</option>
          {stops.map((stop) => (
            <option key={stop.stop_id} value={stop.stop_id}>
              {stop.stop_name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="route-select">路線</label>
        <select
          id="route-select"
          value={selectedRoute}
          onChange={(e) => setSelectedRoute(e.target.value)}
          required
        >
          <option value="">路線を選択</option>
          {routes.map((route) => (
            <option key={route.route_id} value={route.route_id}>
              {route.route_short_name} - {route.route_long_name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <div className="time-toggle">
          <button
            type="button"
            className={isDeparture ? "active" : ""}
            onClick={toggleTimeType}
            disabled={isDeparture}
          >
            出発
          </button>
          <button
            type="button"
            className={!isDeparture ? "active" : ""}
            onClick={toggleTimeType}
            disabled={!isDeparture}
          >
            到着
          </button>
        </div>

        {isDeparture ? (
          <div className="time-input">
            <label htmlFor="departure-time">出発日時</label>
            <input
              id="departure-time"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
            />
          </div>
        ) : (
          <div className="time-input">
            <label htmlFor="arrival-time">到着日時</label>
            <input
              id="arrival-time"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
            />
          </div>
        )}
      </div>

      <button type="submit" className="search-button">
        検索
      </button>
    </form>
  );
};

export default TransitForm;
