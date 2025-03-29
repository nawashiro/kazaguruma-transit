import { NextRequest, NextResponse } from "next/server";
import {
  getStoptimes,
  getRoutes,
  getTrips,
  getStops,
  openDb,
  closeDb,
  importGtfs,
} from "gtfs";
import fs from "fs";
import path from "path";

// GTFSデータのインポート状態を追跡
let isGtfsImported = false;
// データベース接続状態を追跡
let isDbOpen = false;

// configファイルのパス
const CONFIG_PATH = path.join(process.cwd(), "transit-config.json");

// GTFSデータのインポートを確認する関数
async function ensureGtfsImported() {
  if (!isGtfsImported) {
    try {
      // configファイルが存在するか確認
      if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error("transit-config.json が見つかりません");
      }

      // 設定ファイルの内容を読み込む
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

      // データベースファイルの存在を確認
      const dbPath = path.join(process.cwd(), ".temp", "gtfs", "gtfs.db");
      const dbExists = fs.existsSync(dbPath);

      if (!dbExists) {
        console.log(
          "GTFSデータベースが見つかりません。インポートを開始します。"
        );
        await importGtfs(config);
        console.log("GTFSデータのインポートが完了しました。");
      }

      isGtfsImported = true;
    } catch (err) {
      console.error("GTFSデータインポートエラー:", err);
      throw new Error("GTFSデータのインポートに失敗しました");
    }
  }
}

// データベース接続を確保する関数
async function ensureDbConnection() {
  if (!isDbOpen) {
    try {
      await ensureGtfsImported();
      await openDb();
      isDbOpen = true;
    } catch (err) {
      console.error("データベース接続エラー:", err);
      throw new Error("GTFSデータベースへの接続に失敗しました");
    }
  }
}

// 安全にデータベース接続を閉じる
async function safeCloseDb() {
  if (isDbOpen) {
    try {
      await closeDb();
      isDbOpen = false;
    } catch (err) {
      console.error("データベース接続閉じるエラー:", err);
    }
  }
}

// 2点間の距離をハバーサイン公式で計算（km単位）
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371; // 地球の半径 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 指定された点から最も近いバス停を見つける
async function findNearestStop(lat: number, lng: number, maxDistance = 1) {
  try {
    await ensureDbConnection();

    // すべてのバス停を取得
    const stops = await getStops({});

    if (!stops || stops.length === 0) {
      return null;
    }

    // 各バス停までの距離を計算
    const stopsWithDistance = stops.map((stop) => {
      // stop_latとstop_lonがundefinedでないことを確認
      if (
        typeof stop.stop_lat === "number" &&
        typeof stop.stop_lon === "number"
      ) {
        const distance = haversineDistance(
          lat,
          lng,
          stop.stop_lat,
          stop.stop_lon
        );
        return { ...stop, distance };
      }
      // 位置情報がない場合は距離を非常に大きな値に設定して実質的に除外
      return { ...stop, distance: Number.MAX_VALUE };
    });

    // 距離順にソート
    stopsWithDistance.sort((a, b) => a.distance - b.distance);

    // 最も近いバス停を返す（ただし最大距離以内の場合のみ）
    const nearestStop = stopsWithDistance[0];
    if (nearestStop && nearestStop.distance <= maxDistance) {
      return nearestStop;
    }

    return null;
  } catch (error) {
    console.error("最寄りバス停検索エラー:", error);
    throw error;
  }
}

