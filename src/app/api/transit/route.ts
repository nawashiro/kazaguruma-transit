import { NextResponse, NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import { Stop, Route, Departure } from "../../../types/transit";
import {
  importGtfs,
  getStops as gtfsGetStops,
  getRoutes as gtfsGetRoutes,
  getTrips as gtfsGetTrips,
  getStoptimes as gtfsGetStoptimes,
  openDb,
  closeDb,
} from "gtfs";
import { DateTime } from "luxon";

// GTFSデータを保存するための一時ディレクトリ
const GTFS_TEMP_DIR = ".temp";

// configファイルのパス
const CONFIG_PATH = path.join(process.cwd(), "transit-config.json");

// インポート処理のロック状態を追跡する変数
let isImporting = false;
let importPromise: Promise<any> | null = null;
let isDbOpen = false;

// テスト用に現在時刻を固定するオプション
const USE_MOCK_TIME = process.env.MOCK_TIME === "true";
const MOCK_HOUR = parseInt(process.env.MOCK_HOUR || "12", 10);
const MOCK_MINUTE = parseInt(process.env.MOCK_MINUTE || "0", 10);

// 開発時のデバッグ情報を表示
if (USE_MOCK_TIME) {
  console.log(
    `モック時刻を使用: ${MOCK_HOUR}:${
      MOCK_MINUTE < 10 ? "0" + MOCK_MINUTE : MOCK_MINUTE
    }`
  );
}

// GTFSのStopTime型を定義
interface GTFSStopTime {
  trip_id?: string;
  arrival_time?: string;
  departure_time?: string;
  stop_id?: string;
  stop_sequence?: number;
  stop_headsign?: string;
  pickup_type?: number;
  drop_off_type?: number;
  shape_dist_traveled?: number;
  timepoint?: number;
  route_id?: string; // GTFSでは通常定義されていないがAPIで拡張している
}

// データベース接続を適切に管理するための関数
async function ensureDbConnection() {
  if (!isDbOpen) {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    await openDb(config);
    isDbOpen = true;
  }
}

// データベース接続を閉じる関数
async function safeCloseDb() {
  if (isDbOpen) {
    try {
      await closeDb();
      isDbOpen = false;
    } catch (error) {
      console.warn("データベース接続を閉じる際にエラーが発生しました:", error);
    }
  }
}

// データベースの整合性をチェックする関数
async function checkDatabaseIntegrity() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    const dbFilePath = path.join(process.cwd(), config.sqlitePath);

    // ファイルが存在しない場合は整合性がない
    if (!fs.existsSync(dbFilePath)) {
      console.log(
        "データベースファイルが存在しません。再インポートが必要です。"
      );
      return false;
    }

    // 既存の接続を閉じてから新しい接続を作成
    await safeCloseDb();

    try {
      // データベース接続を開く
      await ensureDbConnection();

      // 最も基本的なテーブルに対してクエリを実行してみる - 空のクエリで最初の数件を取得
      const stops = await gtfsGetStops();
      const routes = await gtfsGetRoutes();

      // 結果の最初の要素だけを確認
      if (!stops || stops.length === 0 || !routes || routes.length === 0) {
        console.log(
          "データベースにデータが不足しています。再インポートが必要です。"
        );
        return false;
      }

      console.log("データベースの整合性チェックに成功しました。");
      return true;
    } catch (error) {
      console.error("データベースの整合性チェックに失敗しました:", error);
      return false;
    }
  } catch (error) {
    console.error("データベース整合性チェックエラー:", error);
    return false;
  }
}

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

    // DBファイルのパス
    const dbFilePath = path.join(process.cwd(), config.sqlitePath);

    // すでにインポート中の場合は、そのPromiseを返す
    if (isImporting && importPromise) {
      console.log("別のリクエストが既にインポート中です。待機します...");
      return importPromise;
    }

    // データベースの整合性チェック
    const isDbValid = await checkDatabaseIntegrity();

    // GTFSデータがまだインポートされていない場合、またはskipImportがfalseの場合、
    // またはデータベースの整合性に問題がある場合はインポート
    if (
      !fs.existsSync(dbFilePath) ||
      config.skipImport === false ||
      !isDbValid
    ) {
      try {
        // インポート状態をロック
        isImporting = true;

        // 新しいインポートPromiseを作成
        importPromise = (async () => {
          console.log(
            `GTFSデータのインポートを開始します...（パス：${config.sqlitePath}）`
          );

          // 既存のDBファイルを削除してクリーンな状態からインポート
          if (fs.existsSync(dbFilePath)) {
            try {
              // データベース接続を閉じる
              await safeCloseDb();

              // 同期削除の代わりに非同期削除を使用
              await new Promise<void>((resolve, reject) => {
                fs.unlink(dbFilePath, (err) => {
                  if (err) {
                    console.warn("DBファイルの削除に失敗しました:", err);
                    // 失敗してもresolveして続行
                    resolve();
                  } else {
                    console.log(
                      `既存のDBファイルを削除しました: ${dbFilePath}`
                    );
                    resolve();
                  }
                });
              });

              // 削除後に少し待機して確実にファイルが解放されるようにする
              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (deleteError) {
              console.warn(
                "DBファイルの削除中にエラーが発生しました:",
                deleteError
              );
              // 削除に失敗してもインポートは試行する
            }
          }

          // importGtfsを実行
          await importGtfs(config);
          console.log("GTFSデータのインポートが完了しました");

          // データベース接続を初期化
          await safeCloseDb();
          await ensureDbConnection();

          // データベースの整合性を再チェック
          const isDbValidAfterImport = await checkDatabaseIntegrity();
          if (!isDbValidAfterImport) {
            throw new Error(
              "インポート後もデータベースの整合性に問題があります"
            );
          }

          // インポート成功したら、次回はスキップするように設定を更新
          if (config.skipImport === false) {
            config.skipImport = true;
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
            console.log("設定ファイルを更新しました: skipImport = true");
          }

          return { success: true };
        })();

        // インポート完了後にロック解除
        const result = await importPromise;
        isImporting = false;
        importPromise = null;
        return result;
      } catch (importError) {
        console.error("GTFSデータのインポートに失敗しました:", importError);
        // エラー時もロック解除
        isImporting = false;
        importPromise = null;
        return { success: false, error: importError };
      }
    } else {
      console.log("GTFSデータは既にインポート済みです。スキップします。");
      // 正常なデータベースに接続
      await ensureDbConnection();
    }

    return { success: true };
  } catch (error) {
    console.error("GTFSデータの準備エラー:", error);
    // エラー時もロック解除
    isImporting = false;
    importPromise = null;
    return { success: false, error };
  }
}

