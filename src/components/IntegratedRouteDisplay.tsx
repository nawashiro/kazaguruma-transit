"use client";

import React from "react";
import { Departure } from "../types/transit";
import { generateGoogleMapDirectionLink } from "../utils/maps";
import { logger } from "../utils/logger";
import Card from "./common/Card";
import StopTimeDisplay from "./StopTimeDisplay";

interface RouteInfo {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  departureTime?: string; // 出発時刻
  arrivalTime?: string; // 到着時刻
  stopCount?: number; // 通過駅数
  transfers?: {
    transferStop: {
      stopId: string;
      stopName: string;
      stopLat: number;
      stopLon: number;
    };
    nextRoute: RouteInfo;
  }[];
}

interface IntegratedRouteDisplayProps {
  originStop: {
    stopId: string;
    stopName: string;
    distance: number;
    stop_lat?: number;
    stop_lon?: number;
    lat?: number;
    lng?: number;
  };
  destinationStop: {
    stopId: string;
    stopName: string;
    distance: number;
    stop_lat?: number;
    stop_lon?: number;
    lat?: number;
    lng?: number;
  };
  routes: RouteInfo[];
  type: "direct" | "transfer" | "none";
  _transfers?: number; // 未使用のためアンダースコア接頭辞を追加
  departures?: Departure[];
  _message?: string; // 未使用のためアンダースコア接頭辞を追加
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
}

interface RouteError {
  message: string;
  code?: string;
}