// 2つのバス停間の直接ルートを検索
async function findDirectRoutes(
  originStopId: string,
  destinationStopId: string
) {
  try {
    await ensureDbConnection();

    // 出発バス停を通過するすべての停車時刻を取得
    const originStoptimes = await getStoptimes({ stop_id: originStopId });

    if (originStoptimes.length === 0) {
      return [];
    }

    // トリップIDを収集
    const tripIds = originStoptimes.map((stoptime) => stoptime.trip_id);
    const trips = await getTrips({ trip_id: tripIds });

    // 同じトリップで目的地バス停も通過するものを探す
    const routeIds = new Set<string>();

    for (const trip of trips) {
      const destinationStoptimes = await getStoptimes({
        trip_id: trip.trip_id,
        stop_id: destinationStopId,
      });

      if (destinationStoptimes.length > 0) {
        // 出発と到着の順序を確認
        const originStopSequence = originStoptimes.find(
          (st) => st.trip_id === trip.trip_id
        )?.stop_sequence;

        const destStopSequence = destinationStoptimes[0].stop_sequence;

        // 出発バス停が到着バス停より前にある場合のみ有効
        if (
          originStopSequence !== undefined &&
          destStopSequence !== undefined &&
          originStopSequence < destStopSequence
        ) {
          routeIds.add(trip.route_id);
        }
      }
    }

    if (routeIds.size === 0) {
      return [];
    }

    // ルート情報を取得
    const routes = await getRoutes({
      route_id: Array.from(routeIds) as string[],
    });

    return routes.map((route) => ({
      routeId: route.route_id,
      routeName: route.route_long_name || route.route_short_name,
      routeShortName: route.route_short_name || "",
      routeLongName: route.route_long_name || "",
      routeColor: route.route_color || "",
      routeTextColor: route.route_text_color || "",
      transfers: [], // 直接ルートなのでここでは転送なし
    }));
  } catch (error) {
    console.error("直接ルート検索エラー:", error);
    throw error;
  }
}

// バス停の詳細情報を取得
async function getStopDetails(stopId: string) {
  const stops = await getStops({ stop_id: stopId });
  if (stops.length === 0) return null;

  const stop = stops[0];
  return {
    stopId: stop.stop_id,
    stopName: stop.stop_name,
    stopLat: stop.stop_lat,
    stopLon: stop.stop_lon,
  };
}

