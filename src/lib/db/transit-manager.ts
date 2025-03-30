import fs from "fs";
import path from "path";
import { importGtfs, getStops, getRoutes, getTrips, getStoptimes } from "gtfs";
import { Database } from "./database";
import {
  Stop,
  Route,
  Departure,
  GTFSStopTime,
  GTFSTrip,
  GTFSRoute,
  GTFSStop,
} from "../../types/transit";
import { DateTime } from "luxon";

// GTFSデータを保存するための一時ディレクトリ
const GTFS_TEMP_DIR = ".temp";

// configファイルのパス
const CONFIG_PATH = path.join(process.cwd(), "transit-config.json");

// インポート処理のロック状態を追跡する変数
let isImporting = false;
let importPromise: Promise<any> | null = null;

/**
 * 交通データの取得と管理を担当するマネージャークラス
 */
export class TransitManager {
  private static instance: TransitManager;
  private db: Database;

  /**
   * プライベートコンストラクタでシングルトンパターンを実現
   */
  private constructor() {
    this.db = Database.getInstance();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): TransitManager {
    if (!TransitManager.instance) {
      TransitManager.instance = new TransitManager();
    }
    return TransitManager.instance;
  }

  /**
   * GTFSデータをダウンロードして設定ファイルを作成する
   */
  public async prepareGTFSData(): Promise<{ success: boolean; error?: any }> {
    try {
      // 一時ディレクトリが存在しない場合は作成
      if (!fs.existsSync(GTFS_TEMP_DIR)) {
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
      const isDbValid = await this.db.checkIntegrity();

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
                await this.db.closeConnection();

                // 同期削除の代わりに非同期削除を使用
                await new Promise<void>((resolve, reject) => {
                  try {
                    // fs.unlinkの代わりにfs.promises.unlinkを使用
                    if (fs.promises && fs.promises.unlink) {
                      fs.promises
                        .unlink(dbFilePath)
                        .then(() => {
                          console.log(
                            `既存のDBファイルを削除しました: ${dbFilePath}`
                          );
                          resolve();
                        })
                        .catch((err) => {
                          console.warn("DBファイルの削除に失敗しました:", err);
                          resolve(); // 失敗してもresolveして続行
                        });
                    } else {
                      // 古いNode.jsバージョンの場合のフォールバック
                      fs.unlink(dbFilePath, (err) => {
                        if (err) {
                          console.warn("DBファイルの削除に失敗しました:", err);
                        } else {
                          console.log(
                            `既存のDBファイルを削除しました: ${dbFilePath}`
                          );
                        }
                        resolve(); // エラーがあってもresolveして続行
                      });
                    }
                  } catch (error) {
                    console.warn(
                      "DBファイル削除中に例外が発生しました:",
                      error
                    );
                    resolve(); // 例外が発生してもresolveして続行
                  }
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
            await this.db.closeConnection();
            await this.db.ensureConnection();

            // データベースの整合性を再チェック
            const isDbValidAfterImport = await this.db.checkIntegrity();
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
        await this.db.ensureConnection();
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

  /**
   * すべてのバス停を取得する
   */
  public async getStops(): Promise<Stop[]> {
    return this.db.withConnection(async () => {
      const stopsFromGtfs = (await getStops()) as unknown as GTFSStop[];
      return stopsFromGtfs.map((stop) => ({
        id: stop.stop_id,
        name: stop.stop_name || "名称不明",
        code: stop.stop_code,
      }));
    });
  }

  /**
   * すべての路線を取得する
   */
  public async getRoutes(): Promise<Route[]> {
    return this.db.withConnection(async () => {
      const routesFromGtfs = (await getRoutes()) as GTFSRoute[];
      return routesFromGtfs.map((route) => ({
        id: route.route_id,
        name: route.route_short_name || route.route_long_name || "",
        shortName: route.route_short_name || "",
        longName: route.route_long_name || "",
        color: route.route_color ? `#${route.route_color}` : "#000000",
        textColor: route.route_text_color
          ? `#${route.route_text_color}`
          : "#FFFFFF",
      }));
    });
  }

  /**
   * 現在時刻を取得する
   */
  private getCurrentTime(): Date {
    return new Date();
  }

  /**
   * 指定されたバス停の出発時刻を取得する
   */
  public async getDepartures(
    stopId: string,
    routeId?: string,
    targetDate?: Date,
    isDeparture: boolean = true
  ): Promise<Departure[]> {
    return this.db.withConnection(async () => {
      // 日付が指定されていない場合は現在時刻を使用
      const now = targetDate || this.getCurrentTime();
      const nowTime = DateTime.fromJSDate(now);

      // 曜日を取得（1 = 月曜日、7 = 日曜日）
      const dayOfWeek = nowTime.weekday;

      // GTFSの曜日フィールド名を決定
      let serviceField: string;
      if (dayOfWeek === 6) {
        serviceField = "saturday";
      } else if (dayOfWeek === 7) {
        serviceField = "sunday";
      } else {
        serviceField = "monday";
      }

      // 時刻をGTFS形式に変換（HH:MM:SS）
      const hours = nowTime.hour;
      const minutes = nowTime.minute;
      const seconds = nowTime.second;
      const timeStr = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      // GTFSからデータを取得して整形
      const departuresFromGtfs = await this.gtfsGetDepartures(
        stopId,
        routeId || null,
        now,
        isDeparture
      );

      return departuresFromGtfs;
    });
  }

  /**
   * GTFSからの出発時刻データを取得して整形する
   */
  private async gtfsGetDepartures(
    stop_id: string | null = null,
    route_id: string | null = null,
    date: Date = new Date(),
    isDeparture: boolean = true
  ): Promise<Departure[]> {
    const now = date;
    const nowTime = DateTime.fromJSDate(now);

    // 曜日を取得してGTFSの形式に変換
    const dayOfWeek = nowTime.weekday;
    const serviceQuery: { [key: string]: number } = {};

    if (dayOfWeek === 6) {
      serviceQuery.saturday = 1;
    } else if (dayOfWeek === 7) {
      serviceQuery.sunday = 1;
    } else {
      serviceQuery.monday = 1;
    }

    // 時刻のフィルター用の文字列
    const timeStr = `${nowTime.hour
      .toString()
      .padStart(2, "0")}:${nowTime.minute.toString().padStart(2, "0")}:00`;

    // GTFSからstoptimesを取得
    // クエリパラメータを構築
    const stoptimeQuery: any = {
      stop_id: stop_id || undefined,
      ...serviceQuery,
    };

    // 出発/到着時刻フィルターを追加
    if (isDeparture) {
      stoptimeQuery.departure_time = { $gte: timeStr };
    } else {
      stoptimeQuery.arrival_time = { $gte: timeStr };
    }

    const stoptimes = (await getStoptimes(stoptimeQuery)) as GTFSStopTime[];

    if (!stoptimes || stoptimes.length === 0) {
      return [];
    }

    // トリップIDからルートIDを取得するためのマップを作成
    const trips = (await getTrips({
      trip_id: stoptimes.map((st) => st.trip_id),
    })) as GTFSTrip[];

    const tripRouteMap = new Map<string, string>();
    trips.forEach((trip) => {
      if (trip.trip_id) {
        tripRouteMap.set(trip.trip_id, trip.route_id);
      }
    });

    // 必要なルート情報を取得
    const routesData = (await getRoutes({
      route_id: [...new Set(trips.map((trip) => trip.route_id))],
    })) as GTFSRoute[];

    const routeMap = new Map<string, GTFSRoute>();
    routesData.forEach((route) => {
      routeMap.set(route.route_id, route);
    });

    // 時間を適切にパースする関数
    const getTimeAsDate = (timeStr: string) => {
      const [hours, minutes, seconds] = timeStr.split(":").map(Number);
      const date = new Date(now);
      date.setHours(hours, minutes, seconds, 0);
      return date;
    };

    // 時間を表示用にフォーマットする関数
    const formatTime = (date: Date): string => {
      return `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
    };

    // 出発までの時間をフォーマットする関数
    const formatTimeUntilDeparture = (msUntilDeparture: number): string => {
      if (msUntilDeparture < 0) return "出発済み";

      const minutes = Math.floor(msUntilDeparture / 60000);
      if (minutes < 1) return "間もなく";
      if (minutes < 60) return `${minutes}分`;

      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}時間${
        remainingMinutes > 0 ? `${remainingMinutes}分` : ""
      }`;
    };

    // stoptimesを処理して出発情報を作成
    const departures: Departure[] = stoptimes
      .map((stoptime: GTFSStopTime) => {
        // 対応するトリップを使ってルートIDを取得
        const tripRouteId = stoptime.trip_id
          ? tripRouteMap.get(stoptime.trip_id)
          : undefined;

        // ルートIDでフィルタリング
        if (route_id && tripRouteId !== route_id) {
          return null;
        }

        // 必要な情報が欠けている場合はスキップ
        if (!stoptime.departure_time) return null;

        // 日付オブジェクトに変換
        const departureTime = getTimeAsDate(stoptime.departure_time);

        // 出発までの時間を計算
        const msUntilDeparture = departureTime.getTime() - now.getTime();

        // 次の24時間以内の出発のみを対象とする
        if (
          msUntilDeparture < -10 * 60 * 1000 ||
          msUntilDeparture > 24 * 60 * 60 * 1000
        ) {
          return null;
        }

        // 対応するルートの情報を取得
        const route = tripRouteId ? routeMap.get(tripRouteId) : undefined;

        return {
          stopId: stoptime.stop_id || "",
          tripId: stoptime.trip_id || "",
          routeId: tripRouteId || "",
          routeName: route
            ? route.route_short_name || route.route_long_name || "不明"
            : "不明",
          time: formatTime(departureTime),
          timeUntilDeparture: formatTimeUntilDeparture(msUntilDeparture),
          msUntilDeparture: msUntilDeparture,
          headsign: stoptime.stop_headsign || "",
        } as Departure;
      })
      .filter((departure): departure is Departure => departure !== null);

    // 出発時刻でソート
    departures.sort(
      (a, b) => (a.msUntilDeparture || 0) - (b.msUntilDeparture || 0)
    );

    return departures;
  }

  /**
   * 経度・緯度から最寄りのバス停を取得する
   */
  public async getNearestStops(
    lat: number,
    lng: number
  ): Promise<{
    stops: Stop[];
    nearestStop: any | null;
  }> {
    return this.db.withConnection(async () => {
      // GTFSからすべてのバス停を取得
      const stopsFromGTFS = (await getStops()) as unknown as GTFSStop[];

      if (!stopsFromGTFS || stopsFromGTFS.length === 0) {
        return { stops: [], nearestStop: null };
      }

      // バス停の座標が正しいかチェックして、距離を計算
      const stopsWithDistance = stopsFromGTFS
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
          const distance = this.calculateDistance(lat, lng, stopLat, stopLon);
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

      return {
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
    });
  }

  /**
   * ヘルシン距離計算関数（2点間の距離をキロメートル単位で計算）
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // 地球の半径（キロメートル）
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 角度をラジアンに変換
   */
  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
