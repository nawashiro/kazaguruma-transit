import { NextRequest, NextResponse } from "next/server";
import { Client } from "@googlemaps/google-maps-services-js";
import { appRouterRateLimitMiddleware } from "../../../lib/api/rate-limit-middleware";
import { logger } from "../../../utils/logger";

export interface GeocodeResponse {
  success: boolean;
  data?: {
    location: {
      lat: number;
      lng: number;
      address: string;
    };
  };
  error?: string;
  limitExceeded?: boolean;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export async function GET(req: NextRequest) {
  try {
    // レート制限を適用
    const limitResponse = await appRouterRateLimitMiddleware(req);
    if (limitResponse) {
      return limitResponse;
    }

    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: "住所パラメータが必要です",
        } as GeocodeResponse,
        { status: 400 }
      );
    }

    // Google Maps Clientの初期化
    const client = new Client({});

    // Google Maps Geocoding APIへのリクエスト
    const response = await client.geocode({
      params: {
        address: address,
        key: process.env.GOOGLE_MAPS_API_KEY || "",
        language: "ja",
        region: "jp",
      },
      timeout: 5000, // 5秒タイムアウト
    });

    if (response.data.status !== "OK") {
      logger.error("Geocoding API error:", response.data.status);
      return NextResponse.json(
        {
          success: false,
          error: `ジオコーディングに失敗しました: ${response.data.status}`,
        } as GeocodeResponse,
        { status: 400 }
      );
    }

    if (response.data.results.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "指定された住所が見つかりませんでした",
        } as GeocodeResponse,
        { status: 404 }
      );
    }

    const results: GeocodeResult[] = response.data.results.map((result) => ({
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    }));

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    logger.error("Geocoding error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "ジオコーディング処理中にエラーが発生しました",
      } as GeocodeResponse,
      { status: 500 }
    );
  }
}
