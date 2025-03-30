import { NextRequest, NextResponse } from "next/server";
import { TransitManager } from "@/lib/db/transit-manager";
import { DateTime } from "luxon";

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
    // トランジットマネージャーでGTFSデータを初期化
    const transitManager = TransitManager.getInstance();
    await transitManager.prepareGTFSData();

    // TransitManagerの関数を使ってバス停を取得
    const { stops, nearestStop } = await transitManager.getNearestStops(
      lat,
      lng
    );

    if (!stops || stops.length === 0) {
      console.log("バス停データがありません");
      return null;
    }

    // 最寄りのバス停が見つからなかった場合
    if (!nearestStop) {
      return null;
    }

    // 距離によるフィルタリング
    if (nearestStop.distance <= maxDistance) {
      return {
        stop_id: nearestStop.stop_id,
        stop_name: nearestStop.stop_name,
        stop_lat: nearestStop.stop_lat,
        stop_lon: nearestStop.stop_lon,
        distance: nearestStop.distance,
      };
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
    // トランジットマネージャーのインスタンスを取得
    const transitManager = TransitManager.getInstance();
    await transitManager.prepareGTFSData();

    // 時刻のフィルター条件を作成
    let timeFilter = "";
    if (targetDateTime) {
      const hours = targetDateTime.getHours();
      const minutes = targetDateTime.getMinutes();
      const timeString = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:00`;

      timeFilter = isDeparture
        ? `departure_time >= '${timeString}'`
        : `arrival_time >= '${timeString}'`;
    }

    // 日付に基づくservice_idを取得
    let serviceIds: string[] = [];
    if (targetDateTime) {
      serviceIds = await transitManager.getValidServiceIds(targetDateTime);
      if (serviceIds.length === 0) {
        console.log("選択された日付の運行サービスが見つかりません");
      }
    }

    // クエリの構築
    const routeQuery = `
      WITH origin_trips AS (
        SELECT st.trip_id, st.departure_time, st.stop_sequence
        FROM stop_times st
        JOIN trips t ON st.trip_id = t.trip_id
        WHERE st.stop_id = ?
        ${timeFilter ? `AND ${timeFilter}` : ""}
        ${
          serviceIds.length > 0
            ? `AND t.service_id IN (${serviceIds.map(() => "?").join(",")})`
            : ""
        }
      ),
      dest_trips AS (
        SELECT st.trip_id, st.arrival_time, st.stop_sequence
        FROM stop_times st
        WHERE st.stop_id = ?
      )
      SELECT ot.trip_id, ot.departure_time, dt.arrival_time, t.route_id, r.route_short_name, r.route_long_name, r.route_color, r.route_text_color,
      (julianday(dt.arrival_time) - julianday(ot.departure_time)) * 24 * 60 AS trip_duration_minutes
      FROM origin_trips ot
      JOIN dest_trips dt ON ot.trip_id = dt.trip_id
      JOIN trips t ON ot.trip_id = t.trip_id
      JOIN routes r ON t.route_id = r.route_id
      WHERE dt.stop_sequence > ot.stop_sequence
      ORDER BY trip_duration_minutes, ot.departure_time
      LIMIT 1
    `;

    // パラメータの準備
    const params = [originStopId];
    if (serviceIds.length > 0) {
      params.push(...serviceIds);
    }
    params.push(destinationStopId);

    // トランジットマネージャーを通してデータベースクエリを実行
    const routes = await transitManager.withCustomSQLQuery<any[]>((db) => {
      return db.prepare(routeQuery).all(...params);
    });

    if (routes.length === 0) {
      console.log("直接のルートが見つかりません");
      return [];
    }

    // 結果をフォーマット
    return routes.map((route: any) => ({
      routeId: route.route_id,
      routeName: route.route_short_name || route.route_long_name,
      routeShortName: route.route_short_name || "",
      routeLongName: route.route_long_name || "",
      routeColor: route.route_color ? `#${route.route_color}` : "#000000",
      routeTextColor: route.route_text_color
        ? `#${route.route_text_color}`
        : "#FFFFFF",
      departureTime: route.departure_time,
      arrivalTime: route.arrival_time,
      tripId: route.trip_id,
      tripDurationMinutes: route.trip_duration_minutes,
    }));
  } catch (error) {
    console.error("直接ルート検索エラー:", error);
    throw error;
  }
}

