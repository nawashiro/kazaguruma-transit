import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { Stop, Route, Departure } from "../../../types/transit";
import {
  importGtfs,
  getStops as gtfsGetStops,
  getRoutes as gtfsGetRoutes,
  getTrips as gtfsGetTrips,
  getStoptimes as gtfsGetStoptimes,
} from "gtfs";
import { DateTime } from "luxon";

// GTFSデータを保存するための一時ディレクトリ
const GTFS_TEMP_DIR = ".temp";

// configファイルのパス
const CONFIG_PATH = path.join(process.cwd(), "transit-config.json");

// GTFSデータをダウンロードして設定ファイルを作成する関数
async function prepareGTFSData() {
  try {
    // 一時ディレクトリが存在しない場合は作成
    if (!fs.existsSync(GTFS_TEMP_DIR)) {
      // recursiveオプションを使用して親ディレクトリも含めて作成
      fs.mkdirSync(GTFS_TEMP_DIR);
      console.log(`ディレクトリを作成しました: ${GTFS_TEMP_DIR}`);
    }

    // GTFSデータをインポート
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

    // GTFSデータがまだインポートされていない場合はインポート
    try {
      console.log(
        `GTFSデータのインポートを開始します...（パス：${config.sqlitePath}）`
      );
      await importGtfs(config);
      console.log("GTFSデータのインポートが完了しました");
    } catch (importError) {
      console.error("GTFSデータのインポートに失敗しました:", importError);
      return { success: false, error: importError };
    }

    return { success: true };
  } catch (error) {
    console.error("GTFSデータの準備エラー:", error);
    return { success: false, error };
  }
}

// GTFSから駅一覧を取得
async function getStops(): Promise<Stop[]> {
  const stopsFromGTFS = await gtfsGetStops();

  return stopsFromGTFS.map((stop) => ({
    id: stop.stop_id,
    name: stop.stop_name || "名称不明",
    code: stop.stop_code || undefined,
  }));
}

// GTFSから路線一覧を取得
async function getRoutes(): Promise<Route[]> {
  const routesFromGTFS = await gtfsGetRoutes();

  return routesFromGTFS.map((route) => ({
    id: route.route_id,
    name: route.route_long_name || route.route_short_name || "名称不明",
    shortName: route.route_short_name,
    longName: route.route_long_name,
    color: route.route_color ? `#${route.route_color}` : undefined,
    textColor: route.route_text_color
      ? `#${route.route_text_color}`
      : undefined,
  }));
}

// GTFSから発車時刻情報を取得
async function getDepartures(
  stopId: string,
  routeId?: string
): Promise<Departure[]> {
  try {
    // 現在の日時
    const now = DateTime.now();
    // GTFSが数値形式を期待しているため、文字列ではなく数値に変換
    const currentDate = parseInt(now.toFormat("yyyyMMdd"), 10);

    // 検索パラメータ - startTimeとendTimeを使わない形式に変更
    const params: any = {
      date: currentDate, // 数値形式
      stop_id: stopId,
      // startTimeとendTimeはSQLiteエラーの原因なので削除
    };

    if (routeId) {
      params.route_id = routeId;
    }

    // 時刻表から出発時刻を取得
    const stoptimes = await gtfsGetStoptimes(params);

    if (!stoptimes || stoptimes.length === 0) {
      return [];
    }

    // 対応する停留所、路線、トリップ情報を取得
    const stopData = await gtfsGetStops({ stop_id: stopId });
    const stop = stopData[0];

    if (!stop) {
      throw new Error(`停留所 ID ${stopId} が見つかりません`);
    }

    // 発車情報を構築
    const departures: Departure[] = [];
    const nowTime = now.toMillis();

    for (const stoptime of stoptimes) {
      // まずトリップ情報を取得
      const tripData = await gtfsGetTrips({ trip_id: stoptime.trip_id });
      const trip = tripData[0];

      if (!trip) continue;

      // トリップからroute_idを取得
      const routeData = await gtfsGetRoutes({ route_id: trip.route_id });
      const route = routeData[0];

      if (!route) continue;

      // 時刻をDateオブジェクトに変換
      const [hours, minutes, seconds] = (
        stoptime.departure_time ||
        stoptime.arrival_time ||
        "00:00:00"
      )
        .split(":")
        .map(Number);
      const departureDate = now.set({
        hour: hours % 24,
        minute: minutes,
        second: seconds,
      });

      // 日付が次の日になる場合は調整
      const adjustedDate =
        hours >= 24
          ? departureDate.plus({ days: Math.floor(hours / 24) })
          : departureDate;

      // 過去の時刻をフィルタリング
      if (adjustedDate.toMillis() < nowTime) {
        continue;
      }

      departures.push({
        routeId: route.route_id,
        routeName:
          route.route_long_name || route.route_short_name || "名称不明",
        stopId: stop.stop_id,
        stopName: stop.stop_name || "名称不明",
        direction: "不明", // 常に「不明」を設定
        scheduledTime: adjustedDate.toISO() || new Date().toISOString(),
        realtime: false, // GTFS-RTデータがないためfalse
        delay: null, // 遅延情報なし
      });

      // 最大で10件まで取得
      if (departures.length >= 10) break;
    }

    // 出発時刻でソート
    return departures.sort(
      (a, b) =>
        new Date(a.scheduledTime).getTime() -
        new Date(b.scheduledTime).getTime()
    );
  } catch (error) {
    console.error("発車時刻取得エラー:", error);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dataType = searchParams.get("dataType");
  const stopId = searchParams.get("stop");
  const routeId = searchParams.get("route");

  try {
    // GTFSデータの準備
    const preparationResult = await prepareGTFSData();
    if (!preparationResult.success) {
      return NextResponse.json(
        { error: "GTFSデータの準備に失敗しました" },
        { status: 500 }
      );
    }

    // メタデータリクエスト（駅と路線の一覧）
    if (dataType === "metadata") {
      try {
        const [stops, routes] = await Promise.all([getStops(), getRoutes()]);

        return NextResponse.json({ stops, routes });
      } catch (error) {
        console.error("メタデータ取得エラー:", error);
        return NextResponse.json(
          { error: "メタデータの取得に失敗しました" },
          { status: 500 }
        );
      }
    }

    // 出発データリクエスト
    if (stopId) {
      try {
        const departures = await getDepartures(stopId, routeId || undefined);
        return NextResponse.json({ departures });
      } catch (error) {
        console.error("発車時刻データ取得エラー:", error);
        return NextResponse.json(
          { error: "発車時刻データの取得に失敗しました" },
          { status: 500 }
        );
      }
    }

    // パラメータ不足
    return NextResponse.json(
      { error: "必要なパラメータが不足しています" },
      { status: 400 }
    );
  } catch (error) {
    console.error("APIエラー:", error);
    return NextResponse.json(
      { error: "乗換案内データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
