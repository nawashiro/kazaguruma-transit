"use client";

import React, { useState } from "react";
import { logger } from "@/utils/logger";
import { Departure } from "@/types/core";
import type { PostWithStats } from "@/types/discussion";
import Button from "@/components/ui/Button";
import { FiDownload } from "react-icons/fi";

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
  memoData?: Map<string, PostWithStats>;
}

// PDF出力機能を提供するメインコンポーネント
const RoutePdfExport: React.FC<RoutePdfExportProps> = (props) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // サーバーサイドPDF生成APIを呼び出す関数
  const handleGeneratePdf = async () => {
    try {
      setIsGenerating(true);
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
          memoData: props.memoData ? Object.fromEntries(props.memoData) : undefined,
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
      setIsGenerating(false);
    }
  };

  // PDF生成中のエラー表示
  if (pdfError) {
    return (
      <div className="alert alert-error mt-4">
        <div className="flex-1">
          <div className="font-bold">PDF生成エラー</div>
          <div>{pdfError}</div>
        </div>
        <Button type="button" secondary onClick={() => setPdfError(null)}>
          閉じる
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={handleGeneratePdf}
        className="mt-4"
        disabled={isGenerating}
        loading={isGenerating}
      >
        {!isGenerating && <FiDownload className="h-5 w-5" aria-hidden="true" />}
        <span>
          {isGenerating ? (
            "生成中..."
          ) : (
            "印刷する"
          )}
        </span>
      </Button>
    </>
  );
};

export default RoutePdfExport;
