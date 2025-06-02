"use client";

import { useState, useEffect } from "react";
import DateTimeSelector from "../components/DateTimeSelector";
import OriginSelector from "../components/OriginSelector";
import DestinationSelector from "../components/DestinationSelector";
import IntegratedRouteDisplay from "../components/IntegratedRouteDisplay";
import RoutePdfExport from "../components/RoutePdfExport";
import Button from "../components/common/Button";
import ResetButton from "../components/common/ResetButton";
import Card from "../components/common/Card";
import { TransitFormData, Location } from "../types/transit";
import { logger } from "../utils/logger";
import RateLimitModal from "../components/RateLimitModal";
import FirstVisitGuideModal from "../components/common/FirstVisitGuideModal";

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
  lat?: number;
  lng?: number;
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
  limitExceeded?: boolean;
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
  const [isRateLimitModalOpen, setIsRateLimitModalOpen] = useState(false);
  const [prioritizeSpeed, setPrioritizeSpeed] = useState<boolean>(false);

  // URLパラメータから目的地情報を読み取る
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const destinationParam = params.get("destination");

      // ローカルストレージから「はやさ優先」設定を読み込む
      const savedPrioritizeSpeed = localStorage.getItem("prioritizeSpeed");
      if (savedPrioritizeSpeed) {
        setPrioritizeSpeed(savedPrioritizeSpeed === "true");
      }

      if (destinationParam) {
        try {
          const destinationObj = JSON.parse(
            decodeURIComponent(destinationParam)
          );
          if (
            destinationObj &&
            destinationObj.lat &&
            destinationObj.lng &&
            destinationObj.address
          ) {
            setSelectedDestination(destinationObj);
            // URLからパラメータを削除（ブラウザ履歴に残さない）
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          }
        } catch (err) {
          console.error("目的地情報の解析に失敗しました:", err);
        }
      }
    }
  }, []);

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
    // isDepartureプロパティが存在する場合はその値を設定、存在しない場合はデフォルトでtrue
    setIsDeparture(
      formData.isDeparture !== undefined ? formData.isDeparture : true
    );
    logger.log("時刻設定が変更されました:", {
      dateTime: formData.dateTime,
      isDeparture: formData.isDeparture,
      newIsDeparture:
        formData.isDeparture !== undefined ? formData.isDeparture : true,
    });
  };

  const handlePrioritizeSpeedChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = event.target.checked;
    setPrioritizeSpeed(newValue);
    // ローカルストレージに設定を保存
    localStorage.setItem("prioritizeSpeed", newValue.toString());
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
        isDeparture,
        prioritizeSpeed, // はやさ優先オプション
      };

      logger.log("APIリクエスト送信:", {
        type: routeQuery.type,
        origin: `${routeQuery.origin.lat}, ${routeQuery.origin.lng}`,
        destination: `${routeQuery.destination.lat}, ${routeQuery.destination.lng}`,
        time: routeQuery.time,
        isDeparture: routeQuery.isDeparture,
        prioritizeSpeed: routeQuery.prioritizeSpeed,
        timeType: routeQuery.isDeparture ? "出発時刻" : "到着時刻",
      });

      const response = await fetch("/api/transit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(routeQuery),
      });

      const apiResponse: ApiResponse = await response.json();
      logger.log("経路検索結果:", apiResponse);

      // レート制限に達した場合
      if (response.status === 429 && apiResponse.limitExceeded) {
        setIsRateLimitModalOpen(true);
        setRouteLoading(false);
        return;
      }

      if (response.ok && apiResponse.success) {
        const data = apiResponse.data;

        if (data?.journeys && data.journeys.length > 0) {
          // ベストな経路は既にAPIから最適な順に返されているので最初のものを使用
          const bestJourney = data.journeys[0];
          logger.log("選択された経路:", bestJourney);
          logger.log("APIから返された停留所情報:", data.stops);

          // 最寄りバス停情報（APIのレスポンスからstopsを探す）
          const originStopInfo = data.stops.find(
            (s) => s.name === bestJourney.from
          );
          const destStopInfo = data.stops.find(
            (s) => s.name === bestJourney.to
          );

          logger.log("最寄りバス停情報:", {
            originStopInfo,
            destStopInfo,
            allStops: data.stops,
          });

          // バス停の座標情報を使用(APIから返されたものを必ず使用)
          const originStop = {
            stopId: originStopInfo?.id || "unknown",
            stopName: bestJourney.from,
            distance: originStopInfo?.distance || 0,
            // バス停の座標情報
            stop_lat: originStopInfo?.lat || 0,
            stop_lon: originStopInfo?.lng || 0,
            // ユーザーが選択した実際の出発地点
            lat: selectedOrigin.lat,
            lng: selectedOrigin.lng,
          };

          const destinationStop = {
            stopId: destStopInfo?.id || "unknown",
            stopName: bestJourney.to,
            distance: destStopInfo?.distance || 0,
            // バス停の座標情報
            stop_lat: destStopInfo?.lat || 0,
            stop_lon: destStopInfo?.lng || 0,
            // ユーザーが選択した実際の目的地点
            lat: selectedDestination.lat,
            lng: selectedDestination.lng,
          };

          logger.log("使用されるバス停オブジェクト:", {
            originStop,
            destinationStop,
          });

          // 経路タイプと乗り換え回数
          const type = bestJourney.transfers > 0 ? "transfer" : "direct";
          const transfers = bestJourney.transfers || 0;

          // 経路情報をIntegratedRouteDisplay用の形式に変換
          let routeDetails: RouteDetailInfo[] = [];

          // 乗り換えがない場合は単一の経路情報
          if (!bestJourney.segments || bestJourney.segments.length === 0) {
            routeDetails = [
              {
                routeId: "route-1",
                routeName: bestJourney.route || "不明",
                routeShortName: bestJourney.route || "不明",
                routeLongName: bestJourney.route || "",
                routeColor: bestJourney.color || "#000000",
                routeTextColor: bestJourney.textColor || "#FFFFFF",
                departureTime: bestJourney.departure,
                arrivalTime: bestJourney.arrival,
              },
            ];
          }
          // 乗り換えがある場合は各セグメントの情報を構築
          else {
            // 最初のセグメント
            const firstSegment = bestJourney.segments[0];
            const firstRoute: RouteDetailInfo = {
              routeId: "route-1",
              routeName: firstSegment.route,
              routeShortName: firstSegment.route,
              routeLongName: firstSegment.route || "",
              routeColor: firstSegment.color || "#000000",
              routeTextColor: firstSegment.textColor || "#FFFFFF",
              departureTime: firstSegment.departure,
              arrivalTime: firstSegment.arrival,
            };

            // 乗り換え情報がある場合は追加
            if (bestJourney.transferInfo && bestJourney.segments.length > 1) {
              const secondSegment = bestJourney.segments[1];

              firstRoute.transfers = [
                {
                  transferStop: {
                    stopId: "transfer-stop",
                    stopName: bestJourney.transferInfo.stop,
                    stopLat: bestJourney.transferInfo.location.lat,
                    stopLon: bestJourney.transferInfo.location.lng,
                  },
                  nextRoute: {
                    routeId: "route-2",
                    routeName: secondSegment.route,
                    routeShortName: secondSegment.route,
                    routeLongName: secondSegment.route || "",
                    routeColor: secondSegment.color || "#000000",
                    routeTextColor: secondSegment.textColor || "#FFFFFF",
                    departureTime: secondSegment.departure,
                    arrivalTime: secondSegment.arrival,
                  },
                },
              ];
            }

            routeDetails = [firstRoute];
          }

          // 経路情報をセット
          setRouteInfo({
            hasRoute: true,
            routes: routeDetails,
            type,
            transfers,
            message: data.message,
            originStop,
            destinationStop,
          });

          logger.log("出発地→バス停の情報:", {
            originLat: selectedOrigin.lat,
            originLng: selectedOrigin.lng,
            stopLat: originStop.stop_lat,
            stopLon: originStop.stop_lon,
          });

          logger.log("バス停→目的地の情報:", {
            stopLat: destinationStop.stop_lat,
            stopLon: destinationStop.stop_lon,
            destLat: selectedDestination.lat,
            destLng: selectedDestination.lng,
          });
        } else {
          // 経路が見つからない場合
          setRouteInfo({
            hasRoute: false,
            routes: [],
            type: "none",
            transfers: 0,
            message: data?.message || "経路が見つかりませんでした",
            originStop: {
              stopId: "unknown",
              stopName: "最寄りバス停",
              distance: 0,
            },
            destinationStop: {
              stopId: "unknown",
              stopName: "目的地最寄りバス停",
              distance: 0,
            },
          });
        }
      } else {
        setError(apiResponse.error || "経路検索に失敗しました");
      }
    } catch (err) {
      logger.error("経路検索リクエストエラー:", err);
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
    <div className="container">
      <header className="text-center my-4">
        <h1 className="text-3xl font-bold text-primary">風ぐるま乗換案内</h1>
        <p className="mt-2 text-lg">千代田区福祉交通の乗換案内サービス</p>
      </header>

      {/* 初回訪問ガイドモーダル */}
      <FirstVisitGuideModal />

      <main className="space-y-4 max-w-md mx-auto">
        <div aria-live="polite" className="space-y-4">
          {!selectedDestination ? (
            <DestinationSelector
              onDestinationSelected={handleDestinationSelected}
            />
          ) : !selectedOrigin ? (
            <>
              <Card title="選択された目的地">
                <p data-testid="selected-destination">
                  {selectedDestination.address ||
                    `緯度: ${selectedDestination.lat.toFixed(
                      6
                    )}, 経度: ${selectedDestination.lng.toFixed(6)}`}
                </p>
              </Card>
              <OriginSelector onOriginSelected={handleOriginSelected} />
              <ResetButton onReset={resetSearch} />
            </>
          ) : !searchPerformed ? (
            <>
              <Card title="選択された目的地">
                <p data-testid="selected-destination">
                  {selectedDestination.address ||
                    `緯度: ${selectedDestination.lat.toFixed(
                      6
                    )}, 経度: ${selectedDestination.lng.toFixed(6)}`}
                </p>
              </Card>

              <Card title="選択された出発地">
                <p data-testid="selected-origin">
                  {selectedOrigin.address ||
                    `緯度: ${selectedOrigin.lat.toFixed(
                      6
                    )}, 経度: ${selectedOrigin.lng.toFixed(6)}`}
                </p>
              </Card>

              <Card title="日時の選択">
                <DateTimeSelector onDateTimeSelected={handleDateTimeSelected} />

                {/* はやさ優先スイッチ */}
                <div className="form-control mt-4 space-y-2">
                  <p className="text-sm /60 mt-1">
                    早く到着したい場合はオンにしてください。
                    <br />
                    歩きを最小限にしたい場合はオフにしてください。
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="label-text">はやさ優先</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={prioritizeSpeed}
                      onChange={handlePrioritizeSpeedChange}
                    />
                    <span className="label-text">
                      {prioritizeSpeed ? "ON" : "OFF"}
                    </span>
                  </label>
                </div>

                <div className="card-actions justify-center">
                  <Button
                    onClick={handleSearch}
                    disabled={!selectedDateTime}
                    testId="search-route"
                  >
                    検索
                  </Button>
                </div>
              </Card>

              <ResetButton onReset={resetSearch} />
            </>
          ) : (
            <>
              <ResetButton onReset={resetSearch} />

              {error ? (
                <div className="alert alert-error">{error}</div>
              ) : routeLoading ? (
                <Card bodyClassName="items-center text-center">
                  <span className="loading loading-spinner loading-lg"></span>
                  <p>経路を検索中...</p>
                </Card>
              ) : routeInfo ? (
                <div>
                  <IntegratedRouteDisplay
                    originStop={routeInfo.originStop}
                    destinationStop={routeInfo.destinationStop}
                    routes={routeInfo.routes}
                    type={routeInfo.type}
                    _transfers={routeInfo.transfers}
                    _message={routeInfo.message}
                    originLat={selectedOrigin.lat}
                    originLng={selectedOrigin.lng}
                    destLat={selectedDestination.lat}
                    destLng={selectedDestination.lng}
                  />

                  {/* PDF出力ボタンを追加 */}
                  {routeInfo.type !== "none" && (
                    <div className="mt-4 flex justify-center">
                      <RoutePdfExport
                        originStop={routeInfo.originStop}
                        destinationStop={routeInfo.destinationStop}
                        routes={routeInfo.routes}
                        type={routeInfo.type}
                        transfers={routeInfo.transfers}
                        originLat={selectedOrigin.lat}
                        originLng={selectedOrigin.lng}
                        destLat={selectedDestination.lat}
                        destLng={selectedDestination.lng}
                        selectedDateTime={selectedDateTime}
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
        <Card bodyClassName="text-center text-xs">
          <p>※このサービスは非公式のもので、千代田区とは関係ありません</p>
          <p>※予定は変動し、実際の運行情報とは異なる場合があります</p>
          <p>
            <a
              href="https://lin.ee/CgIBOSd"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              千代田区公式LINE
            </a>
            で最新の運行情報を確認できます
          </p>
        </Card>
      </main>

      {/* レート制限モーダル */}
      <RateLimitModal
        isOpen={isRateLimitModalOpen}
        onClose={() => setIsRateLimitModalOpen(false)}
      />
    </div>
  );
}