const IntegratedRouteDisplay: React.FC<IntegratedRouteDisplayProps> = ({
  originStop,
  destinationStop,
  routes,
  type,
  originLat,
  originLng,
  destLat,
  destLng,
}) => {
  // 出発時刻を取得する関数
  const getDepartureTime = (stopId: string, routeId?: string) => {
    return (
      routes.find((r) => r.routeId === routeId)?.departureTime || "時刻不明"
    );
  };

  // 到着時刻を計算する関数 (出発時刻 + 所要時間の概算)
  const getArrivalTime = (
    departureTime: string | undefined,
    durationMinutes: number = 30
  ) => {
    if (!departureTime || departureTime === "時刻不明") return "時刻不明";

    try {
      const [hours, minutes] = departureTime.split(":").map(Number);
      let arrivalMinutes = minutes + durationMinutes;
      let arrivalHours = hours + Math.floor(arrivalMinutes / 60);
      arrivalMinutes = arrivalMinutes % 60;

      // 24時間表記に調整
      arrivalHours = arrivalHours % 24;

      return `${arrivalHours.toString().padStart(2, "0")}:${arrivalMinutes
        .toString()
        .padStart(2, "0")}`;
    } catch (error: unknown) {
      const routeError = error as RouteError;
      logger.error("ルート表示エラー:", routeError.message);
      return "時刻不明";
    }
  };

  // Googleマップリンクを生成（両方の緯度経度が存在する場合のみ）
  const originToStopMapLink =
    originLat &&
    originLng &&
    (originStop.stop_lat || originStop.lat) &&
    (originStop.stop_lon || originStop.lng)
      ? generateGoogleMapDirectionLink(
          originLat,
          originLng,
          parseFloat((originStop.stop_lat || originStop.lat || 0).toString()),
          parseFloat((originStop.stop_lon || originStop.lng || 0).toString())
        )
      : undefined;

  const stopToDestinationMapLink =
    destLat &&
    destLng &&
    (destinationStop.stop_lat || destinationStop.lat) &&
    (destinationStop.stop_lon || destinationStop.lng)
      ? generateGoogleMapDirectionLink(
          parseFloat(
            (destinationStop.stop_lat || destinationStop.lat || 0).toString()
          ),
          parseFloat(
            (destinationStop.stop_lon || destinationStop.lng || 0).toString()
          ),
          destLat,
          destLng
        )
      : undefined;

  return (
    <Card className="rounded-lg" bodyClassName="p-4">
      {type === "none" ? (
        // ルートが見つからない場合の表示
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2 ">ルートが見つかりません</h3>
          <p>この2つの地点を結ぶルートが見つかりませんでした</p>
          <p className="mt-2 ">別の交通手段をご検討ください</p>
        </div>
      ) : (
        // ルートが見つかった場合
        <div>
          {/* 出発地から出発地バス停へのリンク */}
          {originToStopMapLink && (
            <div className="mb-4 text-center">
              <a
                href={originToStopMapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="link text-sm"
              >
                出発地 → {originStop.stopName} Googleマップ
              </a>
            </div>
          )}

          {routes.map((route) => {
            // 各ルートの時刻を計算
            const departureTime =
              route.departureTime ||
              getDepartureTime(originStop.stopId, route.routeId || "");

            const firstSegmentDuration = type === "direct" ? 45 : 30; // 直通か乗換かで所要時間を調整
            const arrivalTime =
              route.arrivalTime ||
              getArrivalTime(departureTime, firstSegmentDuration);

            // 時刻表示のためのフォーマッター
            const formatTimeDisplay = (time: string) => {
              if (time === "時刻不明") return time;
              // 秒を省略して表示（例：12:34:56 → 12:34）
              const match = time.match(/^(\d{2}:\d{2}):\d{2}$/);
              return match ? match[1] : time;
            };

            return (
              <div key={route.routeId} className="mb-6">
                {/* 最初のセグメント */}
                <Card
                  className="mb-4 border-l-4 border-primary"
                  bodyClassName="p-4"
                >
                  {/* 出発バス停と時刻 */}
                  <StopTimeDisplay
                    stopName={originStop.stopName}
                    time={formatTimeDisplay(departureTime)}
                    dateTime={departureTime}
                  />

                  {/* ルート情報 */}
                  <div className="flex items-center my-3">
                    <div className="badge badge-primary mr-2">
                      {route.routeName}
                    </div>
                  </div>

                  {/* 到着バス停と時刻（乗換がない場合は最終目的地） */}
                  {!route.transfers || route.transfers.length === 0 ? (
                    <StopTimeDisplay
                      stopName={destinationStop.stopName}
                      time={formatTimeDisplay(arrivalTime)}
                      dateTime={arrivalTime}
                    />
                  ) : (
                    // 乗換がある場合は乗換駅を表示
                    <StopTimeDisplay
                      stopName={route.transfers[0].transferStop.stopName}
                      time={formatTimeDisplay(arrivalTime)}
                      dateTime={arrivalTime}
                    />
                  )}
                </Card>

                {/* 乗換情報（ある場合） */}
                {route.transfers && route.transfers.length > 0 && (
                  <>
                    <div className="text-center my-4">
                      <div className="inline-block bg-blue-100 px-4 py-2 rounded-full font-bold text-blue-800 border border-blue-300 shadow-sm">
                        ここで乗り換え
                      </div>
                    </div>

                    {route.transfers.map((transfer) => {
                      // 乗換後の時刻を計算
                      const transferWaitTime = 15; // 乗換待ち時間（分）
                      const transferDepartureTime = getArrivalTime(
                        arrivalTime,
                        transferWaitTime
                      );
                      const finalArrivalTime = getArrivalTime(
                        transferDepartureTime,
                        30
                      ); // 乗換後の所要時間

                      return (
                        <Card
                          key={transfer.transferStop.stopId}
                          className="mb-4 border-l-4 border-primary"
                          bodyClassName="p-4"
                        >
                          {/* 乗換駅出発時刻 */}
                          <StopTimeDisplay
                            stopName={transfer.transferStop.stopName}
                            time={formatTimeDisplay(
                              transfer.nextRoute.departureTime ||
                                transferDepartureTime
                            )}
                            dateTime={transferDepartureTime}
                          />

                          {/* 次のルート情報 */}
                          <div className="flex items-center my-3">
                            <div className="badge badge-primary mr-2">
                              {transfer.nextRoute.routeName}
                            </div>
                          </div>

                          {/* 最終到着駅と時刻 */}
                          <StopTimeDisplay
                            stopName={destinationStop.stopName}
                            time={formatTimeDisplay(
                              transfer.nextRoute.arrivalTime || finalArrivalTime
                            )}
                            dateTime={finalArrivalTime}
                          />
                        </Card>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}

          {/* 目的地バス停から目的地へのリンク */}
          {stopToDestinationMapLink && (
            <div className="mt-4 text-center">
              <a
                href={stopToDestinationMapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="link text-sm"
              >
                {destinationStop.stopName} → 目的地 Googleマップ
              </a>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default IntegratedRouteDisplay;
