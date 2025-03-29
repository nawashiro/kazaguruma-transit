"use client";

import { useEffect, useState } from "react";
import { Location, Stop } from "../types/transit";

interface NearestStopFinderProps {
  userLocation: Location;
  onStopSelected: (stop: any) => void;
}

interface NearestStopResponse {
  stops: Stop[];
  nearestStop: {
    stop_id: string;
    stop_name: string;
    stop_code?: string;
    stop_lat: string;
    stop_lon: string;
    distance: number;
  } | null;
}

export default function NearestStopFinder({
  userLocation,
  onStopSelected,
}: NearestStopFinderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nearestStop, setNearestStop] = useState<
    NearestStopResponse["nearestStop"] | null
  >(null);

  useEffect(() => {
    let isMounted = true;

    const fetchNearestStop = async () => {
      if (!userLocation || !userLocation.lat || !userLocation.lng) {
        setError("位置情報が正しく指定されていません");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log("最寄りバス停を検索中...", userLocation);

        const response = await fetch(
          `/api/transit/nearest-stop?lat=${userLocation.lat}&lng=${userLocation.lng}`
        );
        const data = (await response.json()) as NearestStopResponse;
        console.log("API応答:", data);

        if (!response.ok) {
          throw new Error(
            data.nearestStop?.stop_name || "バス停の取得に失敗しました"
          );
        }

        if (data.nearestStop && isMounted) {
          const stopData = data.nearestStop;
          console.log("最寄りバス停を見つけました:", stopData);
          console.log("バス停ID:", stopData.stop_id);
          console.log("バス停名:", stopData.stop_name);

          setNearestStop(stopData);

          // デバッグ: データ形式を確認
          console.log("onStopSelected呼び出し前のデータ:", {
            stop_id: stopData.stop_id,
            stop_name: stopData.stop_name,
          });

          // 自動的に最寄りのバス停を選択 (遅延を設定して状態更新後に実行)
          setTimeout(() => {
            if (isMounted) {
              console.log("最寄りバス停を選択中...");
              const stopDataToSend = {
                stop_id: stopData.stop_id,
                stop_name: stopData.stop_name,
                distance: stopData.distance,
              };
              console.log("選択するバス停データ:", stopDataToSend);
              onStopSelected(stopDataToSend);
            }
          }, 500);
        } else if (isMounted) {
          console.log("近くにバス停が見つかりませんでした");
          setError("近くにバス停が見つかりませんでした");
        }
      } catch (err) {
        if (isMounted) {
          console.error("最寄りバス停取得エラー:", err);
          setError(
            err instanceof Error ? err.message : "予期せぬエラーが発生しました"
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchNearestStop();

    return () => {
      isMounted = false;
    };
  }, [userLocation, onStopSelected]);

  if (loading) {
    return (
      <div className="bg-base-200 p-4 rounded-lg shadow-md">
        <div className="flex flex-col items-center justify-center">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="mt-2">最寄りのバス停を検索中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-base-200 p-4 rounded-lg shadow-md">
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!nearestStop) {
    return (
      <div className="bg-base-200 p-4 rounded-lg shadow-md">
        <div className="alert alert-warning">
          <span>最寄りのバス停が見つかりませんでした</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base-200 p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-bold">
        最寄りのバス停: {nearestStop.stop_name}
      </h3>
      <p className="text-sm">（自動的に選択されました）</p>
      {nearestStop.distance !== undefined && (
        <p className="text-xs mt-2">
          現在地からの距離: 約{nearestStop.distance.toFixed(2)}km
        </p>
      )}
      <button
        className="btn btn-sm btn-primary mt-2"
        onClick={() => onStopSelected(nearestStop)}
      >
        このバス停を選択
      </button>
    </div>
  );
}
