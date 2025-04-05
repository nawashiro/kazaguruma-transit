import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  TravelMode,
  Language,
} from "@googlemaps/google-maps-services-js";
import { appRouterRateLimitMiddleware } from "../../../lib/api/rate-limit-middleware";
import { logger } from "../../../utils/logger";

export interface DirectionsResponse {
  success: boolean;
  encodedPolyline?: string;
  error?: string;
  limitExceeded?: boolean;
}

export async function GET(req: NextRequest) {
  try {
    // レート制限を適用
    const limitResponse = await appRouterRateLimitMiddleware(req);
    if (limitResponse) {
      return limitResponse;
    }

    const { searchParams } = new URL(req.url);
    const startLat = parseFloat(searchParams.get("startLat") || "");
    const startLng = parseFloat(searchParams.get("startLng") || "");
    const endLat = parseFloat(searchParams.get("endLat") || "");
    const endLng = parseFloat(searchParams.get("endLng") || "");

    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      return NextResponse.json(
        {
          success: false,
          error: "有効な座標パラメータが必要です",
        } as DirectionsResponse,
        { status: 400 }
      );
    }

    // Google Maps Clientの初期化
    const client = new Client({});

    // Google Maps Directions APIへのリクエスト
    const response = await client.directions({
      params: {
        origin: `${startLat},${startLng}`,
        destination: `${endLat},${endLng}`,
        mode: TravelMode.walking, // 徒歩モード
        key:
          process.env.GOOGLE_MAPS_API_KEY ||
          process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
          "",
        language: Language.ja,
        region: "jp",
      },
      timeout: 5000, // 5秒タイムアウト
    });

    if (response.data.status !== "OK") {
      logger.error("Directions API error:", response.data.status);
      return NextResponse.json(
        {
          success: false,
          error: `経路検索に失敗しました: ${response.data.status}`,
        } as DirectionsResponse,
        { status: 400 }
      );
    }

    if (response.data.routes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "指定された地点間の経路が見つかりませんでした",
        } as DirectionsResponse,
        { status: 404 }
      );
    }

    // 最初の経路からエンコードされたポリラインを取得
    const encodedPolyline = response.data.routes[0].overview_polyline.points;

    return NextResponse.json({
      success: true,
      encodedPolyline,
    });
  } catch (error) {
    logger.error("Directions API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "経路検索処理中にエラーが発生しました",
      } as DirectionsResponse,
      { status: 500 }
    );
  }
}
