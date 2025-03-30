"use client";

import { useState } from "react";
import DateTimeSelector from "../components/DateTimeSelector";
import DeparturesList from "../components/DeparturesList";
import OriginSelector from "../components/OriginSelector";
import DestinationSelector from "../components/DestinationSelector";
import IntegratedRouteDisplay from "../components/IntegratedRouteDisplay";
import { Departure, TransitFormData, Location } from "../types/transit";

interface RouteDetailInfo {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  transfers?: {
    transferStop: {
      stopId: string;
      stopName: string;
      stopLat: number;
      stopLon: number;
    };
    nextRoute: RouteDetailInfo;
  }[];
}

interface RouteResponse {
  hasRoute: boolean;
  routes: RouteDetailInfo[];
  type: "direct" | "transfer" | "none";
  transfers: number;
  message?: string;
  originStop: {
    stopId: string;
    stopName: string;
    distance: number;
  };
  destinationStop: {
    stopId: string;
    stopName: string;
    distance: number;
  };
}

export default function Home() {
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [selectedOrigin, setSelectedOrigin] = useState<Location | null>(null);
  const [selectedDestination, setSelectedDestination] =
    useState<Location | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<string>("");
  const [isDeparture, setIsDeparture] = useState<boolean>(true);

  const handleOriginSelected = (location: Location) => {
    setSelectedOrigin(location);
    // 選択値をリセット
    setSearchPerformed(false);
    setRouteInfo(null);
  };

  const handleDestinationSelected = (location: Location) => {
    setSelectedDestination(location);
    // 選択値をリセット
    setSelectedOrigin(null);
    setSearchPerformed(false);
    setRouteInfo(null);
  };

  const handleDateTimeSelected = (formData: TransitFormData) => {
    setSelectedDateTime(formData.dateTime || "");
    setIsDeparture(formData.isDeparture ?? true);
  };

  const handleSearch = async () => {
    if (!selectedOrigin || !selectedDestination || !selectedDateTime) {
      return;
    }

    setRouteLoading(true);
    setSearchPerformed(true);
    setError(null);

    try {
      // 経路検索APIを呼び出す
      const response = await fetch(
        `/api/transit/route?originLat=${selectedOrigin.lat}&originLng=${selectedOrigin.lng}&destLat=${selectedDestination.lat}&destLng=${selectedDestination.lng}&dateTime=${selectedDateTime}&isDeparture=${isDeparture}`
      );

      const data = await response.json();
      console.log("経路検索結果:", data);

      if (response.ok) {
        setRouteInfo(data);

        // 発車情報も取得する（最寄りバス停情報が含まれていると仮定）
        if (data.originStop && data.originStop.stopId) {
          await fetchDepartures(data.originStop.stopId);
        }
      } else {
        setError(data.error || "経路検索に失敗しました");
      }
    } catch (err) {
      console.error("経路検索リクエストエラー:", err);
      setError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました"
      );
    } finally {
      setRouteLoading(false);
    }
  };

  const fetchDepartures = async (stopId: string) => {
    try {
      const params = new URLSearchParams();
      params.append("action", "getDepartures");
      params.append("stopId", stopId);
      params.append("dateTime", selectedDateTime);
      params.append("isDeparture", isDeparture.toString());

      const apiUrl = `/api/transit?${params}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "乗換案内の取得に失敗しました");
      }

      setDepartures(data.departures || []);
    } catch (err) {
      console.error("発車情報取得エラー:", err);
    }
  };

  const resetSearch = () => {
    setSearchPerformed(false);
    setDepartures([]);
    setError(null);
    setRouteInfo(null);
    setRouteLoading(false);
    setSelectedOrigin(null);
    setSelectedDestination(null);
    setSelectedDateTime("");
  };

  return (
    <div className="container mx-auto p-4">
      <header className="text-center my-8">
        <h1 className="text-3xl font-bold text-primary">かざぐるま乗換案内</h1>
        <p className="mt-2 text-lg">千代田区福祉交通の乗換案内サービス</p>
      </header>

      <div className="max-w-md mx-auto">
        {!selectedDestination ? (
          <DestinationSelector
            onDestinationSelected={handleDestinationSelected}
          />
        ) : !selectedOrigin ? (
          <>
            <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
              <h2 className="text-xl font-bold mb-2">選択された目的地</h2>
              <p data-testid="selected-destination">
                {selectedDestination.address ||
                  `緯度: ${selectedDestination.lat.toFixed(
                    6
                  )}, 経度: ${selectedDestination.lng.toFixed(6)}`}
              </p>
            </div>
            <OriginSelector onOriginSelected={handleOriginSelected} />
            <div className="flex justify-center mt-4">
              <button
                className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2 shadow-sm"
                onClick={resetSearch}
                data-testid="reset-search"
              >
                検索条件をリセット
              </button>
            </div>
          </>
        ) : !searchPerformed ? (
          <>
            <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
              <h2 className="text-xl font-bold mb-2">選択された目的地</h2>
              <p data-testid="selected-destination">
                {selectedDestination.address ||
                  `緯度: ${selectedDestination.lat.toFixed(
                    6
                  )}, 経度: ${selectedDestination.lng.toFixed(6)}`}
              </p>
            </div>

            <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
              <h2 className="text-xl font-bold mb-2">選択された出発地</h2>
              <p data-testid="selected-origin">
                {selectedOrigin.address ||
                  `緯度: ${selectedOrigin.lat.toFixed(
                    6
                  )}, 経度: ${selectedOrigin.lng.toFixed(6)}`}
              </p>
            </div>

            <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
              <h2 className="text-xl font-bold mb-2">
                いつ出発/到着しますか？
              </h2>
              <DateTimeSelector
                onSubmit={handleDateTimeSelected}
                initialStopId=""
              />
              <button
                className="btn w-full mt-4 px-6 py-3 bg-green-600 text-white hover:bg-green-700 shadow-sm"
                onClick={handleSearch}
                data-testid="route-search-button"
              >
                経路を検索
              </button>
            </div>

            <div className="flex justify-center mt-4">
              <button
                className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2 shadow-sm"
                onClick={resetSearch}
                data-testid="reset-search"
              >
                検索条件をリセット
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
              <h2 className="text-xl font-bold mb-2">選択された目的地</h2>
              <p data-testid="selected-destination">
                {selectedDestination.address ||
                  `緯度: ${selectedDestination.lat.toFixed(
                    6
                  )}, 経度: ${selectedDestination.lng.toFixed(6)}`}
              </p>
            </div>

            <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
              <h2 className="text-xl font-bold mb-2">選択された出発地</h2>
              <p data-testid="selected-origin">
                {selectedOrigin.address ||
                  `緯度: ${selectedOrigin.lat.toFixed(
                    6
                  )}, 経度: ${selectedOrigin.lng.toFixed(6)}`}
              </p>
            </div>

            {routeLoading ? (
              <div className="text-center py-8">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="mt-2">経路を検索中...</p>
              </div>
            ) : error ? (
              <div className="alert alert-error mb-4">
                <span>{error}</span>
              </div>
            ) : routeInfo ? (
              <div className="mb-6">
                <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
                  <h2 className="text-xl font-bold mb-2">検索結果</h2>
                  {routeInfo.message && (
                    <div className="alert alert-info mb-4">
                      <span>{routeInfo.message}</span>
                    </div>
                  )}

                  <IntegratedRouteDisplay
                    originStop={routeInfo.originStop}
                    destinationStop={routeInfo.destinationStop}
                    routes={routeInfo.routes}
                    type={routeInfo.type}
                    transfers={routeInfo.transfers}
                    departures={departures}
                    message={routeInfo.message}
                    originLat={selectedOrigin.lat}
                    originLng={selectedOrigin.lng}
                    destLat={selectedDestination.lat}
                    destLng={selectedDestination.lng}
                  />
                </div>

                {departures.length > 0 && (
                  <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
                    <h2 className="text-xl font-bold mb-4">発車時刻</h2>
                    <DeparturesList
                      departures={departures}
                      loading={false}
                      error={null}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p>経路情報が見つかりませんでした。</p>
              </div>
            )}

            <div className="flex justify-center mt-4">
              <button
                className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2 shadow-sm"
                onClick={resetSearch}
              >
                検索条件をリセット
              </button>
            </div>
          </>
        )}
      </div>

      <footer className="text-center mt-8 text-sm text-gray-500">
        <p>※このサービスは非公式のもので、千代田区とは関係ありません</p>
      </footer>
    </div>
  );
}
