"use client";

import { useState } from "react";
import DateTimeSelector from "../components/DateTimeSelector";
import DeparturesList from "../components/DeparturesList";
import OriginSelector from "../components/OriginSelector";
import DestinationSelector from "../components/DestinationSelector";
import NearestStopFinder from "../components/NearestStopFinder";
import TransitStopInfo from "../components/TransitStopInfo";
import { Departure, TransitFormData, Location } from "../types/transit";

interface StopInfo {
  stop_id: string;
  stop_name: string;
  distance?: number;
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
      if (formData.stopId) {
        console.log("バス停ID検索:", formData.stopId);
        params.append("stop", formData.stopId);
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
        params.append("route", formData.routeId);
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

  const resetDestination = () => {
    setSelectedDestination(null);
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
            <OriginSelector onOriginSelected={handleOriginSelected} />
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
                <button
                  className="btn btn-sm btn-outline mt-2"
                  onClick={() => setSelectedOrigin(null)}
                  data-testid="change-origin"
                >
                  出発地を変更
                </button>
              </div>
              <DestinationSelector
                onDestinationSelected={handleDestinationSelected}
              />
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
                <button
                  className="btn btn-sm btn-outline mt-2"
                  onClick={() => setSelectedOrigin(null)}
                  data-testid="change-origin"
                >
                  出発地を変更
                </button>
              </div>

              <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
                <h2 className="text-xl font-bold mb-2">選択された目的地</h2>
                <p data-testid="selected-destination">
                  {selectedDestination.address ||
                    `緯度: ${selectedDestination.lat.toFixed(
                      6
                    )}, 経度: ${selectedDestination.lng.toFixed(6)}`}
                </p>
                <button
                  className="btn btn-sm btn-outline mt-2"
                  onClick={resetDestination}
                  data-testid="change-destination"
                >
                  目的地を変更
                </button>
              </div>

              {/* バス停情報 */}
              {(originStop || destinationStop) && (
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

              {/* 最寄りバス停の検索と自動選択 */}
              {!nearestStopFound ? (
                <NearestStopFinder
                  userLocation={selectedOrigin}
                  onStopSelected={handleStopSelected}
                />
              ) : (
                /* 最寄りバス停が見つかったら日時選択フォームを表示 */
                <div className="bg-base-200 p-4 rounded-lg shadow-md mb-4">
                  <h2 className="text-xl font-bold mb-2">
                    いつ出発/到着しますか？
                  </h2>
                  <DateTimeSelector
                    initialStopId={originStop?.stop_id || ""}
                    onSubmit={handleFormSubmit}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="md:col-span-2">
          {searchPerformed && (
            <div className="bg-base-200 p-4 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4">出発案内</h2>
              <DeparturesList
                departures={departures}
                loading={loading}
                error={error}
              />
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
