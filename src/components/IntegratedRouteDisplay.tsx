"use client";

import React from "react";
import { Departure } from "../types/transit";
import { generateGoogleMapDirectionLink } from "../utils/maps";

// page.tsxで使用している型定義に合わせる
interface StopInfo {
  stop_id: string;
  stop_name: string;
  distance?: number;
  stop_lat?: number;
  stop_lon?: number;
}

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
  };
  destinationStop: {
    stopId: string;
    stopName: string;
    distance: number;
    stop_lat?: number;
    stop_lon?: number;
  };
  routes: RouteInfo[];
  type: "direct" | "transfer" | "none";
  transfers: number;
  departures?: Departure[];
  message?: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
}

const IntegratedRouteDisplay: React.FC<IntegratedRouteDisplayProps> = ({
  originStop,
  destinationStop,
  routes,
  type,
  transfers,
  message,
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
    } catch (e) {
      return "時刻不明";
    }
  };

  // Googleマップリンクを生成（両方の緯度経度が存在する場合のみ）
  const originToStopMapLink =
    originLat && originLng && originStop.stop_lat && originStop.stop_lon
      ? generateGoogleMapDirectionLink(
          originLat,
          originLng,
          parseFloat(originStop.stop_lat.toString()),
          parseFloat(originStop.stop_lon.toString())
        )
      : undefined;

  const stopToDestinationMapLink =
    destLat && destLng && destinationStop.stop_lat && destinationStop.stop_lon
      ? generateGoogleMapDirectionLink(
          parseFloat(destinationStop.stop_lat.toString()),
          parseFloat(destinationStop.stop_lon.toString()),
          destLat,
          destLng
        )
      : undefined;

  return (
    <div className="bg-base-200 p-4 rounded-lg shadow-md">
      {type === "none" ? (
        // ルートが見つからない場合の表示
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">ルートが見つかりません</h3>
          <p>この2つの地点を結ぶルートが見つかりませんでした</p>
          <p className="mt-2">
            最寄りのバス停まで歩くか、別の交通手段をご検討ください
          </p>
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
                className="btn btn-sm btn-outline btn-primary underline"
              >
                出発地 → {originStop.stopName} Googleマップ
              </a>
            </div>
          )}

          {routes.map((route, index) => {
            // 各ルートの時刻を計算
            const departureTime =
              route.departureTime ||
              getDepartureTime(originStop.stopId, route.routeId || "");

            console.log(
              "表示する出発時刻:",
              route.departureTime,
              departureTime
            );

            const firstSegmentDuration = type === "direct" ? 45 : 30; // 直通か乗換かで所要時間を調整
            const arrivalTime =
              route.arrivalTime ||
              getArrivalTime(departureTime, firstSegmentDuration);

            console.log("表示する到着時刻:", route.arrivalTime, arrivalTime);

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
                <div className="card bg-base-100 shadow-sm mb-4">
                  <div className="card-body p-4">
                    {/* 出発バス停と時刻 */}
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex-1">
                        <div className="font-bold">{originStop.stopName}</div>
                      </div>
                      <div className="badge badge-primary text-lg p-3">
                        {formatTimeDisplay(departureTime)}
                      </div>
                    </div>

                    {/* ルート情報 */}
                    <div className="flex items-center my-3 border-l-4 pl-2 border-primary">
                      <div className="badge badge-primary mr-2">
                        {route.routeShortName}
                      </div>
                      {route.routeLongName && (
                        <div className="flex-1">{route.routeLongName}</div>
                      )}
                      {route.stopCount && (
                        <div className="text-xs text-gray-500 ml-2">
                          {`${route.stopCount}駅`}
                        </div>
                      )}
                    </div>

                    {/* 到着バス停と時刻（乗換がない場合は最終目的地） */}
                    {!route.transfers || route.transfers.length === 0 ? (
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="font-bold">
                            {destinationStop.stopName}
                          </div>
                        </div>
                        <div className="badge badge-secondary text-lg p-3">
                          {formatTimeDisplay(arrivalTime)}
                        </div>
                      </div>
                    ) : (
                      // 乗換がある場合は乗換駅を表示
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="font-bold">
                            {route.transfers[0].transferStop.stopName}
                          </div>
                        </div>
                        <div className="badge badge-secondary text-lg p-3">
                          {formatTimeDisplay(arrivalTime)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 乗換情報（ある場合） */}
                {route.transfers && route.transfers.length > 0 && (
                  <>
                    <div className="divider text-center font-bold">乗換</div>

                    {route.transfers.map((transfer, tIndex) => {
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
                        <div
                          key={tIndex}
                          className="card bg-base-100 shadow-sm mb-4"
                        >
                          <div className="card-body p-4">
                            {/* 乗換駅出発時刻 */}
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex-1">
                                <div className="font-bold">
                                  {transfer.transferStop.stopName}
                                </div>
                              </div>
                              <div className="badge badge-primary text-lg p-3">
                                {formatTimeDisplay(
                                  transfer.nextRoute.departureTime ||
                                    transferDepartureTime
                                )}
                              </div>
                            </div>

                            {/* 次のルート情報 */}
                            <div className="flex items-center my-3 border-l-4 pl-2 border-primary">
                              <div className="badge badge-primary mr-2">
                                {transfer.nextRoute.routeShortName}
                              </div>
                              {transfer.nextRoute.routeLongName && (
                                <div className="flex-1">
                                  {transfer.nextRoute.routeLongName}
                                </div>
                              )}
                              {transfer.nextRoute.stopCount && (
                                <div className="text-xs text-gray-500 ml-2">
                                  {`${transfer.nextRoute.stopCount}駅`}
                                </div>
                              )}
                            </div>

                            {/* 最終到着駅と時刻 */}
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="font-bold">
                                  {destinationStop.stopName}
                                </div>
                              </div>
                              <div className="badge badge-secondary text-lg p-3">
                                {formatTimeDisplay(
                                  transfer.nextRoute.arrivalTime ||
                                    finalArrivalTime
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
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
                className="btn btn-sm btn-outline btn-primary underline"
              >
                {destinationStop.stopName} → 目的地 Googleマップ
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IntegratedRouteDisplay;
