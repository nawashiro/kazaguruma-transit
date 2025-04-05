"use client";

import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { logger } from "../utils/logger";
import { Departure } from "../types/transit";
import IntegratedRouteDisplay from "./IntegratedRouteDisplay";

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
  // 現在の日付を取得
  const today = new Date();
  const formattedDate = `${today.getFullYear()}年${
    today.getMonth() + 1
  }月${today.getDate()}日`;

  return (
    <div className="print-content">
      <div className="text-center my-4">
        <h1 className="text-3xl font-bold text-primary">乗り換え案内</h1>
        <p className="mt-2 text-lg">{formattedDate}</p>
      </div>

      {/* 画面表示と同じコンポーネントを使用 */}
      <div className="print-content">
        <IntegratedRouteDisplay {...props} />
      </div>

      <div className="card bg-base-200/70 shadow-md mt-6">
        <div className="card-body text-center text-xs">
          <p>千代田区福祉交通「風ぐるま」乗り換え案内</p>
          <p>
            ※この案内は参考情報です。実際の運行状況は各事業者にご確認ください。
          </p>
          <p>
            <a
              href="https://lin.ee/CgIBOSd"
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary"
            >
              千代田区公式LINE
            </a>
            で最新の運行情報を確認できます
          </p>
        </div>
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
      }
    `,
    onPrintError: (errorLocation, error) => {
      logger.log("PDF出力エラー:", errorLocation, error);
    },
    // @ts-ignore - contentRefはreact-to-printの最新バージョンで使用される正しいプロパティ
    contentRef: componentRef,
  });

  return (
    <div>
      {/* PDF出力ボタン */}
      <button
        onClick={() => handlePrint()}
        className="btn btn-primary mt-4 flex items-center"
        aria-label="PDF出力"
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
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        PDF出力 (A4)
      </button>

      {/* 印刷用コンテンツ（非表示） */}
      <div style={{ display: "none" }}>
        <div ref={componentRef}>
          <RoutePdfContent {...props} />
        </div>
      </div>
    </div>
  );
};

export default RoutePdfExport;
