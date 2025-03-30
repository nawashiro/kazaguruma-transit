"use client";

import { useState } from "react";
import DateTimeSelector from "../components/DateTimeSelector";
import OriginSelector from "../components/OriginSelector";
import DestinationSelector from "../components/DestinationSelector";
import IntegratedRouteDisplay from "../components/IntegratedRouteDisplay";
import Button from "../components/common/Button";
import ResetButton from "../components/common/ResetButton";
import { TransitFormData, Location } from "../types/transit";

interface JourneySegment {
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: number;
  route: string;
  color?: string;
  textColor?: string;
}

interface Journey {
  departure: string;
  arrival: string;
  duration: number;
  transfers: number;
  route?: string;
  from: string;
  to: string;
  color?: string;
  textColor?: string;
  segments?: JourneySegment[];
  transferInfo?: {
    stop: string;
    waitTime: number;
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface NearbyStop {
  id: string;
  name: string;
  distance: number;
}

interface RouteResponseData {
  journeys: Journey[];
  stops: NearbyStop[];
  message?: string;
}

interface ApiResponse {
  success: boolean;
  data?: RouteResponseData;
  error?: string;
}

// 旧APIのレスポンス型を新APIに変換するための型
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
    stop_lat?: number;
    stop_lon?: number;
  };
  destinationStop: {
    stopId: string;
    stopName: string;
    distance: number;
    stop_lat?: number;
    stop_lon?: number;
  };
}

interface RouteDetailInfo {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  departureTime?: string;
  arrivalTime?: string;
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

export default function Home() {
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
    setSearchPerformed(false);
    setRouteInfo(null);
  };

  const handleDateTimeSelected = (formData: TransitFormData) => {
    setSelectedDateTime(formData.dateTime || "");
    // オプショナルのbooleanプロパティを確実にbooleanに変換
    setIsDeparture(
      !!formData.isDeparture || formData.isDeparture === undefined
    );
  };

  const handleSearch = async () => {
    if (!selectedOrigin || !selectedDestination || !selectedDateTime) {
      return;
    }

    setRouteLoading(true);
    setSearchPerformed(true);
    setError(null);

    try {
      // 新しいAPIを使用して経路検索リクエストを送信
      const routeQuery = {
        type: "route" as const,
        origin: {
          lat: selectedOrigin.lat,
          lng: selectedOrigin.lng,
        },
        destination: {
          lat: selectedDestination.lat,
          lng: selectedDestination.lng,
        },
        time: selectedDateTime,
      };

      const response = await fetch("/api/transit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(routeQuery),
      });

      const apiResponse: ApiResponse = await response.json();
      console.log("経路検索結果:", apiResponse);

      if (response.ok && apiResponse.success) {
        const data = apiResponse.data;

        // 最適なルートを1つだけ選択（最初のルートを使用）
        const bestJourney =
          data?.journeys && data.journeys.length > 0 ? data.journeys[0] : null;

        // APIレスポンスをログ出力して確認
        console.log("選択されたルート:", bestJourney);

        // 新しいAPIから旧APIの形式に変換
        const convertedResponse: RouteResponse = {
          hasRoute: Boolean(bestJourney),
          routes: bestJourney
            ? [
                {
                  routeId: bestJourney.route || "",
                  routeName: bestJourney.route || "",
                  routeShortName: bestJourney.route || "内神田ルート",
                  routeLongName: "",
                  routeColor: bestJourney.color || "#000000",
                  routeTextColor: bestJourney.textColor || "#FFFFFF",
                  departureTime: bestJourney.departure,
                  arrivalTime: bestJourney.arrival,
                },
              ]
            : [],
          type:
            bestJourney && bestJourney.transfers && bestJourney.transfers > 0
              ? "transfer"
              : bestJourney
              ? "direct"
              : "none",
          transfers: bestJourney?.transfers || 0,
          message: data?.message,
          originStop: {
            stopId: data?.stops?.[0]?.id || "",
            stopName: data?.stops?.[0]?.name || "",
            distance: data?.stops?.[0]?.distance || 0,
            stop_lat: 0,
            stop_lon: 0,
          },
          destinationStop: {
            stopId: data?.stops?.[1]?.id || "",
            stopName: data?.stops?.[1]?.name || "",
            distance: data?.stops?.[1]?.distance || 0,
            stop_lat: 0,
            stop_lon: 0,
          },
        };

        setRouteInfo(convertedResponse);
      } else {
        setError(apiResponse.error || "経路検索に失敗しました");
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

  const resetSearch = () => {
    setSearchPerformed(false);
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
            <ResetButton onReset={resetSearch} className="mt-4" />
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
              <h2 className="text-xl font-bold mb-2">日時の選択</h2>
              <DateTimeSelector onDateTimeSelected={handleDateTimeSelected} />

              <div className="flex flex-col gap-2 mt-4">
                <div className="flex justify-center">
                  <Button
                    onClick={handleSearch}
                    disabled={!selectedDateTime}
                    testId="search-route"
                  >
                    検索
                  </Button>
                </div>
              </div>
            </div>

            <ResetButton onReset={resetSearch} className="mt-4" />
          </>
        ) : (
          <>
            <ResetButton onReset={resetSearch} className="mb-4" />

            {error ? (
              <div className="alert alert-error mb-4">{error}</div>
            ) : routeLoading ? (
              <div className="text-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
                <p className="mt-2">経路を検索中...</p>
              </div>
            ) : routeInfo ? (
              <div>
                <IntegratedRouteDisplay
                  originStop={routeInfo.originStop}
                  destinationStop={routeInfo.destinationStop}
                  routes={routeInfo.routes}
                  type={routeInfo.type}
                  transfers={routeInfo.transfers}
                  message={routeInfo.message}
                  originLat={selectedOrigin.lat}
                  originLng={selectedOrigin.lng}
                  destLat={selectedDestination.lat}
                  destLng={selectedDestination.lng}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      <footer className="text-center mt-8 text-sm text-gray-500">
        <p>※このサービスは非公式のもので、千代田区とは関係ありません</p>
      </footer>
    </div>
  );
}
