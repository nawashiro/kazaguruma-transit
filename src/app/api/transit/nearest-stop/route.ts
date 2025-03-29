import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getStops, openDb, closeDb } from "gtfs";
import { Stop } from "../../../../types/transit";

// configファイルのパス
const CONFIG_PATH = path.join(process.cwd(), "transit-config.json");

// ヘルシン距離計算関数（2点間の距離をキロメートル単位で計算）
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 地球の半径（キロメートル）
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 角度をラジアンに変換
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// GTFSのストップ型定義
interface GTFSStop {
  stop_id: string;
  stop_name: string;
  stop_code?: string;
  stop_lat: string;
  stop_lon: string;
  [key: string]: any;
}

// 距離計算のためのストップ拡張型
interface StopWithDistance extends GTFSStop {
  distance: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "緯度・経度が正しく指定されていません" },
        { status: 400 }
      );
    }

    // データベース接続設定
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    const db = openDb(config);

    try {
      // GTFSからすべてのバス停を取得（any型を使用して型エラーを回避）
      const stopsFromGTFS = (await getStops()) as any[];

      if (!stopsFromGTFS || stopsFromGTFS.length === 0) {
        return NextResponse.json(
          { stops: [], nearestStop: null },
          { status: 200 }
        );
      }

      // バス停の座標が正しいかチェックして、距離を計算
      const stopsWithDistance: StopWithDistance[] = stopsFromGTFS
        .filter(
          (stop) =>
            stop.stop_lat !== undefined &&
            stop.stop_lon !== undefined &&
            !isNaN(parseFloat(stop.stop_lat)) &&
            !isNaN(parseFloat(stop.stop_lon))
        )
        .map((stop) => {
          const stopLat = parseFloat(stop.stop_lat);
          const stopLon = parseFloat(stop.stop_lon);
          const distance = calculateDistance(lat, lng, stopLat, stopLon);
          return { ...stop, distance };
        });

      // 距離でソート
      stopsWithDistance.sort((a, b) => a.distance - b.distance);

      // フロントエンド用のStop型に変換
      const stops: Stop[] = stopsWithDistance.map((stop) => ({
        id: stop.stop_id,
        name: stop.stop_name || "名称不明",
        code: stop.stop_code || undefined,
      }));

      // 最寄りのバス停（距離が最も近いもの）
      const nearestStop =
        stopsWithDistance.length > 0 ? stopsWithDistance[0] : null;

      console.log("API: 最寄りバス停を返します:", nearestStop);
      // フロントエンドで使いやすい形式に変換
      const responseData = {
        stops,
        nearestStop: nearestStop
          ? {
              stop_id: nearestStop.stop_id,
              stop_name: nearestStop.stop_name,
              stop_code: nearestStop.stop_code,
              stop_lat: nearestStop.stop_lat,
              stop_lon: nearestStop.stop_lon,
              distance: nearestStop.distance,
            }
          : null,
      };

      return NextResponse.json(responseData, { status: 200 });
    } finally {
      // データベース接続を閉じる
      closeDb(db);
    }
  } catch (error) {
    console.error("最寄りバス停検索エラー:", error);
    return NextResponse.json(
      { error: "バス停の検索中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