// バス停の詳細情報を取得
async function getStopDetails(stopId: string) {
  try {
    const transitManager = TransitManager.getInstance();
    await transitManager.prepareGTFSData();

    // TransitManagerを使ってバス停情報を取得
    const stops = await transitManager.getStops();
    const stop = stops.find((s) => s.id === stopId);

    if (!stop) return null;

    // バス停の位置情報を取得するために、TransitManagerの内部APIを使用
    const locationInfo = await transitManager.getStopLocation(stopId);

    if (!locationInfo) return null;

    return {
      stopId: stop.id,
      stopName: stop.name,
      stopLat: locationInfo.lat,
      stopLon: locationInfo.lon,
    };
  } catch (error) {
    console.error("バス停詳細取得エラー:", error);
    return null;
  }
}

// 乗り換えが必要なルートを検索する
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
      routes: [directRoutes[0]], // 最も最適な1つのルートのみを返す
      type: "direct",
      transfers: 0,
    };
  }

  // 乗り換えが1回の経路を検索
  try {
    const transitManager = TransitManager.getInstance();
    await transitManager.prepareGTFSData();

    // 時刻のフィルター条件を作成
    let timeFilter = "";
    if (targetDateTime) {
      const hours = targetDateTime.getHours();
      const minutes = targetDateTime.getMinutes();
      const timeString = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:00`;

      timeFilter = isDeparture
        ? `departure_time >= '${timeString}'`
        : `arrival_time >= '${timeString}'`;
    }

    // 有効なサービスIDを取得
    let serviceIds: string[] = [];
    if (targetDateTime) {
      serviceIds = await transitManager.getValidServiceIds(targetDateTime);
    }

    // 乗り換え候補バス停を検索するクエリ
    const transferQuery = `
      WITH origin_stops AS (
        -- 出発バス停から行けるバス停
        SELECT DISTINCT s2.stop_id, s2.stop_name, s2.stop_lat, s2.stop_lon
        FROM stop_times st1
        JOIN trips t1 ON st1.trip_id = t1.trip_id
        JOIN stop_times st2 ON st2.trip_id = st1.trip_id
        JOIN stops s2 ON st2.stop_id = s2.stop_id
        WHERE st1.stop_id = ?
        ${
          timeFilter
            ? `AND ${
                isDeparture
                  ? `st1.departure_time ${timeFilter.replace(
                      "departure_time",
                      ""
                    )}`
                  : `st1.arrival_time ${timeFilter.replace("arrival_time", "")}`
              }`
            : ""
        }
        ${
          serviceIds.length > 0
            ? `AND t1.service_id IN (${serviceIds.map(() => "?").join(",")})`
            : ""
        }
        AND st2.stop_sequence > st1.stop_sequence
      ),
      destination_stops AS (
        -- 目的地バス停に到着できるバス停
        SELECT DISTINCT s1.stop_id, s1.stop_name, s1.stop_lat, s1.stop_lon
        FROM stop_times st1
        JOIN trips t1 ON st1.trip_id = t1.trip_id
        JOIN stop_times st2 ON st2.trip_id = st1.trip_id
        JOIN stops s1 ON st1.stop_id = s1.stop_id
        WHERE st2.stop_id = ?
        ${
          serviceIds.length > 0
            ? `AND t1.service_id IN (${serviceIds.map(() => "?").join(",")})`
            : ""
        }
        AND st1.stop_sequence < st2.stop_sequence
      )
      -- 共通の乗換バス停を見つける（自分自身は除外）
      SELECT os.stop_id, os.stop_name, os.stop_lat, os.stop_lon
      FROM origin_stops os
      JOIN destination_stops ds ON os.stop_id = ds.stop_id
      WHERE os.stop_id != ? AND os.stop_id != ?
    `;

    // クエリパラメータを設定
    const params = [originStopId];
    if (serviceIds.length > 0) {
      params.push(...serviceIds);
    }
    params.push(destinationStopId);
    if (serviceIds.length > 0) {
      params.push(...serviceIds);
    }
    params.push(originStopId, destinationStopId);

    // トランジットマネージャーを通してクエリを実行
    const transferStops = await transitManager.withCustomSQLQuery<any[]>(
      (db) => {
        return db.prepare(transferQuery).all(...params);
      }
    );

    if (transferStops.length === 0) {
      return {
        hasRoute: false,
        routes: [],
        type: "none",
        transfers: 0,
        message: "乗換候補が見つかりません",
      };
    }

    // 乗り換え経路を探す
    const transferRoutes = [];

    for (const transferStop of transferStops) {
      // 出発地から乗換地点への経路
      const firstLegRoutes = await findDirectRoutes(
        originStopId,
        transferStop.stop_id,
        targetDateTime,
        isDeparture
      );

      if (firstLegRoutes.length > 0) {
        // 第一区間の予想到着時刻を基に第二区間の出発時刻を計算
        let secondLegDateTime = targetDateTime;

        if (isDeparture && firstLegRoutes[0].arrivalTime) {
          // 第一区間の到着時刻を解析
          const [arrivalHours, arrivalMinutes] = firstLegRoutes[0].arrivalTime
            .split(":")
            .map(Number);

          // 新しい日時オブジェクトを作成
          const newDateTime = new Date(targetDateTime || new Date());
          newDateTime.setHours(arrivalHours, arrivalMinutes, 0, 0);

          // 乗り換え待ち時間を追加（例: 3分）
          newDateTime.setMinutes(newDateTime.getMinutes() + 3);

          secondLegDateTime = newDateTime;
        }

        // 乗換地点から目的地への経路
        const secondLegRoutes = await findDirectRoutes(
          transferStop.stop_id,
          destinationStopId,
          secondLegDateTime, // 更新された出発時刻を使用
          true // 第二区間は常に出発時刻ベースで検索
        );

        if (secondLegRoutes.length > 0) {
          // 最初のルート（最適なもの）だけを使用
          const firstLeg = firstLegRoutes[0];
          const secondLeg = secondLegRoutes[0];

          // 総所要時間を計算 (もし存在する場合)
          let totalDuration = 0;
          if (firstLeg.tripDurationMinutes && secondLeg.tripDurationMinutes) {
            totalDuration =
              firstLeg.tripDurationMinutes + secondLeg.tripDurationMinutes;
          }

          transferRoutes.push({
            firstLeg,
            secondLeg,
            transferStop: {
              stopId: transferStop.stop_id,
              stopName: transferStop.stop_name,
              stopLat:
                typeof transferStop.stop_lat === "string"
                  ? parseFloat(transferStop.stop_lat)
                  : transferStop.stop_lat,
              stopLon:
                typeof transferStop.stop_lon === "string"
                  ? parseFloat(transferStop.stop_lon)
                  : transferStop.stop_lon,
            },
            totalDuration,
          });
        }
      }
    }

    if (transferRoutes.length === 0) {
      return {
        hasRoute: false,
        routes: [],
        type: "none",
        transfers: 0,
        message: "適切な乗換経路が見つかりません",
      };
    }

    // 総所要時間でソート
    transferRoutes.sort((a, b) => a.totalDuration - b.totalDuration);

    // 最適な乗り換えルート（所要時間が最も短いもの）を選択
    const optimalTransferRoute = transferRoutes[0];

    // 最適な乗り換え経路のみを整形して返す
    const formattedRoute = {
      routeId: optimalTransferRoute.firstLeg.routeId,
      routeName: optimalTransferRoute.firstLeg.routeName,
      routeShortName: optimalTransferRoute.firstLeg.routeShortName,
      routeLongName: optimalTransferRoute.firstLeg.routeLongName,
      routeColor: optimalTransferRoute.firstLeg.routeColor,
      routeTextColor: optimalTransferRoute.firstLeg.routeTextColor,
      transfers: [
        {
          transferStop: {
            stopId: optimalTransferRoute.transferStop.stopId,
            stopName: optimalTransferRoute.transferStop.stopName,
            stopLat: optimalTransferRoute.transferStop.stopLat,
            stopLon: optimalTransferRoute.transferStop.stopLon,
          },
          nextRoute: {
            routeId: optimalTransferRoute.secondLeg.routeId,
            routeName: optimalTransferRoute.secondLeg.routeName,
            routeShortName: optimalTransferRoute.secondLeg.routeShortName,
            routeLongName: optimalTransferRoute.secondLeg.routeLongName,
            routeColor: optimalTransferRoute.secondLeg.routeColor,
            routeTextColor: optimalTransferRoute.secondLeg.routeTextColor,
          },
        },
      ],
    };

    return {
      hasRoute: true,
      routes: [formattedRoute], // 最適な1つのルートのみを返す
      type: "transfer",
      transfers: 1,
    };
  } catch (error) {
    console.error("乗り換え経路検索エラー:", error);
    return {
      hasRoute: false,
      routes: [],
      type: "none",
      transfers: 0,
      message: "経路検索中にエラーが発生しました",
    };
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
      // トランジットマネージャーのインスタンスを取得し、データ準備
      const transitManager = TransitManager.getInstance();
      await transitManager.prepareGTFSData();

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
    }
  } catch (error) {
    console.error("API処理エラー:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
