"use client";

import React, { useState } from "react";
import { logger } from "../utils/logger";
import { Departure } from "../types/transit";

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

// PDF出力機能を提供するメインコンポーネント
const RoutePdfExport: React.FC<RoutePdfExportProps> = (props) => {
  const [error, setError] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // サーバーサイドPDF生成APIを呼び出す関数
  const handleGeneratePdf = async () => {
    try {
      setPdfLoading(true);
      setPdfGenerating(true);
      setPdfError(null);

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
        } catch {
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
        </div>
        <button onClick={() => setPdfError(null)} className="btn btn-sm">
          閉じる
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleGeneratePdf}
        className="btn btn-primary mt-4 flex items-center"
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
        {pdfGenerating || pdfLoading ? (
          <p className="ruby-text">生成中...</p>
        ) : (
          <p className="ruby-text">印刷する</p>
        )}
      </button>
    </>
  );
};

export default RoutePdfExport;
