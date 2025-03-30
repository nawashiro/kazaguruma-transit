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

      // データベースディレクトリが存在するか確認し、なければ作成
      const dbDir = path.join(process.cwd(), ".temp", "gtfs");
      if (!fs.existsSync(path.join(process.cwd(), ".temp"))) {
        fs.mkdirSync(path.join(process.cwd(), ".temp"));
        console.log("ディレクトリを作成しました: .temp");
      }
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir);
        console.log(`ディレクトリを作成しました: ${dbDir}`);
      }

      // データベースファイルの存在を確認
      const dbPath = path.join(dbDir, "gtfs.db");
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

// 2つのバス停間の直接ルートを検索（日時とisDepartureパラメータを追加）
async function findDirectRoutes(
  originStopId: string,
  destinationStopId: string,
  targetDateTime?: Date,
  isDeparture: boolean = true
) {
  try {
    await ensureDbConnection();

    // クエリパラメータの作成
    let stoptimesQuery: any = { stop_id: originStopId };

    // 日時が指定されている場合、gtfsライブラリの形式に合わせてフィルターを追加
    if (targetDateTime) {
      // 曜日を取得してGTFSの形式に変換
      const dayOfWeek = targetDateTime.getDay() + 1; // 0-6 から 1-7 に変換

      // GTFSの曜日フィールドにマッピング
      if (dayOfWeek === 7) {
        // 日曜日
        stoptimesQuery.sunday = 1;
      } else if (dayOfWeek === 6) {
        // 土曜日
        stoptimesQuery.saturday = 1;
      } else {
        // 平日
        stoptimesQuery.monday = 1;
      }

      // 時刻のフィルターを追加
      const hours = targetDateTime.getHours();
      const minutes = targetDateTime.getMinutes();
      const timeString = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:00`;

      if (isDeparture) {
        stoptimesQuery.departure_time = { $gte: timeString };
      } else {
        stoptimesQuery.arrival_time = { $gte: timeString };
      }
    }

    // 出発バス停を通過するすべての停車時刻を取得
    const originStoptimes = await getStoptimes(stoptimesQuery);

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

// 乗り換えを含む経路を検索（日時とisDepartureパラメータを追加）
async function findRouteWithTransfers(
  originStopId: string,
  destinationStopId: string,
  targetDateTime?: Date,
  isDeparture: boolean = true
) {
  // まず直接のルートを検索
  const directRoutes = await findDirectRoutes(
    originStopId,
    destinationStopId,
    targetDateTime,
    isDeparture
  );

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
    const { searchParams } = new URL(request.url);

    // パラメータを取得
    const originLat = searchParams.get("originLat");
    const originLng = searchParams.get("originLng");
    const destLat = searchParams.get("destLat");
    const destLng = searchParams.get("destLng");
    const dateTime = searchParams.get("dateTime");
    const isDeparture = searchParams.get("isDeparture");

    // パラメータのバリデーション
    if (!originLat || !originLng || !destLat || !destLng) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      );
    }

    // 数値型に変換
    const originLatNum = parseFloat(originLat);
    const originLngNum = parseFloat(originLng);
    const destLatNum = parseFloat(destLat);
    const destLngNum = parseFloat(destLng);

    try {
      // GTFSデータベース接続を確保
      await ensureDbConnection();

      // 出発地と目的地の最寄りバス停を検索
      const originStop = await findNearestStop(originLatNum, originLngNum);
      const destinationStop = await findNearestStop(destLatNum, destLngNum);

      // 最寄りバス停がない場合
      if (!originStop || !destinationStop) {
        return NextResponse.json(
          {
            hasRoute: false,
            routes: [],
            type: "none",
            transfers: 0,
            message: "最寄りのバス停が見つかりませんでした",
            originStop: originStop
              ? {
                  stopId: originStop.stop_id,
                  stopName: originStop.stop_name,
                  distance: originStop.distance,
                }
              : null,
            destinationStop: destinationStop
              ? {
                  stopId: destinationStop.stop_id,
                  stopName: destinationStop.stop_name,
                  distance: destinationStop.distance,
                }
              : null,
          },
          { status: 200 }
        );
      }

      // 日時パラメータを処理
      let targetDateTime: Date | undefined;
      if (dateTime) {
        targetDateTime = new Date(dateTime);
      }

      // 経路検索
      const routes = await findRouteWithTransfers(
        originStop.stop_id,
        destinationStop.stop_id,
        targetDateTime,
        isDeparture === "true"
      );

      // レスポンスの作成
      if (routes.hasRoute) {
        return NextResponse.json(
          {
            ...routes,
            originStop: {
              stopId: originStop.stop_id,
              stopName: originStop.stop_name,
              distance: originStop.distance,
            },
            destinationStop: {
              stopId: destinationStop.stop_id,
              stopName: destinationStop.stop_name,
              distance: destinationStop.distance,
            },
          },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          {
            hasRoute: false,
            routes: [],
            type: "none",
            transfers: 0,
            message: "ルートが見つかりませんでした",
            originStop: {
              stopId: originStop.stop_id,
              stopName: originStop.stop_name,
              distance: originStop.distance,
            },
            destinationStop: {
              stopId: destinationStop.stop_id,
              stopName: destinationStop.stop_name,
              distance: destinationStop.distance,
            },
          },
          { status: 200 }
        );
      }
    } catch (error) {
      console.error("ルート検索処理エラー:", error);
      return NextResponse.json(
        { error: "ルート検索処理に失敗しました" },
        { status: 500 }
      );
    } finally {
      // データベース接続を閉じる
      await safeCloseDb();
    }
  } catch (error) {
    console.error("API処理エラー:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