// GTFSから駅一覧を取得
async function getStops(): Promise<Stop[]> {
  await ensureDbConnection();
  const stopsFromGTFS = await gtfsGetStops();

  return stopsFromGTFS.map((stop) => ({
    id: stop.stop_id,
    name: stop.stop_name || "名称不明",
    code: stop.stop_code || undefined,
  }));
}

// GTFSから路線一覧を取得
async function getRoutes(): Promise<Route[]> {
  await ensureDbConnection();
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

// 現在時刻を取得する関数（モック可能）
function getCurrentTime(): Date {
  if (USE_MOCK_TIME) {
    const mockDate = new Date();
    mockDate.setHours(MOCK_HOUR);
    mockDate.setMinutes(MOCK_MINUTE);
    mockDate.setSeconds(0);
    return mockDate;
  }
  return new Date();
}

// GTFSから発車時刻情報を取得
async function getDepartures(
  stopId: string,
  routeId?: string
): Promise<Departure[]> {
  try {
    await ensureDbConnection();

    // 現在の日時 - モック時刻に対応
    const now = DateTime.fromJSDate(getCurrentTime());
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
    const nowTime = getCurrentTime().getTime();

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
        scheduledTime: adjustedDate.toISO() || getCurrentTime().toISOString(),
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

// GTFSから発車時刻情報を取得
async function gtfsGetDepartures(
  stop_id: string | null = null,
  route_id: string | null = null
): Promise<Departure[]> {
  await ensureDbConnection();

  // stop_id と route_id に基づいて発車時刻を取得
  const options = {
    date: new Date(getCurrentTime().setHours(0, 0, 0, 0)), // 現在日付の00:00:00
    today: true,
  };

  // 選択されたストップのルートと時刻を取得
  const stoptimes = (await gtfsGetStoptimes({
    stop_id: stop_id || undefined,
    route_id: route_id || undefined,
  })) as GTFSStopTime[];

  // 対応するルート情報を取得
  const allRoutes = await gtfsGetRoutes();
  const routesMap = new Map();
  for (const route of allRoutes) {
    routesMap.set(route.route_id, route);
  }

  // 時刻データをDateオブジェクトに変換するヘルパー関数
  const getTimeAsDate = (timeStr: string) => {
    const now = getCurrentTime();
    const [hours, minutes, seconds] = timeStr.split(":").map(Number);
    const date = new Date(now);
    date.setHours(hours, minutes, seconds || 0);
    return date;
  };

  // 時刻フォーマット用の関数
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 出発までの時間を表示する関数
  const formatTimeUntilDeparture = (msUntilDeparture: number): string => {
    const minutesUntilDeparture = Math.floor(msUntilDeparture / 60000);
    if (minutesUntilDeparture < 60) {
      return `${minutesUntilDeparture}分後`;
    } else {
      const hours = Math.floor(minutesUntilDeparture / 60);
      const minutes = minutesUntilDeparture % 60;
      return `${hours}時間${minutes > 0 ? `${minutes}分` : ""}後`;
    }
  };

  try {
    // 発車情報を構築
    const departures: Departure[] = [];
    const nowTime = getCurrentTime().getTime();

    // stoptimesを型安全に処理
    for (const stoptime of stoptimes) {
      if (!stoptime.route_id || !stoptime.departure_time || !stoptime.stop_id)
        continue;

      const route = routesMap.get(stoptime.route_id) || {
        route_short_name: "Unknown",
        route_long_name: "未知のルート",
      };
      const departureTime = getTimeAsDate(stoptime.departure_time);
      const departureTimeMs = departureTime.getTime();

      // 現在時刻以降の出発のみを含める（過去の出発は含まない）
      if (departureTimeMs >= nowTime) {
        departures.push({
          routeId: stoptime.route_id,
          routeName:
            route.route_short_name || route.route_long_name || "名称不明",
          stopId: stoptime.stop_id,
          stopName: "名称不明", // API側では名前を設定する
          direction: "不明", // 方向情報
          scheduledTime: departureTime.toISOString(),
          realtime: false,
          delay: null,
        });
      }
    }

    // 発車時刻でソート
    departures.sort(
      (a, b) =>
        new Date(a.scheduledTime).getTime() -
        new Date(b.scheduledTime).getTime()
    );

    return departures;
  } catch (err) {
    console.error("発車時刻取得エラー:", err);
    return [];
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await ensureDbConnection();
    await checkDatabaseIntegrity();

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const dataType = searchParams.get("dataType");
    const stopId = searchParams.get("stop");
    const routeId = searchParams.get("route");
    const dateTimeParam = searchParams.get("dateTime");
    const isDepartureParam = searchParams.get("isDeparture");

    // dataTypeがmetadataの場合はメタデータを返す
    if (dataType === "metadata") {
      return await getMetadata();
    }

    // 出発時刻の取得リクエスト
    if (stopId) {
      const isDeparture = isDepartureParam !== "false"; // デフォルトはtrue
      let dateTime: Date | undefined = undefined;

      if (dateTimeParam) {
        dateTime = new Date(dateTimeParam);
        if (isNaN(dateTime.getTime())) {
          dateTime = undefined; // 無効な日時形式の場合は無視
        }
      }

      return await getDeparturesByStop(stopId, routeId, dateTime, isDeparture);
    }

    // その他のリクエストタイプが追加される可能性があるが、
    // 現時点では上記以外はエラーとして扱う
    return NextResponse.json(
      { error: "無効なリクエストです" },
      { status: 400 }
    );
  } catch (error) {
    console.error("APIエラー:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  } finally {
    await safeCloseDb();
  }
}

// 特定のバス停の出発時刻を取得
async function getDeparturesByStop(
  stopId: string,
  routeId: string | null,
  dateTime?: Date,
  isDeparture: boolean = true
): Promise<NextResponse> {
  try {
    await ensureDbConnection();

    // 日時が指定されていない場合は現在時刻を使用
    const targetDateTime = dateTime || getCurrentTime();

    // GTFS からの発車/到着情報の取得
    const stoptimes = (await gtfsGetStoptimes({
      stop_id: stopId,
      route_id: routeId || undefined,
    })) as GTFSStopTime[];

    // 対応するルートと停留所の情報を取得
    const routesMap = new Map();
    const routes = await gtfsGetRoutes();
    for (const route of routes) {
      routesMap.set(route.route_id, route);
    }

    const stopsMap = new Map();
    const stops = await gtfsGetStops({ stop_id: stopId });
    for (const stop of stops) {
      stopsMap.set(stop.stop_id, stop);
    }

    // 発車情報を構築
    const departures: Departure[] = [];
    const targetTime = targetDateTime.getTime();

    for (const stoptime of stoptimes) {
      if (!stoptime.route_id || !stoptime.trip_id) continue;

      // 時刻情報を取得
      const timeField = isDeparture
        ? stoptime.departure_time
        : stoptime.arrival_time;
      if (!timeField) continue;

      // 時刻をDateオブジェクトに変換
      const [hours, minutes, seconds] = timeField.split(":").map(Number);
      const departureDate = new Date(targetDateTime);
      departureDate.setHours(hours % 24, minutes, seconds || 0);

      // 日付が次の日になる場合は調整
      if (hours >= 24) {
        departureDate.setDate(departureDate.getDate() + Math.floor(hours / 24));
      }

      const departureTime = departureDate.getTime();

      // 出発/到着時刻のフィルタリング
      if (isDeparture) {
        // 出発時刻モード: 指定時刻以降の時刻のみ
        if (departureTime < targetTime) continue;
      } else {
        // 到着時刻モード: 指定時刻以前の時刻のみ
        if (departureTime > targetTime) continue;
      }

      const route = routesMap.get(stoptime.route_id);
      const stop = stopsMap.get(stopId);

      if (!route || !stop) continue;

      departures.push({
        routeId: stoptime.route_id,
        routeName:
          route.route_long_name || route.route_short_name || "名称不明",
        stopId: stopId,
        stopName: stop.stop_name || "名称不明",
        direction: "不明",
        scheduledTime: departureDate.toISOString(),
        realtime: false,
        delay: null,
      });

      // 出発時刻モードでは最大10件まで、到着時刻モードでは過去10件まで
      if (departures.length >= 10) break;
    }

    // 日時でソート（出発モードは昇順、到着モードは降順）
    departures.sort((a, b) => {
      const timeA = new Date(a.scheduledTime).getTime();
      const timeB = new Date(b.scheduledTime).getTime();
      return isDeparture ? timeA - timeB : timeB - timeA;
    });

    return NextResponse.json({ departures });
  } catch (error) {
    console.error("時刻取得エラー:", error);
    return NextResponse.json(
      {
        error: isDeparture
          ? "出発時刻の取得に失敗しました"
          : "到着時刻の取得に失敗しました",
      },
      { status: 500 }
    );
  }
}

// getMetadata 関数の実装
async function getMetadata(): Promise<NextResponse> {
  try {
    await ensureDbConnection();
    // stops と routes を取得
    const stops = await getStops();
    const routes = await getRoutes();

    return NextResponse.json({
      stops,
      routes,
    });
  } catch (error) {
    console.error("メタデータ取得エラー:", error);
    return NextResponse.json(
      { error: "メタデータの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// ... その他の関数
