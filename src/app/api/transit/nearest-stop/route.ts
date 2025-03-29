import { NextResponse } from "next/server";
import { TransitManager } from "../../../../lib/db/transit-manager";

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

    // TransitManagerのインスタンスを取得
    const transitManager = TransitManager.getInstance();

    // まずGTFSデータの準備を確認
    const prepareResult = await transitManager.prepareGTFSData();
    if (!prepareResult.success) {
      return NextResponse.json(
        { error: "データの準備に失敗しました" },
        { status: 500 }
      );
    }

    // 最寄りのバス停を取得
    const result = await transitManager.getNearestStops(lat, lng);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("最寄りバス停検索エラー:", error);
    return NextResponse.json(
      { error: "バス停の検索中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
