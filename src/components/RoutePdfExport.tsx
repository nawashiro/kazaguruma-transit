"use client";

import React, { useRef, useState, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { logger } from "../utils/logger";
import { Departure } from "../types/transit";
import {
  generateStaticMapWithDirectionsUrl,
  generateStaticMapWithPolylineUrl,
  getDirectionsPolyline,
} from "../utils/maps";

// IntegratedRouteDisplayと同様の型定義を使用
interface StopInfo {
  stopId: string;
  stopName: string;
  distance: number;
  stop_lat?: number;
  stop_lon?: number;
  lat?: number;
  lng?: number;
}

interface RouteInfo {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  departureTime?: string;
  arrivalTime?: string;
  stopCount?: number;
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

interface RoutePdfExportProps {
  originStop: StopInfo;
  destinationStop: StopInfo;
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

// 時刻表示用のフォーマッター関数
const formatTimeDisplay = (time: string) => {
  if (time === "時刻不明") return time;
  // 秒を省略して表示（例：12:34:56 → 12:34）
  const match = time.match(/^(\d{2}:\d{2}):\d{2}$/);
  return match ? match[1] : time;
};

// PDF出力用のコンポーネント - DaisyUIのクラスを使用
const RoutePdfContent: React.FC<RoutePdfExportProps> = (props) => {
  // 地図のポリラインデータ状態
  const [originToStopPolyline, setOriginToStopPolyline] = useState<
    string | null
  >(null);
  const [stopToDestPolyline, setStopToDestPolyline] = useState<string | null>(
    null
  );

  // 現在の日付を取得
  const today = new Date();
  const formattedDate = `${today.getFullYear()}年${
    today.getMonth() + 1
  }月${today.getDate()}日`;

  // 出発時刻を取得する関数
  const getDepartureTime = (stopId: string, routeId?: string) => {
    return (
      props.routes.find((r) => r.routeId === routeId)?.departureTime ||
      "時刻不明"
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

  // Directions APIからポリラインを取得
  useEffect(() => {
    // 出発地→バス停のポリライン取得
    const fetchOriginToStopPolyline = async () => {
      if (
        props.originLat &&
        props.originLng &&
        (props.originStop.stop_lat !== undefined ||
          props.originStop.lat !== undefined) &&
        (props.originStop.stop_lon !== undefined ||
          props.originStop.lng !== undefined)
      ) {
        try {
          const polyline = await getDirectionsPolyline(
            props.originLat,
            props.originLng,
            Number(props.originStop.stop_lat ?? props.originStop.lat ?? 0),
            Number(props.originStop.stop_lon ?? props.originStop.lng ?? 0)
          );

          if (polyline) {
            setOriginToStopPolyline(polyline);
          }
        } catch (error) {
          logger.log("経路ポリライン取得エラー (出発地→バス停):", error);
        }
      }
    };

    // バス停→目的地のポリライン取得
    const fetchStopToDestPolyline = async () => {
      if (
        props.destLat &&
        props.destLng &&
        (props.destinationStop.stop_lat !== undefined ||
          props.destinationStop.lat !== undefined) &&
        (props.destinationStop.stop_lon !== undefined ||
          props.destinationStop.lng !== undefined)
      ) {
        try {
          const polyline = await getDirectionsPolyline(
            Number(
              props.destinationStop.stop_lat ?? props.destinationStop.lat ?? 0
            ),
            Number(
              props.destinationStop.stop_lon ?? props.destinationStop.lng ?? 0
            ),
            props.destLat,
            props.destLng
          );

          if (polyline) {
            setStopToDestPolyline(polyline);
          }
        } catch (error) {
          logger.log("経路ポリライン取得エラー (バス停→目的地):", error);
        }
      }
    };

    fetchOriginToStopPolyline();
    fetchStopToDestPolyline();
  }, [
    props.originLat,
    props.originLng,
    props.destLat,
    props.destLng,
    props.originStop,
    props.destinationStop,
  ]);

  // 地図画像のURL生成
  const originToStopMapUrl =
    props.originLat &&
    props.originLng &&
    (props.originStop.stop_lat !== undefined ||
      props.originStop.lat !== undefined) &&
    (props.originStop.stop_lon !== undefined ||
      props.originStop.lng !== undefined)
      ? originToStopPolyline
        ? generateStaticMapWithPolylineUrl(
            props.originLat,
            props.originLng,
            Number(props.originStop.stop_lat ?? props.originStop.lat ?? 0),
            Number(props.originStop.stop_lon ?? props.originStop.lng ?? 0),
            originToStopPolyline,
            600, // 幅
            200 // 高さ
          )
        : generateStaticMapWithDirectionsUrl(
            props.originLat,
            props.originLng,
            Number(props.originStop.stop_lat ?? props.originStop.lat ?? 0),
            Number(props.originStop.stop_lon ?? props.originStop.lng ?? 0),
            600, // 幅
            200 // 高さ
          )
      : null;

  const stopToDestMapUrl =
    props.destLat &&
    props.destLng &&
    (props.destinationStop.stop_lat !== undefined ||
      props.destinationStop.lat !== undefined) &&
    (props.destinationStop.stop_lon !== undefined ||
      props.destinationStop.lng !== undefined)
      ? stopToDestPolyline
        ? generateStaticMapWithPolylineUrl(
            Number(
              props.destinationStop.stop_lat ?? props.destinationStop.lat ?? 0
            ),
            Number(
              props.destinationStop.stop_lon ?? props.destinationStop.lng ?? 0
            ),
            props.destLat,
            props.destLng,
            stopToDestPolyline,
            600, // 幅
            200 // 高さ
          )
        : generateStaticMapWithDirectionsUrl(
            Number(
              props.destinationStop.stop_lat ?? props.destinationStop.lat ?? 0
            ),
            Number(
              props.destinationStop.stop_lon ?? props.destinationStop.lng ?? 0
            ),
            props.destLat,
            props.destLng,
            600, // 幅
            200 // 高さ
          )
      : null;

  // ルートが見つからない場合のレンダリング
  if (props.type === "none") {
    return (
      <div className="bg-white space-y-4">
        <div className="text-center">
          <p className="mt-2 text-lg">{formattedDate}</p>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold">ルートが見つかりません</h3>
          <p>この2つの地点を結ぶルートが見つかりませんでした</p>
          <p>別の交通手段をご検討ください</p>
        </div>
        <div className="text-center text-xs space-y-2">
          <img
            src="/chiyoda_line_qr.png"
            alt="千代田区公式LINE"
            className="w-24 h-24 mx-auto"
          />
          <p>千代田区公式LINEで最新の運行情報を確認できます</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white space-y-4 p-8 px-32">
      <div className="text-center">
        <p className="mt-2 text-lg">{formattedDate}</p>
      </div>

      {/* 出発地から停留所への地図 */}
      {originToStopMapUrl && (
        <div className="map-container mx-auto" style={{ maxWidth: "600px" }}>
          <img
            src={originToStopMapUrl}
            alt={`出発地から${props.originStop.stopName}までの経路`}
            className="w-full rounded shadow-sm border border-gray-200"
            style={{ height: "200px", objectFit: "cover" }}
          />
        </div>
      )}

      {props.routes.map((route, index) => {
        // 各ルートの時刻を計算
        const departureTime =
          route.departureTime ||
          getDepartureTime(props.originStop.stopId, route.routeId || "");
        const firstSegmentDuration = props.type === "direct" ? 45 : 30;
        const arrivalTime =
          route.arrivalTime ||
          getArrivalTime(departureTime, firstSegmentDuration);

        const hasTransfers = route.transfers && route.transfers.length > 0;
        const destinationName =
          hasTransfers && route.transfers?.[0]
            ? route.transfers[0].transferStop.stopName
            : props.destinationStop.stopName;

        return (
          <div key={route.routeId} className="space-y-4">
            {/* 最初のセグメント */}
            <div className="card bg-base-100 shadow-sm mb-4 border-l-4 border-gray-400">
              <div className="card-body p-4">
                {/* 出発バス停と時刻 */}
                <div className="flex justify-between items-center mb-2">
                  <div className="text-lg font-bold">
                    {props.originStop.stopName}
                  </div>
                  <div className="badge badge-outline badge-neutral text-lg p-3">
                    {formatTimeDisplay(departureTime)}
                  </div>
                </div>

                {/* ルート情報 */}
                <div className="flex items-center my-3">
                  <div className="badge badge-outline badge-neutral mr-2">
                    {route.routeShortName}
                  </div>
                  {route.routeLongName && (
                    <div className="flex-1">{route.routeLongName}</div>
                  )}
                  {route.stopCount && (
                    <div className="text-xs text-gray-500 ml-2">{`${route.stopCount}駅`}</div>
                  )}
                </div>

                {/* 到着バス停と時刻 */}
                <div className="flex justify-between items-center">
                  <div className="text-lg font-bold">{destinationName}</div>
                  <div className="badge badge-outline badge-neutral text-lg p-3">
                    {formatTimeDisplay(arrivalTime)}
                  </div>
                </div>
              </div>
            </div>

            {/* 乗換情報（ある場合） */}
            {hasTransfers && route.transfers && (
              <>
                <div className="text-center my-4">
                  <div className="inline-block bg-gray-100 px-4 py-2 rounded-full font-bold text-gray-800 border border-gray-300 shadow-sm">
                    ここで乗り換え
                  </div>
                </div>

                {route.transfers.map((transfer, tIndex) => {
                  // 乗換後の時刻を計算
                  const transferWaitTime = 15;
                  const transferDepartureTime = getArrivalTime(
                    arrivalTime,
                    transferWaitTime
                  );
                  const finalArrivalTime = getArrivalTime(
                    transferDepartureTime,
                    30
                  );

                  return (
                    <div
                      key={tIndex}
                      className="card bg-base-100 shadow-sm mb-4 border-l-4 border-gray-400"
                    >
                      <div className="card-body p-4">
                        {/* 乗換駅出発時刻 */}
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-lg font-bold">
                            {transfer.transferStop.stopName}
                          </div>
                          <div className="badge badge-outline badge-neutral text-lg p-3">
                            {formatTimeDisplay(
                              transfer.nextRoute.departureTime ||
                                transferDepartureTime
                            )}
                          </div>
                        </div>

                        {/* 次のルート情報 */}
                        <div className="flex items-center my-3">
                          <div className="badge badge-outline badge-neutral mr-2">
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
                          <div className="text-lg font-bold">
                            {props.destinationStop.stopName}
                          </div>
                          <div className="badge badge-outline badge-neutral text-lg p-3">
                            {formatTimeDisplay(
                              transfer.nextRoute.arrivalTime || finalArrivalTime
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

      {/* 停留所から目的地への地図 */}
      {stopToDestMapUrl && (
        <div className="map-container mx-auto" style={{ maxWidth: "600px" }}>
          <img
            src={stopToDestMapUrl}
            alt={`${props.destinationStop.stopName}から目的地までの経路`}
            className="w-full rounded shadow-sm border border-gray-200"
            style={{ height: "200px", objectFit: "cover" }}
          />
        </div>
      )}

      <div className="text-center text-xs space-y-2">
        <img
          src="/chiyoda_line_qr.png"
          alt="千代田区公式LINE"
          className="w-24 h-24 mx-auto"
        />
        <p>千代田区公式LINEで最新の運行情報を確認できます</p>
      </div>
    </div>
  );
};

// PDF出力機能を提供するメインコンポーネント
const RoutePdfExport: React.FC<RoutePdfExportProps> = (props) => {
  const componentRef = useRef<HTMLDivElement>(null);

  // PDF出力処理
  const handlePrint = useReactToPrint({
    documentTitle: `乗換案内_${props.originStop.stopName}_${props.destinationStop.stopName}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 10mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-content .card {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        /* ヘッダー・フッターを非表示 */
        @page { margin: 0; }
        html { margin: 0; }
        /* about:srcdoc を非表示 */
        .header, .footer, head { display: none !important; }
      }
    `,
    onPrintError: (errorLocation, error) => {
      logger.log("PDF出力エラー:", errorLocation, error);
    },
    // @ts-ignore - contentRefはreact-to-printの最新バージョンで使用される正しいプロパティ
    contentRef: componentRef,
  });

  return (
    <>
      <button
        onClick={() => handlePrint()}
        className="btn btn-primary mt-4 flex items-center"
        aria-label="PDF出力"
      >
        だれかのために印刷する
      </button>

      {/* 印刷用コンテンツ（非表示） */}
      <div style={{ display: "none" }}>
        <div ref={componentRef}>
          <RoutePdfContent {...props} />
        </div>
      </div>
    </>
  );
};

export default RoutePdfExport;