// 乗り換えを含む経路を検索
async function findRouteWithTransfers(
  originStopId: string,
  destinationStopId: string
) {
  // まず直接のルートを検索
  const directRoutes = await findDirectRoutes(originStopId, destinationStopId);

  if (directRoutes.length > 0) {
    return {
      hasRoute: true,
      routes: directRoutes,
      type: "direct",
      transfers: 0,
    };
  }

  // TODO: 乗り換えが1回の経路を検索
  // ここでは簡易的な実装として、一度すべてのルートを取得し、共通のバス停を探します
  try {
    // 出発バス停から行けるすべてのルートを取得
    const originStoptimes = await getStoptimes({ stop_id: originStopId });
    const originTripIds = originStoptimes.map((st) => st.trip_id);
    const originTrips = await getTrips({ trip_id: originTripIds });
    const originRouteIds = new Set(originTrips.map((trip) => trip.route_id));

    // 目的地バス停へ到着するすべてのルートを取得
    const destStoptimes = await getStoptimes({ stop_id: destinationStopId });
    const destTripIds = destStoptimes.map((st) => st.trip_id);
    const destTrips = await getTrips({ trip_id: destTripIds });
    const destRouteIds = new Set(destTrips.map((trip) => trip.route_id));

    // 接続点となる可能性のあるバス停を探す（出発ルートのすべての停車駅）
    const potentialTransferStops = new Set<string>();

    for (const routeId of originRouteIds) {
      const routeTrips = await getTrips({ route_id: routeId });
      const routeTripIds = routeTrips.map((trip) => trip.trip_id);

      for (const tripId of routeTripIds) {
        const tripStops = await getStoptimes({ trip_id: tripId });
        for (const stop of tripStops) {
          if (stop.stop_id) {
            // stop_idがundefinedでないことを確認
            potentialTransferStops.add(stop.stop_id);
          }
        }
      }
    }

    // 乗り換え候補バス停から目的地へ直接行けるかチェック
    const transferRoutes = [];

    for (const transferStopId of potentialTransferStops) {
      // 出発点と乗り換え点が同じ場合はスキップ
      if (transferStopId === originStopId) continue;

      // 乗り換え点と目的地が同じ場合はスキップ
      if (transferStopId === destinationStopId) continue;

      const routes = await findDirectRoutes(transferStopId, destinationStopId);

      if (routes.length > 0) {
        // 出発地から乗り換え地点へのルートを取得
        const firstLegRoutes = await findDirectRoutes(
          originStopId,
          transferStopId
        );

        if (firstLegRoutes.length > 0) {
          // 乗り換え地点の詳細を取得
          const transferStop = await getStopDetails(transferStopId);

          if (transferStop) {
            transferRoutes.push({
              firstLeg: firstLegRoutes[0],
              secondLeg: routes[0],
              transferStop,
            });
          }
        }
      }
    }

    if (transferRoutes.length > 0) {
      // 最適な乗り換えルートを選択（ここでは単純に最初のものを使用）
      const bestTransferRoute = transferRoutes[0];

      return {
        hasRoute: true,
        routes: [
          {
            ...bestTransferRoute.firstLeg,
            transfers: [
              {
                transferStop: bestTransferRoute.transferStop,
                nextRoute: bestTransferRoute.secondLeg,
              },
            ],
          },
        ],
        type: "transfer",
        transfers: 1,
      };
    }

    // ルートが見つからない場合
    return {
      hasRoute: false,
      type: "none",
      transfers: 0,
      message: "この2つの地点を結ぶルートが見つかりませんでした",
    };
  } catch (error) {
    console.error("乗り換えルート検索エラー:", error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const originLat = parseFloat(searchParams.get("originLat") || "");
    const originLng = parseFloat(searchParams.get("originLng") || "");
    const destLat = parseFloat(searchParams.get("destLat") || "");
    const destLng = parseFloat(searchParams.get("destLng") || "");

    // 入力値のバリデーション
    if (
      isNaN(originLat) ||
      isNaN(originLng) ||
      isNaN(destLat) ||
      isNaN(destLng)
    ) {
      return NextResponse.json(
        { error: "出発地と目的地の緯度経度を正しく指定してください" },
        { status: 400 }
      );
    }

    await ensureDbConnection();

    // 最寄りのバス停を見つける
    const originStop = await findNearestStop(originLat, originLng);
    const destStop = await findNearestStop(destLat, destLng);

    if (!originStop) {
      return NextResponse.json({
        hasRoute: false,
        message: "出発地の近くにバス停が見つかりませんでした（1km以内）",
      });
    }

    if (!destStop) {
      return NextResponse.json({
        hasRoute: false,
        message: "目的地の近くにバス停が見つかりませんでした（1km以内）",
      });
    }

    // 同じバス停の場合は特別なレスポンスを返す
    if (originStop.stop_id === destStop.stop_id) {
      return NextResponse.json({
        hasRoute: true,
        message: "出発地と目的地のバス停が同じです",
        originStop: {
          stopId: originStop.stop_id,
          stopName: originStop.stop_name,
          distance: originStop.distance,
          stop_lat: originStop.stop_lat,
          stop_lon: originStop.stop_lon,
        },
        destinationStop: {
          stopId: destStop.stop_id,
          stopName: destStop.stop_name,
          distance: destStop.distance,
          stop_lat: destStop.stop_lat,
          stop_lon: destStop.stop_lon,
        },
        routes: [],
      });
    }

    // ルートを検索（乗り換えを含む）
    const routeInfo = await findRouteWithTransfers(
      originStop.stop_id,
      destStop.stop_id
    );

    return NextResponse.json({
      ...routeInfo,
      originStop: {
        stopId: originStop.stop_id,
        stopName: originStop.stop_name,
        distance: originStop.distance,
        stop_lat: originStop.stop_lat,
        stop_lon: originStop.stop_lon,
      },
      destinationStop: {
        stopId: destStop.stop_id,
        stopName: destStop.stop_name,
        distance: destStop.distance,
        stop_lat: destStop.stop_lat,
        stop_lon: destStop.stop_lon,
      },
    });
  } catch (error) {
    console.error("経路検索エラー:", error);
    return NextResponse.json(
      {
        hasRoute: false,
        message:
          error instanceof Error
            ? error.message
            : "経路情報の取得に失敗しました",
      },
      { status: 500 }
    );
  } finally {
    await safeCloseDb();
  }
}
