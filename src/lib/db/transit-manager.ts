import {
  importGtfs,
  getStops,
  getRoutes,
  getTrips,
  getStoptimes,
  openDb,
  closeDb,
} from "gtfs";
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
import { loadConfig, saveConfig, TransitConfig } from "../config/config";

// インポート処理のロック状態を追跡する変数
let isImporting = false;
let importPromise: Promise<any> | null = null;

/**
 * 交通データの取得と管理を担当するマネージャークラス
 */
export class TransitManager {
  private static instance: TransitManager;
  private db: Database;
  private config: TransitConfig;

  /**
   * プライベートコンストラクタでシングルトンパターンを実現
   */
  private constructor() {
    this.db = Database.getInstance();

    try {
      this.config = loadConfig();
      console.log("設定ファイルを読み込みました");
    } catch (error) {
      console.error("設定ファイルの読み込みに失敗しました:", error);
      throw new Error("TransitManager の初期化に失敗しました");
    }
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
  public async prepareGTFSData(): Promise<boolean> {
    try {
      console.log("GTFS データ準備を開始");

      // データベースの整合性をチェック
      const isValid = await this.db.checkIntegrity();
      console.log(`データベース整合性チェック結果: ${isValid}`);

      // データベースが有効でなければインポートを実行
      if (!isValid || this.config.skipImport === false) {
        console.log("GTFSデータのインポートを実行します");

        try {
          // 既存のデータベース接続を閉じる
          await this.db.closeConnection();

          // 新しいインポートを開始
          console.log("GTFSデータをインポート中...");

          // 直接importGtfsを呼び出す
          try {
            // 設定ファイルをそのまま使用
            const importConfig = this.config;

            console.log("使用する設定:", JSON.stringify(importConfig, null, 2));

            const result = await importGtfs(importConfig);
            console.log("インポート結果:", result);
          } catch (importError) {
            console.error("importGtfs中にエラーが発生しました:", importError);
            // エラーがあっても処理を続行
          }

          // バックアップとしてopenDbとcloseDbを実行
          try {
            console.log("バックアップとしてopenDbを実行");
            const dbHandle = await openDb(this.config);
            console.log("openDb完了、closeDbを実行");
            await closeDb(dbHandle);
            console.log("closeDb完了");
          } catch (dbError) {
            console.error("データベース操作中にエラーが発生:", dbError);
          }

          // データベース接続を再確立
          await this.db.ensureConnection();

          // インポート後に再度整合性をチェック
          const isValidAfterImport = await this.db.checkIntegrity();
          console.log(
            `インポート後のデータベース整合性: ${isValidAfterImport}`
          );

          if (!isValidAfterImport) {
            console.error(
              "インポート後もデータベースの整合性が確保できませんでした"
            );
            return false;
          }

          return true;
        } catch (error) {
          console.error(
            "GTFSデータのインポート中にエラーが発生しました:",
            error
          );
          return false;
        }
      }

      console.log("既存のGTFSデータを使用します");
      return true;
    } catch (error) {
      console.error("GTFSデータ準備中にエラーが発生しました:", error);
      return false;
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

    // 時刻のフィルター用の文字列
    const timeStr = `${nowTime.hour
      .toString()
      .padStart(2, "0")}:${nowTime.minute.toString().padStart(2, "0")}:00`;

    // GTFSからstoptimesを取得
    // クエリパラメータを構築
    // 曜日による直接フィルタリングを行わずに全てのstoptimesを取得
    const stoptimeQuery: any = {
      stop_id: stop_id || undefined,
    };

    // 出発/到着時刻フィルターを追加
    if (isDeparture) {
      // $gteなどのオペレータは使用せず、SQL文字列として直接比較する形に変更
      stoptimeQuery.departure_time = `>= '${timeStr}'`;
    } else {
      // $gteなどのオペレータは使用せず、SQL文字列として直接比較する形に変更
      stoptimeQuery.arrival_time = `>= '${timeStr}'`;
    }

    const stoptimes = (await getStoptimes(stoptimeQuery)) as GTFSStopTime[];

    if (!stoptimes || stoptimes.length === 0) {
      return [];
    }

    // トリップIDからルートIDを取得するためのマップを作成
    const trips = (await getTrips({
      trip_id: stoptimes.map((st) => st.trip_id),
    })) as GTFSTrip[];

    // 曜日を取得
    const dayOfWeek = nowTime.weekday; // 1 = 月曜日, 7 = 日曜日

    // 現在の曜日に対応するtrip_idのフィルタリング
    // 日曜、平日などservice_idの命名規則に基づくフィルタリング
    const validTrips = trips.filter((trip) => {
      const serviceId = trip.service_id;

      // serviceIdが「日祝」の場合、日曜日のみ有効
      if (serviceId === "日祝" && dayOfWeek === 7) {
        return true;
      }

      // serviceIdが「除月火」の場合、水曜～日曜のみ有効
      if (serviceId === "除月火" && dayOfWeek >= 3) {
        return true;
      }

      // serviceIdが「除日曜」の場合、月曜～土曜のみ有効
      if (serviceId === "除日曜" && dayOfWeek !== 7) {
        return true;
      }

      return false;
    });

    const validTripIds = new Set(validTrips.map((trip) => trip.trip_id));

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
        // 有効なtrip_idのみを処理
        if (!stoptime.trip_id || !validTripIds.has(stoptime.trip_id)) {
          return null;
        }

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

  /**
   * 特定のバス停のロケーション情報を取得する
   */
  public async getStopLocation(
    stopId: string
  ): Promise<{ lat: number; lon: number } | null> {
    return this.db.withConnection(async () => {
      console.log(`バス停位置情報を取得します: stopId=${stopId}`);
      try {
        const stopsFromGtfs = (await getStops({
          stop_id: stopId,
        })) as unknown as GTFSStop[];

        if (!stopsFromGtfs || stopsFromGtfs.length === 0) {
          console.log(`バス停が見つかりません: stopId=${stopId}`);
          return null;
        }

        const stop = stopsFromGtfs[0];

        if (!stop.stop_lat || !stop.stop_lon) {
          console.log(`バス停の位置情報がありません: stopId=${stopId}`);
          return null;
        }

        const lat =
          typeof stop.stop_lat === "string"
            ? parseFloat(stop.stop_lat)
            : stop.stop_lat;
        const lon =
          typeof stop.stop_lon === "string"
            ? parseFloat(stop.stop_lon)
            : stop.stop_lon;

        if (isNaN(lat) || isNaN(lon)) {
          console.log(
            `バス停の位置情報が無効です: stopId=${stopId}, lat=${stop.stop_lat}, lon=${stop.stop_lon}`
          );
          return null;
        }

        return { lat, lon };
      } catch (error) {
        console.error(
          `バス停位置情報の取得中にエラーが発生しました: stopId=${stopId}`,
          error
        );
        return null;
      }
    });
  }

  /**
   * 日付に基づいて有効なサービスIDを取得する
   */
  public async getValidServiceIds(targetDate: Date): Promise<string[]> {
    return this.db.withConnection(async () => {
      try {
        console.log(
          `日付に基づく有効なサービスIDを取得: ${targetDate
            .toISOString()
            .slice(0, 10)}`
        );

        // GTFSの日付形式 (YYYYMMDD)
        const formattedDate = targetDate
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");

        // 曜日を取得 (0 = 日曜日, 1 = 月曜日, ...)
        const dayOfWeek = targetDate.getDay();

        // GTFSカレンダーの曜日カラム名
        const dayColumns = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ];

        // 対応する曜日カラムを選択
        const dayColumn = dayColumns[dayOfWeek];

        // SQLクエリの実行
        return await this.withCustomSQLQuery((db) => {
          const serviceIdQuery = `
            SELECT service_id FROM calendar 
            WHERE ${dayColumn} = 1 
            AND start_date <= '${formattedDate}' 
            AND end_date >= '${formattedDate}'
          `;

          try {
            const serviceRows = db.prepare(serviceIdQuery).all();
            const serviceIds = serviceRows.map(
              (row: { service_id: string }) => row.service_id
            );

            console.log(`取得したサービスID: ${serviceIds.length}件`);
            return serviceIds;
          } catch (err) {
            console.error("service_id取得エラー:", err);
            return [];
          }
        });
      } catch (error) {
        console.error("サービスID取得中にエラーが発生しました:", error);
        return [];
      }
    });
  }

  /**
   * カスタムSQLクエリを実行するためのユーティリティメソッド
   * データベース接続の一貫性を保ちつつ、低レベルなSQLクエリを実行できる
   */
  public async withCustomSQLQuery<T>(
    callback: (db: any) => Promise<T>
  ): Promise<T> {
    try {
      console.log("カスタムSQLクエリの実行を開始します");

      // データベースハンドルを取得
      const dbHandle = await this.db.getDbHandle();

      if (!dbHandle) {
        throw new Error("データベースハンドルが取得できませんでした");
      }

      // コールバックにデータベースハンドルを渡してカスタムクエリを実行
      const result = await callback(dbHandle);
      console.log("カスタムSQLクエリの実行が完了しました");

      return result;
    } catch (error) {
      console.error("カスタムSQLクエリの実行中にエラーが発生しました:", error);
      throw error;
    }
  }
}
