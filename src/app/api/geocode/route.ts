import { NextRequest, NextResponse } from "next/server";
import { Client } from "@googlemaps/google-maps-services-js";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "住所パラメータが必要です" },
        { status: 400 }
      );
    }

    // Google Maps Clientの初期化
    const client = new Client({});

    // Google Maps Geocoding APIへのリクエスト
    const response = await client.geocode({
      params: {
        address: address,
        key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        language: "ja",
        region: "jp",
      },
      timeout: 5000, // 5秒タイムアウト
    });

    if (response.data.status !== "OK") {
      console.error("Geocoding API error:", response.data.status);
      return NextResponse.json(
        { error: `ジオコーディングに失敗しました: ${response.data.status}` },
        { status: 400 }
      );
    }

    if (response.data.results.length === 0) {
      return NextResponse.json(
        { error: "指定された住所が見つかりませんでした" },
        { status: 404 }
      );
    }

    const result = response.data.results[0];
    const location = {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      address: result.formatted_address,
    };

    return NextResponse.json({ location });
  } catch (error) {
    console.error("Geocoding error:", error);
    return NextResponse.json(
      { error: "ジオコーディング処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
