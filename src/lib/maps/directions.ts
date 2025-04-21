"use server";

import {
  Client,
  TravelMode,
  Language,
} from "@googlemaps/google-maps-services-js";
import { logger } from "../../utils/logger";

/**
 * Directions APIのレスポンス型
 */
export interface DirectionsResult {
  success: boolean;
  encodedPolyline?: string;
  error?: string;
}

/**
 * Google Maps Directions APIを使用して2点間の経路のポリラインを取得する
 * サーバーコンポーネントとして実装
 */
export async function getDirectionsPolyline(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<DirectionsResult> {
  try {
    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      return {
        success: false,
        error: "有効な座標パラメータが必要です",
      };
    }

    // Google Maps Clientの初期化
    const client = new Client({});

    // Google Maps Directions APIへのリクエスト
    const response = await client.directions({
      params: {
        origin: `${startLat},${startLng}`,
        destination: `${endLat},${endLng}`,
        mode: TravelMode.walking, // 徒歩モード
        key: process.env.GOOGLE_MAPS_API_KEY || "",
        language: Language.ja,
        region: "jp",
      },
      timeout: 5000, // 5秒タイムアウト
    });

    if (response.data.status !== "OK") {
      logger.error("Directions API error:", response.data.status);
      return {
        success: false,
        error: `経路検索に失敗しました: ${response.data.status}`,
      };
    }

    if (response.data.routes.length === 0) {
      return {
        success: false,
        error: "指定された地点間の経路が見つかりませんでした",
      };
    }

    // 最初の経路からエンコードされたポリラインを取得
    const encodedPolyline = response.data.routes[0].overview_polyline.points;

    return {
      success: true,
      encodedPolyline,
    };
  } catch (error) {
    logger.error("Directions API error:", error);
    return {
      success: false,
      error: "経路検索処理中にエラーが発生しました",
    };
  }
}
