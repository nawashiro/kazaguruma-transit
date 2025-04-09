"use client";

import React, { useRef, useState, useEffect } from "react";
import { logger } from "../utils/logger";
import { Departure } from "../types/transit";
import Link from "next/link";
import {
  generateStaticMapWithDirectionsUrl,
  generateStaticMapWithPolylineUrl,
  getDirectionsPolyline,
} from "../utils/maps";

// 環境変数からKo-fiのTierページURLを取得、なければデフォルト値を使用
const KOFI_TIER_PAGE_URL =
  process.env.KOFI_TIER_PAGE_URL || "https://ko-fi.com/nawashiro/tiers";

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
  selectedDateTime?: string;
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
  const [originToStopMapUrl, setOriginToStopMapUrl] = useState<string | null>(
    null
  );
  const [stopToDestMapUrl, setStopToDestMapUrl] = useState<string | null>(null);

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

  // 地図画像URLを取得
  useEffect(() => {
    const fetchMaps = async () => {
      // 出発地→バス停の地図URL取得
      if (
        props.originLat &&
        props.originLng &&
        (props.originStop.stop_lat !== undefined ||
          props.originStop.lat !== undefined) &&
        (props.originStop.stop_lon !== undefined ||
          props.originStop.lng !== undefined)
      ) {
        try {
          const url = originToStopPolyline
            ? await generateStaticMapWithPolylineUrl(
                props.originLat,
                props.originLng,
                Number(props.originStop.stop_lat ?? props.originStop.lat ?? 0),
                Number(props.originStop.stop_lon ?? props.originStop.lng ?? 0),
                originToStopPolyline,
                600, // 幅
                200 // 高さ
              )
            : await generateStaticMapWithDirectionsUrl(
                props.originLat,
                props.originLng,
                Number(props.originStop.stop_lat ?? props.originStop.lat ?? 0),
                Number(props.originStop.stop_lon ?? props.originStop.lng ?? 0),
                600, // 幅
                200 // 高さ
              );

          setOriginToStopMapUrl(url);
        } catch (error) {
          logger.error("地図URL取得エラー (出発地→バス停):", error);
        }
      }

      // バス停→目的地の地図URL取得
      if (
        props.destLat &&
        props.destLng &&
        (props.destinationStop.stop_lat !== undefined ||
          props.destinationStop.lat !== undefined) &&
        (props.destinationStop.stop_lon !== undefined ||
          props.destinationStop.lng !== undefined)
      ) {
        try {
          const url = stopToDestPolyline
            ? await generateStaticMapWithPolylineUrl(
                Number(
                  props.destinationStop.stop_lat ??
                    props.destinationStop.lat ??
                    0
                ),
                Number(
                  props.destinationStop.stop_lon ??
                    props.destinationStop.lng ??
                    0
                ),
                props.destLat,
                props.destLng,
                stopToDestPolyline,
                600, // 幅
                200 // 高さ
              )
            : await generateStaticMapWithDirectionsUrl(
                Number(
                  props.destinationStop.stop_lat ??
                    props.destinationStop.lat ??
                    0
                ),
                Number(
                  props.destinationStop.stop_lon ??
                    props.destinationStop.lng ??
                    0
                ),
                props.destLat,
                props.destLng,
                600, // 幅
                200 // 高さ
              );

          setStopToDestMapUrl(url);
        } catch (error) {
          logger.error("地図URL取得エラー (バス停→目的地):", error);
        }
      }
    };

    fetchMaps();
  }, [
    props.originLat,
    props.originLng,
    props.destLat,
    props.destLng,
    props.originStop,
    props.destinationStop,
    originToStopPolyline,
    stopToDestPolyline,
  ]);

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
    <div data-testid="pdf-content" className="bg-white space-y-4 p-8 px-24">
      <div className="text-center">
        <p className="mt-2 text-lg">{formattedDate}</p>
        <h1 className="text-2xl font-bold mt-4">乗換案内</h1>
        <p className="mt-2">
          {props.originStop.stopName} → {props.destinationStop.stopName}
        </p>
        {props.routes.map((route, index) => (
          <div key={index} className="mt-4">
            <p className="font-bold">{route.routeShortName}</p>
            <p>{route.routeName}</p>
          </div>
        ))}
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
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isSupporter, setIsSupporter] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [pdfErrorDetails, setPdfErrorDetails] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // サーバーサイドAPIを使用してPDF出力権限を確認
  useEffect(() => {
    const checkPermission = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/pdf/check-permission");

        if (!response.ok) {
          throw new Error("権限確認APIエラー");
        }

        const data = await response.json();

        if (data.success) {
          setIsLoggedIn(data.isLoggedIn);
          setIsSupporter(data.isSupporter);
        } else {
          setIsLoggedIn(false);
          setIsSupporter(false);
          setError(data.error || "権限確認に失敗しました");
        }
      } catch (error) {
        logger.error("PDF権限確認エラー:", error);
        setIsLoggedIn(false);
        setIsSupporter(false);
        setError("権限確認中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    checkPermission();

    // ログイン状態変更イベントのリスナーを追加
    const handleAuthCompleted = () => {
      checkPermission();
    };

    window.addEventListener("auth-completed", handleAuthCompleted);
    return () => {
      window.removeEventListener("auth-completed", handleAuthCompleted);
    };
  }, []);

  // サーバーサイドPDF生成APIを呼び出す関数
  const handleGeneratePdf = async () => {
    try {
      setPdfLoading(true);
      setPdfGenerating(true);
      setPdfError(null);
      setPdfErrorDetails(null);

      if (!props.routes || props.routes.length === 0) {
        throw new Error("有効な経路情報がありません");
      }

      // PDFデータを作成するAPIを呼び出す
      logger.log("PDF生成APIを呼び出します");
      const response = await fetch("/api/pdf/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originStop: props.originStop,
          destinationStop: props.destinationStop,
          routes: props.routes,
          type: props.type,
          transfers: props.transfers,
          originLat: props.originLat,
          originLng: props.originLng,
          destLat: props.destLat,
          destLng: props.destLng,
          selectedDateTime: props.selectedDateTime,
        }),
      });

      if (!response.ok) {
        // エラーレスポンスのJSONを取得
        try {
          const errorData = await response.json();
          logger.error("PDF生成エラー:", errorData);
          setPdfError(errorData.error || "PDF生成に失敗しました");
          setPdfErrorDetails(errorData.details || null);
        } catch (jsonError) {
          // JSONとしてパースできない場合はステータステキストを使用
          setPdfError(`PDF生成に失敗しました (${response.status})`);
        }
        return;
      }

      // レスポンスがPDFの場合、blobとして取得しダウンロード
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // ダウンロードリンクを作成して自動クリック
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `乗換案内_${props.originStop.stopName}_${props.destinationStop.stopName}.pdf`;
      document.body.appendChild(a);
      a.click();

      // クリーンアップ
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      logger.error("PDF生成エラー:", error);
      setPdfError(
        error instanceof Error
          ? error.message
          : "PDF生成中にエラーが発生しました"
      );
    } finally {
      setPdfLoading(false);
      setPdfGenerating(false);
    }
  };

  // サポーターモーダルを開く処理
  const handleOpenSupporterModal = () => {
    const event = new CustomEvent("open-supporter-modal");
    window.dispatchEvent(event);
  };

  if (loading) {
    return (
      <button className="btn btn-primary mt-4 opacity-75" disabled>
        <span className="loading loading-spinner loading-xs mr-2"></span>
        読み込み中...
      </button>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error mt-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{error}</span>
        <button onClick={() => setError(null)} className="btn btn-sm">
          閉じる
        </button>
      </div>
    );
  }

  // PDF生成中のエラー表示
  if (pdfError) {
    return (
      <div className="alert alert-error mt-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1">
          <div className="font-bold">PDF生成エラー</div>
          <div>{pdfError}</div>
          {pdfErrorDetails && showErrorDetails && (
            <div className="text-xs mt-2 border-t pt-2">{pdfErrorDetails}</div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {pdfErrorDetails && (
            <button
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              className="btn btn-xs btn-ghost"
            >
              {showErrorDetails ? "詳細を隠す" : "詳細を表示"}
            </button>
          )}
          <button onClick={() => setPdfError(null)} className="btn btn-sm">
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "none" }}>
        <div ref={pdfRef}>
          <RoutePdfContent {...props} />
        </div>
      </div>
      {isLoggedIn && isSupporter ? (
        // 支援者の場合はPDF出力ボタンを表示
        <button
          onClick={handleGeneratePdf}
          className="btn btn-primary mt-4 flex items-center"
          aria-label="PDF出力"
          disabled={pdfGenerating || pdfLoading}
        >
          {pdfGenerating || pdfLoading ? (
            <span className="loading loading-spinner loading-xs mr-2"></span>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
          {pdfGenerating || pdfLoading ? "生成中..." : "印刷する"}
        </button>
      ) : (
        // 非ログインユーザーの場合はKo-fiへのリンクを表示
        <div className="flex flex-col sm:flex-row items-center gap-2 mt-4">
          <Link
            href={KOFI_TIER_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary flex items-center"
            aria-label="支援者限定機能"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            印刷する（支援者限定）
          </Link>

          <button onClick={handleOpenSupporterModal} className="btn btn-accent">
            私は支援者です
          </button>
        </div>
      )}
    </>
  );
};

export default RoutePdfExport;
