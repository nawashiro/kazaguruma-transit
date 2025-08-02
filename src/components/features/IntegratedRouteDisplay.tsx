"use client";

import React, { memo } from "react";
import { Departure } from "@/types/core";
import { generateGoogleMapDirectionLink } from "@/utils/maps";
import { logger } from "@/utils/logger";
import Card from "@/components/ui/Card";
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
      routes.find((route) => route.routeId === routeId)?.departureTime || "時刻不明"
    );
  };

  // 到着時刻を計算する関数 (出発時刻 + 所要時間の概算)
  const calculateArrivalTime = (
    departureTime: string | undefined,
    durationMinutes: number = 30
  ) => {
    if (!departureTime || departureTime === "時刻不明") {
      return "時刻不明";
    }

    try {
      const [hours, minutes] = departureTime.split(":").map(Number);
      const totalMinutes = minutes + durationMinutes;
      const additionalHours = Math.floor(totalMinutes / 60);
      const finalMinutes = totalMinutes % 60;
      const finalHours = (hours + additionalHours) % 24;

      const formattedHours = finalHours.toString().padStart(2, "0");
      const formattedMinutes = finalMinutes.toString().padStart(2, "0");
      
      return `${formattedHours}:${formattedMinutes}`;
    } catch (error: unknown) {
      const routeError = error as RouteError;
      logger.error("ルート表示エラー:", routeError.message);
      return "時刻不明";
    }
  };

  // Googleマップリンクを生成（両方の緯度経度が存在する場合のみ）
  const hasOriginCoordinates = Boolean(originLat && originLng);
  const originStopLatitude = originStop.stop_lat || originStop.lat || 0;
  const originStopLongitude = originStop.stop_lon || originStop.lng || 0;
  const hasOriginStopCoordinates = Boolean(originStopLatitude && originStopLongitude);
  
  const originToStopMapLink = hasOriginCoordinates && hasOriginStopCoordinates
    ? generateGoogleMapDirectionLink(originLat!, originLng!, parseFloat(originStopLatitude.toString()), parseFloat(originStopLongitude.toString()))
    : undefined;

  const hasDestinationCoordinates = Boolean(destLat && destLng);
  const destinationStopLatitude = destinationStop.stop_lat || destinationStop.lat || 0;
  const destinationStopLongitude = destinationStop.stop_lon || destinationStop.lng || 0;
  const hasDestinationStopCoordinates = Boolean(destinationStopLatitude && destinationStopLongitude);
  
  const stopToDestinationMapLink = hasDestinationCoordinates && hasDestinationStopCoordinates
    ? generateGoogleMapDirectionLink(parseFloat(destinationStopLatitude.toString()), parseFloat(destinationStopLongitude.toString()), destLat!, destLng!)
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
              calculateArrivalTime(departureTime, firstSegmentDuration);

            // 時刻表示のためのフォーマッター
            const formatTimeDisplay = (time: string) => {
              if (time === "時刻不明") {
                return time;
              }
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
                  {(() => {
                    const hasTransfers = route.transfers && route.transfers.length > 0;
                    const stopName = hasTransfers 
                      ? route.transfers![0].transferStop.stopName 
                      : destinationStop.stopName;
                    
                    return (
                      <StopTimeDisplay
                        stopName={stopName}
                        time={formatTimeDisplay(arrivalTime)}
                        dateTime={arrivalTime}
                      />
                    );
                  })()}
                </Card>

                {/* 乗換情報（ある場合） */}
                {(() => {
                  if (!route.transfers || route.transfers.length === 0) {
                    return null;
                  }
                  
                  return (
                  <>
                    <div className="text-center my-4">
                      <div className="inline-block bg-blue-100 px-4 py-2 rounded-full font-bold text-blue-800 border border-blue-300 shadow-sm">
                        ここで乗り換え
                      </div>
                    </div>

                    {route.transfers.map((transfer) => {
                      // 乗換後の時刻を計算
                      const transferWaitTime = 15; // 乗換待ち時間（分）
                      const transferDepartureTime = calculateArrivalTime(
                        arrivalTime,
                        transferWaitTime
                      );
                      const finalArrivalTime = calculateArrivalTime(
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
                  );
                })()}
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

export default memo(IntegratedRouteDisplay);
