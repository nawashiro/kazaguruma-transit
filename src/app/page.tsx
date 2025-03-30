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

        // 利用可能なルートを時間順にソート（出発時刻が早い順）
        const sortedJourneys = data?.journeys
          ? [...data.journeys].sort((a, b) => {
              // 時刻をタイムスタンプに変換して比較
              const timeA = a.departure ? new Date(a.departure).getTime() : 0;
              const timeB = b.departure ? new Date(b.departure).getTime() : 0;
              return timeA - timeB;
            })
          : [];

        // 時刻文字列から時間と分を取得するヘルパー関数
        const extractTimeComponents = (timeString: string) => {
          // ISO形式の場合（例：2023-01-01T10:30:00）
          const isoMatch = timeString.match(/T(\d{2}):(\d{2})/);
          if (isoMatch) {
            return {
              hours: parseInt(isoMatch[1], 10),
              minutes: parseInt(isoMatch[2], 10),
            };
          }

          // 単純な時刻形式の場合（例：10:30:00 または 10:30）
          const simpleMatch = timeString.match(/^(\d{2}):(\d{2})/);
          if (simpleMatch) {
            return {
              hours: parseInt(simpleMatch[1], 10),
              minutes: parseInt(simpleMatch[2], 10),
            };
          }

          return null;
        };

        // 指定時刻の取得
        const requestedTimeComponents = extractTimeComponents(selectedDateTime);
        console.log("指定された時刻コンポーネント:", requestedTimeComponents);

        // 指定時刻以降の最も早い便を選択
        let bestJourney = null;
        if (sortedJourneys.length > 0 && requestedTimeComponents) {
          const reqHours = requestedTimeComponents.hours;
          const reqMinutes = requestedTimeComponents.minutes;

          for (const journey of sortedJourneys) {
            if (!journey.departure) continue;

            const journeyTimeComponents = extractTimeComponents(
              journey.departure
            );
            if (!journeyTimeComponents) continue;

            const jHours = journeyTimeComponents.hours;
            const jMinutes = journeyTimeComponents.minutes;

            console.log(
              `便の時刻比較: ${jHours}:${jMinutes} vs 指定時刻 ${reqHours}:${reqMinutes}`
            );

            // 時間を分に変換して比較（より正確）
            const reqTotalMinutes = reqHours * 60 + reqMinutes;
            const jTotalMinutes = jHours * 60 + jMinutes;

            // 指定時刻以降の便を選択
            if (jTotalMinutes >= reqTotalMinutes) {
              bestJourney = journey;
              console.log(`最適な便が見つかりました: ${jHours}:${jMinutes}`);
              break;
            }
          }

          // 指定時刻以降の便がない場合は最初の便を選択
          if (!bestJourney && sortedJourneys.length > 0) {
            bestJourney = sortedJourneys[0];
            console.log(
              "指定時刻以降の便がないため、最初の便を選択:",
              bestJourney
            );
          }
        } else {
          if (sortedJourneys.length > 0) {
            bestJourney = sortedJourneys[0];
            console.log("時刻比較ができないため、最初の便を選択:", bestJourney);
          }
        }

        console.log("時間順にソートされたルート:", sortedJourneys);
        console.log("選択された最適なルート:", bestJourney);

        // APIレスポンスをログ出力して確認
        console.log("選択されたルート:", bestJourney);
        console.log("選択されたルートの出発時刻:", bestJourney?.departure);
        console.log("選択されたルートの到着時刻:", bestJourney?.arrival);
        console.log("利用可能な全ルート:", data?.journeys);

        // 時刻の形式を確認
        if (bestJourney?.departure) {
          console.log(
            "時刻形式:",
            typeof bestJourney.departure,
            bestJourney.departure
          );
        }

        // 日付部分と時刻部分が含まれている場合は時刻部分のみを抽出
        const formatTime = (timeString?: string): string => {
          if (!timeString) return "";

          // 抽出した時間コンポーネントを使用
          const timeComponents = extractTimeComponents(timeString);
          if (timeComponents) {
            // 時・分を適切にフォーマット（秒は省略）
            return `${String(timeComponents.hours).padStart(2, "0")}:${String(
              timeComponents.minutes
            ).padStart(2, "0")}`;
          }

          // 既存のロジックもバックアップとして維持
          // ISO形式の日時から時刻部分のみを抽出（例：2023-01-01T12:34:56Z → 12:34:56）
          const match = timeString.match(/T(\d{2}:\d{2}:\d{2})/);
          if (match && match[1]) {
            return match[1];
          }
          // 既に時刻形式の場合はそのまま返す
          if (timeString.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
            return timeString;
          }
          return timeString; // 不明な形式の場合はそのまま返す
        };

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
                  departureTime: formatTime(bestJourney.departure),
                  arrivalTime: formatTime(bestJourney.arrival),
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
