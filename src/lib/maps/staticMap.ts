"use server";

import { logger } from "../../utils/logger";

/**
 * Static Mapの応答形式
 */
export interface StaticMapResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * 静的地図URLを生成する
 * サーバーコンポーネントとして実装
 * APIエンドポイントではなくサーバーアクションとして実装
 */
export async function generateStaticMapUrl(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  width: number = 600,
  height: number = 200,
  encodedPolyline: string | null = null,
  style: string | null = "monochrome"
): Promise<StaticMapResult> {
  try {
    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      return {
        success: false,
        error: "有効な座標パラメータが必要です",
      };
    }

    // APIキー取得（サーバーサイドのみ）
    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      "";
    if (!apiKey) {
      logger.error("Google Maps API key is missing");
      return {
        success: false,
        error: "APIキーが設定されていません",
      };
    }

    // マーカーパラメータ (始点と終点にマーカーを表示、グレースケールに合わせた色)
    const markers = [
      `color:gray|label:S|${startLat},${startLng}`,
      `color:black|label:E|${endLat},${endLng}`,
    ];

    // URLを構築
    let urlString = "https://maps.googleapis.com/maps/api/staticmap";
    urlString += `?size=${width}x${height}`;

    // 徒歩経路をリクエスト
    if (encodedPolyline) {
      urlString += `&path=weight:5|color:0x000000|enc:${encodeURIComponent(
        encodedPolyline
      )}`;
    } else {
      // DirectionsAPIがポリラインを提供していない場合は直線を代替として使用
      urlString += `&path=weight:5|color:0x000000|${startLat},${startLng}|${endLat},${endLng}`;
    }

    // マーカーを追加
    markers.forEach((marker) => {
      urlString += `&markers=${encodeURIComponent(marker)}`;
    });

    // スタイルを適用
    if (style === "monochrome") {
      // モノクロスタイル (詳細な調整でより高コントラストに)
      urlString += `&style=feature:all|element:geometry|saturation:-100|lightness:20`;
      urlString += `&style=feature:all|element:labels|visibility:on|saturation:-100`;
      urlString += `&style=feature:road|element:all|saturation:-100|lightness:40`;
      urlString += `&style=feature:water|element:all|saturation:-100|lightness:-10`;
    }

    // APIキーとスケールを追加
    urlString += `&key=${apiKey}`;
    urlString += `&language=ja`; // 日本語を指定
    urlString += `&region=jp`; // 日本地域を指定

    return {
      success: true,
      url: urlString,
    };
  } catch (error) {
    logger.error("Static Map generator error:", error);
    return {
      success: false,
      error: "静的地図URL生成中にエラーが発生しました",
    };
  }
}
