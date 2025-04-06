import { NextRequest, NextResponse } from "next/server";
import { appRouterRateLimitMiddleware } from "../../../../lib/api/rate-limit-middleware";
import { getSessionData } from "../../../../lib/auth/session";
import { logger } from "../../../../utils/logger";

export interface StaticMapResponse {
  success: boolean;
  url?: string;
  error?: string;
  limitExceeded?: boolean;
}

export async function GET(req: NextRequest) {
  try {
    // セッションから認証・支援者情報を取得
    const session = await getSessionData(req);

    // 非支援者の場合はレート制限を適用
    if (!session.isLoggedIn || !session.isSupporter) {
      const limitResponse = await appRouterRateLimitMiddleware(req);
      if (limitResponse) {
        return limitResponse;
      }
    }

    const { searchParams } = new URL(req.url);
    const startLat = parseFloat(searchParams.get("startLat") || "");
    const startLng = parseFloat(searchParams.get("startLng") || "");
    const endLat = parseFloat(searchParams.get("endLat") || "");
    const endLng = parseFloat(searchParams.get("endLng") || "");
    const width = parseInt(searchParams.get("width") || "600");
    const height = parseInt(searchParams.get("height") || "200");
    const encodedPolyline = searchParams.get("polyline") || null;

    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      return NextResponse.json(
        {
          success: false,
          error: "有効な座標パラメータが必要です",
        } as StaticMapResponse,
        { status: 400 }
      );
    }

    // APIキー取得（サーバーサイドのみ）
    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      "";
    if (!apiKey) {
      logger.error("Google Maps API key is missing");
      return NextResponse.json(
        {
          success: false,
          error: "APIキーが設定されていません",
        } as StaticMapResponse,
        { status: 500 }
      );
    }

    // マーカーパラメータ (始点と終点にマーカーを表示、グレースケールに合わせた色)
    const markers = [
      `color:gray|label:S|${startLat},${startLng}`,
      `color:black|label:E|${endLat},${endLng}`,
    ];

    // URLを構築
    let urlString = "https://maps.googleapis.com/maps/api/staticmap";
    urlString += `?size=${width}x${height}`;

    // ポリラインがある場合はそれを使用、なければ直線を描画
    if (encodedPolyline) {
      urlString += `&path=weight:5|color:0x000000|enc:${encodeURIComponent(
        encodedPolyline
      )}`;
    } else {
      urlString += `&path=weight:5|color:0x000000|${startLat},${startLng}|${endLat},${endLng}`;
    }

    // マーカーを追加
    markers.forEach((marker) => {
      urlString += `&markers=${encodeURIComponent(marker)}`;
    });

    // 地図をグレースケールにする
    urlString += `&style=feature:all|element:all|saturation:-100`;

    // APIキーとスケールを追加
    urlString += `&key=${apiKey}`;
    urlString += `&scale=2`; // 高解像度画像のためのスケール

    return NextResponse.json({
      success: true,
      url: urlString,
    });
  } catch (error) {
    logger.error("Static Map API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "静的地図URL生成中にエラーが発生しました",
      } as StaticMapResponse,
      { status: 500 }
    );
  }
}
