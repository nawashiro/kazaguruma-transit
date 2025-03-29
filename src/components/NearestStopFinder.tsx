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

          // 直接呼び出し、表示は行わない
          const stopDataToSend = {
            stop_id: stopData.stop_id,
            stop_name: stopData.stop_name,
            distance: stopData.distance,
          };

          onStopSelected(stopDataToSend);
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

  // バス停が見つかった場合は何も表示しない（処理はすでに完了）
  return null;
}
