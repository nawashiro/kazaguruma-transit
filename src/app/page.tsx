"use client";

import { useState, useEffect } from "react";
import DateTimeSelector from "../components/DateTimeSelector";
import DeparturesList from "../components/DeparturesList";
import OriginSelector from "../components/OriginSelector";
import DestinationSelector from "../components/DestinationSelector";
import NearestStopFinder from "../components/NearestStopFinder";
import TransitStopInfo from "../components/TransitStopInfo";
import RouteDetail from "../components/RouteDetail";
import IntegratedRouteDisplay from "../components/IntegratedRouteDisplay";
import { Departure, TransitFormData, Location } from "../types/transit";

interface StopInfo {
  stop_id: string;
  stop_name: string;
  distance?: number;
}

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
  const [nearestStopFound, setNearestStopFound] = useState(false);
  const [originStop, setOriginStop] = useState<StopInfo | null>(null);
  const [destinationStop, setDestinationStop] = useState<StopInfo | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const handleOriginSelected = (location: Location) => {
    setSelectedOrigin(location);
    // 出発地が選択されたら、次は目的地選択に進む
  };

  const handleDestinationSelected = (location: Location) => {
    setSelectedDestination(location);
    // 目的地が選択されたら、次のステップに進む

    // 目的地の最寄りバス停も検索して保存する
    fetchDestinationStop(location);
  };

  // 目的地の最寄りバス停を検索する関数
  const fetchDestinationStop = async (location: Location) => {
    if (!location || !location.lat || !location.lng) {
      console.error("目的地の位置情報が不正です");
      return;
    }

    try {
      console.log("目的地の最寄りバス停を検索中...", location);

      const response = await fetch(
        `/api/transit/nearest-stop?lat=${location.lat}&lng=${location.lng}`
      );
      const data = await response.json();
      console.log("目的地の最寄りバス停API応答:", data);

      if (!response.ok) {
        throw new Error(data.error || "バス停の取得に失敗しました");
      }

      if (data.nearestStop) {
        const stopData = data.nearestStop;
        console.log("目的地の最寄りバス停を見つけました:", stopData);

        setDestinationStop({
          stop_id: stopData.stop_id,
          stop_name: stopData.stop_name,
          distance: stopData.distance,
        });
      } else {
        console.log("目的地の近くにバス停が見つかりませんでした");
      }
    } catch (err) {
      console.error("目的地の最寄りバス停取得エラー:", err);
    }
  };

  const handleStopSelected = (stop: StopInfo) => {
    console.log("最寄りバス停が選択されました:", stop);

    if (!stop || !stop.stop_id) {
      console.error("バス停データが不正です:", stop);
      return;
    }

    // 最寄りバス停情報を保存
    setOriginStop(stop);

    // 最寄りバス停が見つかったフラグを設定
    setNearestStopFound(true);
  };

  const handleFormSubmit = async (formData: TransitFormData) => {
    setLoading(true);
    setError(null);
    setSearchPerformed(true);

    try {
      // APIパラメータを構築
      const params = new URLSearchParams();

      // 新しいAPI形式にアクション追加
      params.append("action", "getDepartures");

      if (formData.stopId) {
        console.log("バス停ID検索:", formData.stopId);
        params.append("stopId", formData.stopId);
      }

      // 日時と出発/到着情報を追加
      if (formData.dateTime) {
        console.log("日時:", formData.dateTime);
        params.append("dateTime", formData.dateTime);
      }

      if (formData.isDeparture !== undefined) {
        console.log("出発モード:", formData.isDeparture);
        params.append("isDeparture", formData.isDeparture.toString());
      }

      // 特定の路線が選択されている場合にのみ追加
      if (formData.routeId) {
        params.append("routeId", formData.routeId);
      }

      // 出発地と目的地の情報を追加
      if (selectedOrigin) {
        formData.origin = selectedOrigin;
      }

      if (selectedDestination) {
        formData.destination = selectedDestination;
      }

      // API実行URLをログ出力
      const apiUrl = `/api/transit?${params}`;
      console.log("API呼び出し:", apiUrl);

      // API呼び出し
      const response = await fetch(apiUrl);
      const data = await response.json();
      console.log("発車情報API応答:", data);

      if (!response.ok) {
        throw new Error(data.error || "乗換案内の取得に失敗しました");
      }

      setDepartures(data.departures || []);
    } catch (err) {
      console.error("発車情報取得エラー:", err);
      setError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました"
      );
      setDepartures([]);
    } finally {
      setLoading(false);
    }
  };

  // 出発地と目的地が両方選択されたら、経路検索を行う
  useEffect(() => {
    if (selectedOrigin && selectedDestination) {
      searchRoute();
    }
  }, [originStop, destinationStop]);

  // 経路検索を行う関数
  const searchRoute = async () => {
    if (
      !selectedOrigin ||
      !selectedDestination ||
      !originStop ||
      !destinationStop
    ) {
      return;
    }

    setRouteLoading(true);

    try {
      const response = await fetch(
        `/api/transit/route?originLat=${selectedOrigin.lat}&originLng=${selectedOrigin.lng}&destLat=${selectedDestination.lat}&destLng=${selectedDestination.lng}`
      );

      const data = await response.json();
      console.log("経路検索結果:", data);

      if (response.ok) {
        setRouteInfo(data);
      } else {
        console.error("経路検索エラー:", data.error || "不明なエラー");
      }
    } catch (err) {
      console.error("経路検索リクエストエラー:", err);
    } finally {
      setRouteLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <header className="text-center my-8">
        <h1 className="text-3xl font-bold text-primary">かざぐるま乗換案内</h1>
        <p className="mt-2 text-lg">千代田区福祉交通の乗換案内サービス</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          {!selectedOrigin ? (
            <>
              <OriginSelector onOriginSelected={handleOriginSelected} />
              <div className="flex justify-center mt-4">
                <button
                  className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2 shadow-sm"
                  onClick={() => {
                    // すべての状態をリセット
                    setSearchPerformed(false);
                    setDepartures([]);
                    setError(null);
                    setRouteInfo(null);
                    setRouteLoading(false);
                    setSelectedOrigin(null);
                    setSelectedDestination(null);
                    setNearestStopFound(false);
                  }}
                  data-testid="reset-search"
                >
                  検索条件をリセット
                </button>
              </div>
            </>
          ) : !selectedDestination ? (
            <>
              <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
                <h2 className="text-xl font-bold mb-2">選択された出発地</h2>
                <p data-testid="selected-origin">
                  {selectedOrigin.address ||
                    `緯度: ${selectedOrigin.lat.toFixed(
                      6
                    )}, 経度: ${selectedOrigin.lng.toFixed(6)}`}
                </p>
              </div>
              <DestinationSelector
                onDestinationSelected={handleDestinationSelected}
              />
              <div className="flex justify-center mt-4">
                <button
                  className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2 shadow-sm"
                  onClick={() => {
                    // すべての状態をリセット
                    setSearchPerformed(false);
                    setDepartures([]);
                    setError(null);
                    setRouteInfo(null);
                    setRouteLoading(false);
                    setSelectedOrigin(null);
                    setSelectedDestination(null);
                    setNearestStopFound(false);
                  }}
                  data-testid="reset-search"
                >
                  検索条件をリセット
                </button>
              </div>
            </>
          ) : (
            <>
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
                <h2 className="text-xl font-bold mb-2">選択された目的地</h2>
                <p data-testid="selected-destination">
                  {selectedDestination.address ||
                    `緯度: ${selectedDestination.lat.toFixed(
                      6
                    )}, 経度: ${selectedDestination.lng.toFixed(6)}`}
                </p>
              </div>

              {/* バス停情報 */}
              {(originStop || destinationStop) &&
                routeInfo &&
                routeInfo.type !== "none" && (
                  <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
                    <h2 className="text-xl font-bold mb-2">バス停情報</h2>
                    <div className="space-y-2">
                      {originStop && (
                        <TransitStopInfo
                          stopInfo={originStop}
                          location={selectedOrigin}
                          type="origin"
                        />
                      )}
                      {destinationStop && (
                        <TransitStopInfo
                          stopInfo={destinationStop}
                          location={selectedDestination}
                          type="destination"
                        />
                      )}
                    </div>
                  </div>
                )}

              {/* ルートが見つからない場合のメッセージを独立したセクションとして表示 */}
              {routeInfo && routeInfo.type === "none" && (
                <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
                  <h2 className="text-xl font-bold mb-2">経路検索結果</h2>
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-700 font-medium">
                      ルートが見つかりません
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      この2つの地点を結ぶルートが見つかりませんでした。
                      最寄りのバス停まで歩くか、別の交通手段をご検討ください。
                    </p>
                  </div>
                </div>
              )}

              {/* 最寄りバス停の検索と自動選択 */}
              {!nearestStopFound ? (
                <>
                  <NearestStopFinder
                    userLocation={selectedOrigin}
                    onStopSelected={handleStopSelected}
                  />
                  <div className="flex justify-center mt-4">
                    <button
                      className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2 shadow-sm"
                      onClick={() => {
                        // すべての状態をリセット
                        setSearchPerformed(false);
                        setDepartures([]);
                        setError(null);
                        setRouteInfo(null);
                        setRouteLoading(false);
                        setSelectedOrigin(null);
                        setSelectedDestination(null);
                        setNearestStopFound(false);
                      }}
                      data-testid="reset-search"
                    >
                      検索条件をリセット
                    </button>
                  </div>
                </>
              ) : (
                /* 最寄りバス停が見つかったら日時選択フォームを表示 */
                <>
                  {/* ルートが見つからない場合は日時選択を表示しない */}
                  {!(routeInfo && routeInfo.type === "none") && (
                    <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
                      <h2 className="text-xl font-bold mb-2">
                        いつ出発/到着しますか？
                      </h2>
                      <DateTimeSelector
                        initialStopId={originStop?.stop_id || ""}
                        onSubmit={handleFormSubmit}
                        disabled={searchPerformed}
                      />
                    </div>
                  )}
                  <div className="flex justify-center mt-4">
                    <button
                      className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2 shadow-sm"
                      onClick={() => {
                        // すべての状態をリセット
                        setSearchPerformed(false);
                        setDepartures([]);
                        setError(null);
                        setRouteInfo(null);
                        setRouteLoading(false);
                        setSelectedOrigin(null);
                        setSelectedDestination(null);
                        setNearestStopFound(false);
                      }}
                      data-testid="reset-search"
                    >
                      検索条件をリセット
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="md:col-span-2">
          {/* 経路検索結果の表示 */}
          {selectedOrigin && selectedDestination && searchPerformed && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4">経路検索結果</h2>

              {routeLoading ? (
                <div className="flex flex-col items-center justify-center p-6 bg-base-200 rounded-lg shadow-md">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                  <p className="mt-4">経路を検索中...</p>
                </div>
              ) : routeInfo && routeInfo.type !== "none" ? (
                <IntegratedRouteDisplay
                  originStop={routeInfo.originStop}
                  destinationStop={routeInfo.destinationStop}
                  routes={routeInfo.routes}
                  type={routeInfo.type}
                  transfers={routeInfo.transfers}
                  departures={departures}
                  message={routeInfo.message}
                  originLat={selectedOrigin?.lat}
                  originLng={selectedOrigin?.lng}
                  destLat={selectedDestination?.lat}
                  destLng={selectedDestination?.lng}
                />
              ) : routeInfo && routeInfo.type === "none" ? null : !routeInfo ? ( // ルートが見つからない場合は何も表示しない（左側に既にメッセージがあるため）
                <div className="alert alert-info shadow-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-current shrink-0 w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <div>
                    <h3 className="font-bold">経路情報の取得に失敗しました</h3>
                    <div className="text-xs">
                      しばらく待ってから再度お試しください
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <footer className="text-center text-sm text-gray-500 mt-16 mb-8">
        <p>© {new Date().getFullYear()} かざぐるま乗換案内 - 非公式サービス</p>
        <p className="mt-1">
          このサービスは
          <a
            href="https://github.com/BlinkTagInc/transit-departures-widget"
            className="text-primary hover:underline"
          >
            transit-departures-widget
          </a>
          と
          <a
            href="https://daisyui.com/"
            className="text-primary hover:underline"
          >
            DaisyUI
          </a>
          を利用しています
        </p>
      </footer>
    </div>
  );
}
