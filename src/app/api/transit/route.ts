import { NextResponse, NextRequest } from "next/server";
import { TransitManager } from "../../../lib/db/transit-manager";

// GET: /api/transit
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    const transitManager = TransitManager.getInstance();

    // まずGTFSデータの準備を確認
    const prepareResult = await transitManager.prepareGTFSData();
    if (!prepareResult.success) {
      return NextResponse.json(
        { error: "データの準備に失敗しました" },
        { status: 500 }
      );
    }

    // 要求されたアクションによって処理を分岐
    switch (action) {
      case "getStops":
        return await getStopsResponse(transitManager);
      case "getRoutes":
        return await getRoutesResponse(transitManager);
      case "getDepartures":
        const stopId = searchParams.get("stopId");
        const routeId = searchParams.get("routeId");
        if (!stopId) {
          return NextResponse.json(
            { error: "バス停IDが指定されていません" },
            { status: 400 }
          );
        }
        return await getDeparturesResponse(
          transitManager,
          stopId,
          routeId || undefined
        );
      case "getMetadata":
        return await getMetadataResponse();
      default:
        return NextResponse.json(
          { error: "無効なアクションです" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("トランジットAPIエラー:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// すべてのバス停を取得する
async function getStopsResponse(
  transitManager: TransitManager
): Promise<NextResponse> {
  try {
    const stops = await transitManager.getStops();
    return NextResponse.json({ stops }, { status: 200 });
  } catch (error) {
    console.error("バス停データの取得に失敗しました:", error);
    return NextResponse.json(
      { error: "バス停データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// すべての路線を取得する
async function getRoutesResponse(
  transitManager: TransitManager
): Promise<NextResponse> {
  try {
    const routes = await transitManager.getRoutes();
    return NextResponse.json({ routes }, { status: 200 });
  } catch (error) {
    console.error("路線データの取得に失敗しました:", error);
    return NextResponse.json(
      { error: "路線データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 指定されたバス停の出発時刻を取得する
async function getDeparturesResponse(
  transitManager: TransitManager,
  stopId: string,
  routeId?: string
): Promise<NextResponse> {
  try {
    const departures = await transitManager.getDepartures(stopId, routeId);

    return NextResponse.json({ departures }, { status: 200 });
  } catch (error) {
    console.error("出発時刻データの取得に失敗しました:", error);
    return NextResponse.json(
      { error: "出発時刻データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// API情報のメタデータを取得する
async function getMetadataResponse(): Promise<NextResponse> {
  try {
    // GTFSデータのバージョン情報やその他メタデータを返す
    return NextResponse.json(
      {
        version: "1.0.0",
        source: "GTFS Static",
        lastUpdated: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("メタデータの取得に失敗しました:", error);
    return NextResponse.json(
      { error: "メタデータの取得に失敗しました" },
      { status: 500 }
    );
  }
}
