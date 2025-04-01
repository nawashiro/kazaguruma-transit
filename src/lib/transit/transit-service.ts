import fs from "fs";
import path from "path";
import { openDb, closeDb } from "gtfs";
import {
  TransitQuery,
  RouteQuery,
  StopQuery,
  TimetableQuery,
  TransitResponse,
} from "@/types/transit-api";
import { loadConfig, TransitConfig } from "../config/config";

/**
 * 統合トランジットサービスクラス
 * データベース接続とトランジット関連の全ての機能を単一のクラスで提供
 */
export class TransitService {
  private db: any;
  private config: TransitConfig;
  private static instance: TransitService;
  private isDbInitialized = false;

  /**
   * プライベートコンストラクタでシングルトンパターンを実現
   */
  private constructor() {
    try {
      this.config = loadConfig();
      console.log("[TransitService] 設定ファイルを読み込みました");
    } catch (error) {
      console.error(
        "[TransitService] 設定ファイルの読み込みに失敗しました:",
        error
      );
      throw new Error("TransitService の初期化に失敗しました");
    }
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): TransitService {
    if (!TransitService.instance) {
      TransitService.instance = new TransitService();
    }
    return TransitService.instance;
  }

  /**
   * データベース接続を初期化
   */
  private async initDb(): Promise<any> {
    if (this.db) {
      return this.db;
    }

    try {
      console.log("[TransitService] データベース接続を初期化しています...");

      // データベースが存在するか確認
      const dbPath = path.join(process.cwd(), this.config.sqlitePath);
      const dbDir = path.dirname(dbPath);

      // データベースディレクトリが存在しない場合は作成
      if (!fs.existsSync(dbDir)) {
        console.log(`[TransitService] ディレクトリを作成します: ${dbDir}`);
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const dbExists = fs.existsSync(dbPath);

      // GTFSライブラリの最新仕様に合わせて修正
      // skipImportパラメータはopenDb関数内部で処理されるため、
      // 手動でskipImportを制御する必要はありません
      this.db = await openDb(this.config);

      // DBが初期化されたことを記録
      this.isDbInitialized = true;
      console.log("[TransitService] データベース接続が初期化されました");
      return this.db;
    } catch (error) {
      console.error("[TransitService] データベース初期化エラー:", error);
      throw new Error("データベース接続に失敗しました");
    }
  }

  /**
   * データベース接続を閉じる
   */
  public async closeConnection(): Promise<void> {
    if (this.db) {
      try {
        console.log("[TransitService] データベース接続を閉じます");
        await closeDb(this.db);
        this.db = null;
        this.isDbInitialized = false;
        console.log("[TransitService] データベース接続が閉じられました");
      } catch (error) {
        console.warn(
          "[TransitService] データベース接続を閉じる際にエラーが発生しました:",
          error
        );
      }
    }
  }

  /**
   * トランジットクエリを処理する単一エントリーポイント
   * @param query トランジットクエリオブジェクト
   * @returns クエリ結果
   */
  public async process(query: TransitQuery): Promise<TransitResponse> {
    try {
      await this.initDb();

      switch (query.type) {
        case "route":
          return await this.findRoute(query);
        case "stop":
          return await this.findStops(query);
        case "timetable":
          return await this.getTimetable(query);
        default:
          throw new Error("不明なクエリタイプ");
      }
    } catch (error) {
      console.error(
        "[TransitService] クエリ処理中にエラーが発生しました:",
        error
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "サーバーエラーが発生しました",
      };
    }
  }

  /**
   * 経路検索を処理する
   * 出発地点と目的地点の座標から最適な経路を検索
   */
  private async findRoute(query: RouteQuery): Promise<TransitResponse> {
    try {
      const { origin, destination, time, isDeparture = true } = query;

      console.log(
        `[TransitService] 経路検索: ${origin.lat},${origin.lng} → ${
          destination.lat
        },${destination.lng}, ${isDeparture ? "出発" : "到着"}時刻 = ${time}`
      );

      // 最寄りのバス停を特定
      const originStop = await this.findNearestStop(origin.lat, origin.lng);
      const destStop = await this.findNearestStop(
        destination.lat,
        destination.lng
      );

      if (!originStop || !destStop) {
        return {
          success: false,
          error: "最寄りのバス停が見つかりませんでした",
          data: { journeys: [], stops: [] },
        };
      }

      const from = {
        ...origin,
        stop_id: originStop.stop_id,
        stop_name: originStop.stop_name,
      };

      const to = {
        ...destination,
        stop_id: destStop.stop_id,
        stop_name: destStop.stop_name,
      };

      // 同じバス停の場合はエラー
      if (from.stop_id === to.stop_id) {
        return {
          success: false,
          error: "出発地と目的地が同じバス停です",
          data: { journeys: [], stops: [] },
        };
      }

      try {
        // 時刻文字列をDate型に変換
        const requestedTime = time ? new Date(time) : new Date();
        const timeStr = this.formatTime(requestedTime);

        // 結果格納変数
        let allRoutes: any[] = [];

        // 直行便を探す
        const directResults = await this.findDirectRoute(
          from,
          to,
          time,
          isDeparture
        );

        // 直行便があれば結果に追加
        if (directResults.success && directResults.data.journeys?.length > 0) {
          allRoutes = [...directResults.data.journeys];
        }

        // 乗り換えが必要な場合も検索
        const transferResults = await this.findRouteWithTransfer(
          from,
          to,
          time,
          isDeparture
        );

        // 乗り換え経路があれば結果に追加
        if (
          transferResults.success &&
          transferResults.data.journeys?.length > 0
        ) {
          allRoutes = [...allRoutes, ...transferResults.data.journeys];
        }

        // ルートが見つからなかった場合
        if (allRoutes.length === 0) {
          return {
            success: true,
            data: {
              journeys: [],
              stops: [
                {
                  id: from.stop_id,
                  name: from.stop_name,
                  distance: 0,
                  lat: parseFloat(originStop.stop_lat),
                  lng: parseFloat(originStop.stop_lon),
                },
                {
                  id: to.stop_id,
                  name: to.stop_name,
                  distance: 0,
                  lat: parseFloat(destStop.stop_lat),
                  lng: parseFloat(destStop.stop_lon),
                },
              ],
              message: "経路が見つかりませんでした",
            },
          };
        }

        // すべてのルートを時間順にソート
        const sortedRoutes = allRoutes.sort((a, b) => {
          // 出発/到着時刻に基づいて比較する時刻を選択
          const timeA = isDeparture
            ? new Date(`2000-01-01T${a.departure}`).getTime()
            : new Date(`2000-01-01T${a.arrival}`).getTime();
          const timeB = isDeparture
            ? new Date(`2000-01-01T${b.departure}`).getTime()
            : new Date(`2000-01-01T${b.arrival}`).getTime();

          // 出発時刻指定: 早い順、到着時刻指定: 遅い順
          return isDeparture ? timeA - timeB : timeB - timeA;
        });

        // 指定時刻をミリ秒に変換（基準日付を2000-01-01に固定）
        const requestedTimeMs = isDeparture
          ? new Date(`2000-01-01T${timeStr}`).getTime()
          : new Date(`2000-01-01T${timeStr}`).getTime();

        // 最適なルートを探す
        let bestRouteIndex = 0;

        if (isDeparture) {
          // 出発時刻指定の場合：指定時刻以降の最も早い便を探す
          for (let i = 0; i < sortedRoutes.length; i++) {
            const routeTime = new Date(
              `2000-01-01T${sortedRoutes[i].departure}`
            ).getTime();
            if (routeTime >= requestedTimeMs) {
              bestRouteIndex = i;
              break;
            }
            // 指定時刻以降の便がない場合は最初（最も早い）の便
            bestRouteIndex = 0;
          }
        } else {
          // 到着時刻指定の場合：指定時刻以前の最も遅い便を探す
          for (let i = 0; i < sortedRoutes.length; i++) {
            const routeTime = new Date(
              `2000-01-01T${sortedRoutes[i].arrival}`
            ).getTime();
            if (routeTime <= requestedTimeMs) {
              bestRouteIndex = i;
              break;
            }
            // 指定時刻以前の便がない場合は最後（最も遅い）の便
            bestRouteIndex = sortedRoutes.length - 1;
          }
        }

        // 最適なルートを取得
        const bestRoute = sortedRoutes[bestRouteIndex];

        // 最寄りバス停リストを作成
        const stops = [
          {
            id: from.stop_id,
            name: from.stop_name,
            distance: 0,
            lat: parseFloat(originStop.stop_lat),
            lng: parseFloat(originStop.stop_lon),
          },
          {
            id: to.stop_id,
            name: to.stop_name,
            distance: 0,
            lat: parseFloat(destStop.stop_lat),
            lng: parseFloat(destStop.stop_lon),
          },
        ];

        // 最適なルートのみを返す
        return {
          success: true,
          data: {
            journeys: [bestRoute],
            stops: stops,
          },
        };
      } catch (error: any) {
        console.error("[TransitService] 経路検索クエリエラー:", error);
        throw error;
      }
    } catch (error) {
      console.error("[TransitService] 経路検索エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "経路検索に失敗しました",
        data: { journeys: [], stops: [] },
      };
    }
  }

  /**
   * 乗り換えが必要な経路を検索する
   */
  private async findRouteWithTransfer(
    origin: any,
    destination: any,
    time?: string,
    isDeparture: boolean = true
  ): Promise<TransitResponse> {
    const timeStr = this.formatTime(time ? new Date(time) : new Date());
    const dateStr = time
      ? new Date(time).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    console.log(
      `[TransitService] 乗り換え経路検索: ${
        isDeparture ? "出発" : "到着"
      }時刻 = ${timeStr}`
    );

    // 乗り換え経路を一度のクエリで検索する最適化SQLクエリ
    const sql = isDeparture
      ? `
      WITH origin_stop AS (
        SELECT stop_id, stop_name, stop_lat, stop_lon,
               (((stop_lat - ?) * (stop_lat - ?)) + ((stop_lon - ?) * (stop_lon - ?))) AS distance
        FROM stops 
        ORDER BY distance ASC
        LIMIT 1
      ),
      destination_stop AS (
        SELECT stop_id, stop_name, stop_lat, stop_lon,
               (((stop_lat - ?) * (stop_lat - ?)) + ((stop_lon - ?) * (stop_lon - ?))) AS distance
        FROM stops
        ORDER BY distance ASC
        LIMIT 1
      ),
      valid_services AS (
        SELECT service_id FROM calendar 
        WHERE 
          (
            (strftime('%w', ?) = '1' AND monday = 1) OR
            (strftime('%w', ?) = '2' AND tuesday = 1) OR
            (strftime('%w', ?) = '3' AND wednesday = 1) OR
            (strftime('%w', ?) = '4' AND thursday = 1) OR
            (strftime('%w', ?) = '5' AND friday = 1) OR
            (strftime('%w', ?) = '6' AND saturday = 1) OR
            (strftime('%w', ?) = '0' AND sunday = 1)
          )
          AND start_date <= strftime('%Y%m%d', ?)
          AND end_date >= strftime('%Y%m%d', ?)
      ),
      transfer_stops AS (
        SELECT 
          s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
          (((s.stop_lat - (SELECT stop_lat FROM origin_stop)) * (s.stop_lat - (SELECT stop_lat FROM origin_stop))) + 
           ((s.stop_lon - (SELECT stop_lon FROM origin_stop)) * (s.stop_lon - (SELECT stop_lon FROM origin_stop)))) AS from_origin_distance,
          (((s.stop_lat - (SELECT stop_lat FROM destination_stop)) * (s.stop_lat - (SELECT stop_lat FROM destination_stop))) + 
           ((s.stop_lon - (SELECT stop_lon FROM destination_stop)) * (s.stop_lon - (SELECT stop_lon FROM destination_stop)))) AS to_dest_distance
        FROM stops s
        WHERE s.stop_id != (SELECT stop_id FROM origin_stop)
          AND s.stop_id != (SELECT stop_id FROM destination_stop)
        ORDER BY (from_origin_distance + to_dest_distance) ASC
        LIMIT 10
      ),
      first_leg AS (
        SELECT 
          ts.stop_id as transfer_stop_id, ts.stop_name as transfer_stop_name,
          ts.stop_lat as transfer_stop_lat, ts.stop_lon as transfer_stop_lon,
          o.stop_id as origin_stop_id, o.stop_name as origin_stop_name,
          st1.departure_time as origin_departure,
          st2.arrival_time as transfer_arrival,
          (julianday(st2.arrival_time) - julianday(st1.departure_time)) * 24 * 60 AS first_leg_duration,
          t.trip_id as first_leg_trip, t.route_id as first_leg_route_id,
          r.route_short_name as first_route_short_name, r.route_long_name as first_route_long_name,
          r.route_color as first_route_color, r.route_text_color as first_route_text_color
        FROM transfer_stops ts
        CROSS JOIN origin_stop o
        JOIN stop_times st1 ON o.stop_id = st1.stop_id
        JOIN trips t ON st1.trip_id = t.trip_id
        JOIN routes r ON t.route_id = r.route_id
        JOIN stop_times st2 ON t.trip_id = st2.trip_id AND ts.stop_id = st2.stop_id
        JOIN valid_services vs ON t.service_id = vs.service_id
        WHERE st1.departure_time >= ?
          AND st2.stop_sequence > st1.stop_sequence
        ORDER BY first_leg_duration, st1.departure_time
        LIMIT 20
      ),
      second_leg AS (
        SELECT 
          fl.*,
          d.stop_id as dest_stop_id, d.stop_name as dest_stop_name,
          st3.departure_time as transfer_departure,
          st4.arrival_time as dest_arrival,
          (julianday(st4.arrival_time) - julianday(st3.departure_time)) * 24 * 60 AS second_leg_duration,
          t2.trip_id as second_leg_trip, t2.route_id as second_leg_route_id,
          r2.route_short_name as second_route_short_name, r2.route_long_name as second_route_long_name,
          r2.route_color as second_route_color, r2.route_text_color as second_route_text_color,
          (julianday(st4.arrival_time) - julianday(fl.origin_departure)) * 24 * 60 AS total_duration,
          (julianday(st3.departure_time) - julianday(fl.transfer_arrival)) * 24 * 60 AS transfer_wait_time
        FROM first_leg fl
        CROSS JOIN destination_stop d
        JOIN stop_times st3 ON fl.transfer_stop_id = st3.stop_id
        JOIN trips t2 ON st3.trip_id = t2.trip_id
        JOIN routes r2 ON t2.route_id = r2.route_id
        JOIN stop_times st4 ON t2.trip_id = st4.trip_id AND d.stop_id = st4.stop_id
        JOIN valid_services vs ON t2.service_id = vs.service_id
        WHERE st3.departure_time > fl.transfer_arrival -- 乗り換え待機時間を確保
          AND st4.stop_sequence > st3.stop_sequence
          AND (julianday(st3.departure_time) - julianday(fl.transfer_arrival)) * 24 * 60 BETWEEN 3 AND 60 -- 乗り換え待機時間を3分〜60分に制限
        ORDER BY total_duration ASC, origin_departure ASC
        LIMIT 5
      )
      SELECT * FROM second_leg
    `
      : `
      WITH origin_stop AS (
        SELECT stop_id, stop_name, stop_lat, stop_lon,
               (((stop_lat - ?) * (stop_lat - ?)) + ((stop_lon - ?) * (stop_lon - ?))) AS distance
        FROM stops 
        ORDER BY distance ASC
        LIMIT 1
      ),
      destination_stop AS (
        SELECT stop_id, stop_name, stop_lat, stop_lon,
               (((stop_lat - ?) * (stop_lat - ?)) + ((stop_lon - ?) * (stop_lon - ?))) AS distance
        FROM stops
        ORDER BY distance ASC
        LIMIT 1
      ),
      valid_services AS (
        SELECT service_id FROM calendar 
        WHERE 
          (
            (strftime('%w', ?) = '1' AND monday = 1) OR
            (strftime('%w', ?) = '2' AND tuesday = 1) OR
            (strftime('%w', ?) = '3' AND wednesday = 1) OR
            (strftime('%w', ?) = '4' AND thursday = 1) OR
            (strftime('%w', ?) = '5' AND friday = 1) OR
            (strftime('%w', ?) = '6' AND saturday = 1) OR
            (strftime('%w', ?) = '0' AND sunday = 1)
          )
          AND start_date <= strftime('%Y%m%d', ?)
          AND end_date >= strftime('%Y%m%d', ?)
      ),
      transfer_stops AS (
        SELECT 
          s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
          (((s.stop_lat - (SELECT stop_lat FROM origin_stop)) * (s.stop_lat - (SELECT stop_lat FROM origin_stop))) + 
           ((s.stop_lon - (SELECT stop_lon FROM origin_stop)) * (s.stop_lon - (SELECT stop_lon FROM origin_stop)))) AS from_origin_distance,
          (((s.stop_lat - (SELECT stop_lat FROM destination_stop)) * (s.stop_lat - (SELECT stop_lat FROM destination_stop))) + 
           ((s.stop_lon - (SELECT stop_lon FROM destination_stop)) * (s.stop_lon - (SELECT stop_lon FROM destination_stop)))) AS to_dest_distance
        FROM stops s
        WHERE s.stop_id != (SELECT stop_id FROM origin_stop)
          AND s.stop_id != (SELECT stop_id FROM destination_stop)
        ORDER BY (from_origin_distance + to_dest_distance) ASC
        LIMIT 10
      ),
      second_leg_arrival AS (
        SELECT 
          ts.stop_id as transfer_stop_id, ts.stop_name as transfer_stop_name,
          ts.stop_lat as transfer_stop_lat, ts.stop_lon as transfer_stop_lon,
          d.stop_id as dest_stop_id, d.stop_name as dest_stop_name,
          st3.departure_time as transfer_departure,
          st4.arrival_time as dest_arrival,
          (julianday(st4.arrival_time) - julianday(st3.departure_time)) * 24 * 60 AS second_leg_duration,
          t2.trip_id as second_leg_trip, t2.route_id as second_leg_route_id,
          r2.route_short_name as second_route_short_name, r2.route_long_name as second_route_long_name,
          r2.route_color as second_route_color, r2.route_text_color as second_route_text_color
        FROM transfer_stops ts
        CROSS JOIN destination_stop d
        JOIN stop_times st4 ON d.stop_id = st4.stop_id
        JOIN trips t2 ON st4.trip_id = t2.trip_id
        JOIN routes r2 ON t2.route_id = r2.route_id
        JOIN stop_times st3 ON t2.trip_id = st3.trip_id AND ts.stop_id = st3.stop_id
        JOIN valid_services vs ON t2.service_id = vs.service_id
        WHERE st4.arrival_time <= ?
          AND st3.stop_sequence < st4.stop_sequence
        ORDER BY st4.arrival_time DESC
        LIMIT 20
      ),
      first_leg_arrival AS (
        SELECT 
          sl.*,
          o.stop_id as origin_stop_id, o.stop_name as origin_stop_name,
          st1.departure_time as origin_departure,
          st2.arrival_time as transfer_arrival,
          (julianday(st2.arrival_time) - julianday(st1.departure_time)) * 24 * 60 AS first_leg_duration,
          t.trip_id as first_leg_trip, t.route_id as first_leg_route_id,
          r.route_short_name as first_route_short_name, r.route_long_name as first_route_long_name,
          r.route_color as first_route_color, r.route_text_color as first_route_text_color,
          (julianday(sl.dest_arrival) - julianday(st1.departure_time)) * 24 * 60 AS total_duration,
          (julianday(sl.transfer_departure) - julianday(st2.arrival_time)) * 24 * 60 AS transfer_wait_time
        FROM second_leg_arrival sl
        CROSS JOIN origin_stop o
        JOIN stop_times st1 ON o.stop_id = st1.stop_id
        JOIN trips t ON st1.trip_id = t.trip_id
        JOIN routes r ON t.route_id = r.route_id
        JOIN stop_times st2 ON t.trip_id = st2.trip_id AND sl.transfer_stop_id = st2.stop_id
        JOIN valid_services vs ON t.service_id = vs.service_id
        WHERE st2.arrival_time < sl.transfer_departure
          AND st2.stop_sequence > st1.stop_sequence
          AND (julianday(sl.transfer_departure) - julianday(st2.arrival_time)) * 24 * 60 BETWEEN 3 AND 60 -- 乗り換え待機時間を3分〜60分に制限
        ORDER BY total_duration ASC, dest_arrival DESC
        LIMIT 5
      )
      SELECT * FROM first_leg_arrival
    `;

    try {
      // this.dbを初期化
      await this.initDb();

      if (!this.db) {
        throw new Error("データベース接続が初期化されていません");
      }

      console.log(`[TransitService] 乗り換え経路検索SQLを実行中...`);

      // バインドパラメータの準備
      const params = isDeparture
        ? [
            // origin_stop WHERE部分
            origin.lat,
            origin.lat,
            origin.lng,
            origin.lng,
            // destination_stop WHERE部分
            destination.lat,
            destination.lat,
            destination.lng,
            destination.lng,
            // valid_services WHERE部分（曜日判定）
            dateStr,
            dateStr,
            dateStr,
            dateStr,
            dateStr,
            dateStr,
            dateStr,
            // valid_services WHERE部分（日付範囲判定）
            dateStr,
            dateStr,
            // first_leg WHERE部分（出発時刻制限）
            timeStr,
          ]
        : [
            // origin_stop WHERE部分
            origin.lat,
            origin.lat,
            origin.lng,
            origin.lng,
            // destination_stop WHERE部分
            destination.lat,
            destination.lat,
            destination.lng,
            destination.lng,
            // valid_services WHERE部分（曜日判定）
            dateStr,
            dateStr,
            dateStr,
            dateStr,
            dateStr,
            dateStr,
            dateStr,
            // valid_services WHERE部分（日付範囲判定）
            dateStr,
            dateStr,
            // second_leg_arrival WHERE部分（到着時刻制限）
            timeStr,
          ];

      try {
        // better-sqlite3の同期APIを使用
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);

        if (!rows || rows.length === 0) {
          return {
            success: true,
            data: {
              journeys: [],
              stops: [],
              message: "経路が見つかりませんでした",
            },
          };
        }

        return this.formatRouteResults(rows, true);
      } catch (dbError) {
        console.error("[TransitService] SQLクエリ実行エラー:", dbError);
        throw new Error("乗り換え経路検索クエリの実行中にエラーが発生しました");
      }
    } catch (error) {
      console.error("[TransitService] 乗り換え経路検索エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "経路検索に失敗しました",
        data: { journeys: [], stops: [] },
      };
    }
  }

  /**
   * バス停検索
   */
  private async findStops(query: StopQuery): Promise<TransitResponse> {
    try {
      console.log(
        `[TransitService] バス停検索：${query.name || "位置情報から"}`
      );

      const { location, name, radius = 1 } = query;
      let sql = "";
      let params: any[] = [];

      if (location) {
        // 位置情報からの検索
        sql = `
          SELECT 
            stop_id, stop_name, stop_lat, stop_lon,
            (((stop_lat - ?) * (stop_lat - ?)) + ((stop_lon - ?) * (stop_lon - ?))) AS distance
          FROM stops
          ORDER BY distance ASC
          LIMIT 10
        `;
        params = [location.lat, location.lat, location.lng, location.lng];
      } else if (name) {
        // 名前からの検索
        sql = `
          SELECT 
            stop_id, stop_name, stop_lat, stop_lon
          FROM stops
          WHERE stop_name LIKE ?
          ORDER BY stop_name
          LIMIT 10
        `;
        params = [`%${name}%`];
      } else {
        return {
          success: false,
          error: "検索条件が指定されていません",
          data: { stops: [] },
        };
      }

      // this.dbを初期化
      await this.initDb();

      if (!this.db) {
        throw new Error("データベース接続が初期化されていません");
      }

      try {
        // better-sqlite3の同期APIを使用
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);

        if (!rows || rows.length === 0) {
          return {
            success: true,
            data: { stops: [] },
          };
        }

        return {
          success: true,
          data: {
            stops: rows.map((stop: any) => ({
              id: stop.stop_id,
              name: stop.stop_name,
              lat: stop.stop_lat,
              lng: stop.stop_lon,
              distance: stop.distance
                ? Math.sqrt(stop.distance) * 111.32
                : undefined, // 概算kmに変換
            })),
          },
        };
      } catch (dbError) {
        console.error("[TransitService] SQLクエリ実行エラー:", dbError);
        throw new Error("バス停検索クエリの実行中にエラーが発生しました");
      }
    } catch (error) {
      console.error("[TransitService] バス停検索エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "バス停検索に失敗しました",
        data: { stops: [] },
      };
    }
  }

  /**
   * 時刻表取得
   */
  private async getTimetable(query: TimetableQuery): Promise<TransitResponse> {
    try {
      const { stopId, time } = query;
      console.log(`[TransitService] 時刻表取得：バス停ID ${stopId}`);

      const timeStr = this.formatTime(time ? new Date(time) : new Date());
      const dateStr = time
        ? new Date(time).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const sql = `
        SELECT 
          st.departure_time, st.arrival_time, 
          r.route_id, r.route_short_name, r.route_long_name, r.route_color, r.route_text_color,
          t.trip_headsign, t.direction_id
        FROM stop_times st
        JOIN trips t ON st.trip_id = t.trip_id
        JOIN routes r ON t.route_id = r.route_id
        WHERE st.stop_id = ?
          AND st.departure_time >= ?
          AND t.service_id IN (
            SELECT service_id FROM calendar 
            WHERE 
              (
                (strftime('%w', ?) = '1' AND monday = 1) OR
                (strftime('%w', ?) = '2' AND tuesday = 1) OR
                (strftime('%w', ?) = '3' AND wednesday = 1) OR
                (strftime('%w', ?) = '4' AND thursday = 1) OR
                (strftime('%w', ?) = '5' AND friday = 1) OR
                (strftime('%w', ?) = '6' AND saturday = 1) OR
                (strftime('%w', ?) = '0' AND sunday = 1)
              )
              AND start_date <= strftime('%Y%m%d', ?)
              AND end_date >= strftime('%Y%m%d', ?)
          )
        ORDER BY st.departure_time
        LIMIT 30
      `;

      const params = [
        stopId,
        timeStr,
        dateStr,
        dateStr,
        dateStr,
        dateStr,
        dateStr,
        dateStr,
        dateStr,
        dateStr,
        dateStr,
      ];

      // this.dbを初期化
      await this.initDb();

      if (!this.db) {
        throw new Error("データベース接続が初期化されていません");
      }

      try {
        // better-sqlite3の同期APIを使用
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);

        if (!rows || rows.length === 0) {
          return {
            success: true,
            data: { timetable: [] },
          };
        }

        return {
          success: true,
          data: {
            timetable: rows.map((entry: any) => ({
              departureTime: entry.departure_time,
              arrivalTime: entry.arrival_time,
              routeId: entry.route_id,
              routeName: entry.route_short_name || entry.route_long_name,
              routeShortName: entry.route_short_name || "",
              routeLongName: entry.route_long_name || "",
              routeColor: entry.route_color
                ? `#${entry.route_color}`
                : "#000000",
              routeTextColor: entry.route_text_color
                ? `#${entry.route_text_color}`
                : "#FFFFFF",
              headsign: entry.trip_headsign,
              directionId: entry.direction_id,
            })),
          },
        };
      } catch (dbError) {
        console.error("[TransitService] SQLクエリ実行エラー:", dbError);
        throw new Error("時刻表取得クエリの実行中にエラーが発生しました");
      }
    } catch (error) {
      console.error("[TransitService] 時刻表取得エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "時刻表取得に失敗しました",
        data: { timetable: [] },
      };
    }
  }

  /**
   * 経路検索結果をフォーマットする
   */
  private formatRouteResults(
    results: any[],
    isTransfer: boolean
  ): TransitResponse {
    if (isTransfer) {
      // 乗り換え経路のフォーマット
      return {
        success: true,
        data: {
          journeys: results.map((route: any) => ({
            departure: route.origin_departure,
            arrival: route.dest_arrival,
            duration: Math.round(route.total_duration),
            transfers: 1,
            from: route.origin_stop_name,
            to: route.dest_stop_name,
            route: `${
              route.first_route_short_name || route.first_route_long_name
            } → ${
              route.second_route_short_name || route.second_route_long_name
            }`,
            color: route.first_route_color
              ? `#${route.first_route_color}`
              : "#000000",
            textColor: route.first_route_text_color
              ? `#${route.first_route_text_color}`
              : "#FFFFFF",
            segments: [
              {
                from: route.origin_stop_name,
                to: route.transfer_stop_name,
                departure: route.origin_departure,
                arrival: route.transfer_arrival,
                duration: Math.round(route.first_leg_duration),
                route:
                  route.first_route_short_name || route.first_route_long_name,
                color: route.first_route_color
                  ? `#${route.first_route_color}`
                  : "#000000",
                textColor: route.first_route_text_color
                  ? `#${route.first_route_text_color}`
                  : "#FFFFFF",
              },
              {
                from: route.transfer_stop_name,
                to: route.dest_stop_name,
                departure: route.transfer_departure,
                arrival: route.dest_arrival,
                duration: Math.round(route.second_leg_duration),
                route:
                  route.second_route_short_name || route.second_route_long_name,
                color: route.second_route_color
                  ? `#${route.second_route_color}`
                  : "#000000",
                textColor: route.second_route_text_color
                  ? `#${route.second_route_text_color}`
                  : "#FFFFFF",
              },
            ],
            transferInfo: {
              stop: route.transfer_stop_name,
              waitTime: Math.round(route.transfer_wait_time),
              location: {
                lat: parseFloat(route.transfer_stop_lat),
                lng: parseFloat(route.transfer_stop_lon),
              },
            },
          })),
          stops: [
            {
              id: results[0].origin_stop_id,
              name: results[0].origin_stop_name,
              distance: results[0].origin_distance,
              lat: parseFloat(results[0].origin_stop_lat),
              lng: parseFloat(results[0].origin_stop_lon),
            },
            {
              id: results[0].dest_stop_id,
              name: results[0].dest_stop_name,
              distance: results[0].dest_distance,
              lat: parseFloat(results[0].dest_stop_lat),
              lng: parseFloat(results[0].dest_stop_lon),
            },
          ],
        },
      };
    } else {
      // 直接経路のフォーマット
      return {
        success: true,
        data: {
          journeys: results.map((route: any) => ({
            departure: route.departure_time,
            arrival: route.arrival_time,
            duration: Math.round(route.duration_minutes),
            transfers: 0,
            route: route.route_short_name || route.route_long_name,
            from: route.origin_stop_name,
            to: route.dest_stop_name,
            color: route.route_color ? `#${route.route_color}` : "#000000",
            textColor: route.route_text_color
              ? `#${route.route_text_color}`
              : "#FFFFFF",
          })),
          stops: [
            {
              id: results[0].origin_stop_id,
              name: results[0].origin_stop_name,
              distance: results[0].origin_distance,
              lat: parseFloat(results[0].origin_stop_lat),
              lng: parseFloat(results[0].origin_stop_lon),
            },
            {
              id: results[0].dest_stop_id,
              name: results[0].dest_stop_name,
              distance: results[0].dest_distance,
              lat: parseFloat(results[0].dest_stop_lat),
              lng: parseFloat(results[0].dest_stop_lon),
            },
          ],
        },
      };
    }
  }

  /**
   * 時刻をフォーマットする
   */
  private formatTime(time: Date | string): string {
    const date = typeof time === "string" ? new Date(time) : time;
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}:00`;
  }

  private async findDirectRoute(
    origin: any,
    destination: any,
    time?: string,
    isDeparture: boolean = true
  ): Promise<TransitResponse> {
    const timeStr = this.formatTime(time ? new Date(time) : new Date());
    const dateStr = time
      ? new Date(time).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    console.log(
      `[TransitService] 直行経路検索: ${
        isDeparture ? "出発" : "到着"
      }時刻 = ${timeStr}`
    );

    // 直行経路を一度のクエリで検索する最適化SQLクエリ
    // 出発停留所から目的地停留所まで同一路線で行けるルートを検索
    const sql = isDeparture
      ? `
      WITH valid_services AS (
        SELECT service_id FROM calendar 
        WHERE 
          (
            (strftime('%w', ?) = '1' AND monday = 1) OR
            (strftime('%w', ?) = '2' AND tuesday = 1) OR
            (strftime('%w', ?) = '3' AND wednesday = 1) OR
            (strftime('%w', ?) = '4' AND thursday = 1) OR
            (strftime('%w', ?) = '5' AND friday = 1) OR
            (strftime('%w', ?) = '6' AND saturday = 1) OR
            (strftime('%w', ?) = '0' AND sunday = 1)
          )
          AND start_date <= strftime('%Y%m%d', ?)
          AND end_date >= strftime('%Y%m%d', ?)
      ),
      origin_stop AS (
        SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops WHERE stop_id = ?
      ),
      dest_stop AS (
        SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops WHERE stop_id = ?
      )
      SELECT 
        origin_st.departure_time as departure_time, 
        dest_st.arrival_time as arrival_time,
        t.trip_id, t.route_id, t.trip_headsign, t.direction_id,
        r.route_short_name, r.route_long_name, r.route_color, r.route_text_color,
        os.stop_id as origin_stop_id, os.stop_name as origin_stop_name, 
        os.stop_lat as origin_stop_lat, os.stop_lon as origin_stop_lon,
        ds.stop_id as dest_stop_id, ds.stop_name as dest_stop_name,
        ds.stop_lat as dest_stop_lat, ds.stop_lon as dest_stop_lon,
        (julianday(dest_st.arrival_time) - julianday(origin_st.departure_time)) * 24 * 60 as duration_minutes,
        0 as origin_distance, 0 as dest_distance
      FROM stop_times origin_st
      JOIN stop_times dest_st ON origin_st.trip_id = dest_st.trip_id
      JOIN trips t ON origin_st.trip_id = t.trip_id
      JOIN routes r ON t.route_id = r.route_id
      JOIN valid_services vs ON t.service_id = vs.service_id
      JOIN origin_stop os ON origin_st.stop_id = os.stop_id
      JOIN dest_stop ds ON dest_st.stop_id = ds.stop_id
      WHERE origin_st.stop_id = ?
        AND dest_st.stop_id = ?
        AND origin_st.stop_sequence < dest_st.stop_sequence
        AND origin_st.departure_time >= ?
      ORDER BY origin_st.departure_time
      LIMIT 20
      `
      : `
      WITH valid_services AS (
        SELECT service_id FROM calendar 
        WHERE 
          (
            (strftime('%w', ?) = '1' AND monday = 1) OR
            (strftime('%w', ?) = '2' AND tuesday = 1) OR
            (strftime('%w', ?) = '3' AND wednesday = 1) OR
            (strftime('%w', ?) = '4' AND thursday = 1) OR
            (strftime('%w', ?) = '5' AND friday = 1) OR
            (strftime('%w', ?) = '6' AND saturday = 1) OR
            (strftime('%w', ?) = '0' AND sunday = 1)
          )
          AND start_date <= strftime('%Y%m%d', ?)
          AND end_date >= strftime('%Y%m%d', ?)
      ),
      origin_stop AS (
        SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops WHERE stop_id = ?
      ),
      dest_stop AS (
        SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops WHERE stop_id = ?
      )
      SELECT 
        origin_st.departure_time as departure_time, 
        dest_st.arrival_time as arrival_time,
        t.trip_id, t.route_id, t.trip_headsign, t.direction_id,
        r.route_short_name, r.route_long_name, r.route_color, r.route_text_color,
        os.stop_id as origin_stop_id, os.stop_name as origin_stop_name, 
        os.stop_lat as origin_stop_lat, os.stop_lon as origin_stop_lon,
        ds.stop_id as dest_stop_id, ds.stop_name as dest_stop_name,
        ds.stop_lat as dest_stop_lat, ds.stop_lon as dest_stop_lon,
        (julianday(dest_st.arrival_time) - julianday(origin_st.departure_time)) * 24 * 60 as duration_minutes,
        0 as origin_distance, 0 as dest_distance
      FROM stop_times origin_st
      JOIN stop_times dest_st ON origin_st.trip_id = dest_st.trip_id
      JOIN trips t ON origin_st.trip_id = t.trip_id
      JOIN routes r ON t.route_id = r.route_id
      JOIN valid_services vs ON t.service_id = vs.service_id
      JOIN origin_stop os ON origin_st.stop_id = os.stop_id
      JOIN dest_stop ds ON dest_st.stop_id = ds.stop_id
      WHERE origin_st.stop_id = ?
        AND dest_st.stop_id = ?
        AND origin_st.stop_sequence < dest_st.stop_sequence
        AND dest_st.arrival_time <= ?
      ORDER BY dest_st.arrival_time DESC
      LIMIT 20
      `;

    const params = isDeparture
      ? [
          // valid_services用の日付パラメータ
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          // 出発停留所と目的地停留所のID
          origin.stop_id,
          destination.stop_id,
          // WHERE条件
          origin.stop_id,
          destination.stop_id,
          timeStr,
        ]
      : [
          // valid_services用の日付パラメータ
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          dateStr,
          // 出発停留所と目的地停留所のID
          origin.stop_id,
          destination.stop_id,
          // WHERE条件
          origin.stop_id,
          destination.stop_id,
          timeStr,
        ];

    try {
      // this.dbを初期化
      await this.initDb();

      if (!this.db) {
        throw new Error("データベース接続が初期化されていません");
      }

      try {
        // better-sqlite3の同期APIを使用
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);

        // 結果があれば経路情報として整形して返す
        if (rows && rows.length > 0) {
          // 最初の結果からバス停情報を取得（すべての結果で同じ停留所を使用するため）
          const firstRow = rows[0];
          return {
            success: true,
            data: {
              journeys: rows.map((entry: any) => ({
                departure: entry.departure_time,
                arrival: entry.arrival_time,
                duration: Math.round(entry.duration_minutes),
                transfers: 0,
                route: entry.route_short_name || entry.route_long_name,
                from: entry.origin_stop_name,
                to: entry.dest_stop_name,
                color: entry.route_color ? `#${entry.route_color}` : "#000000",
                textColor: entry.route_text_color
                  ? `#${entry.route_text_color}`
                  : "#FFFFFF",
              })),
              stops: [
                {
                  id: firstRow.origin_stop_id,
                  name: firstRow.origin_stop_name,
                  distance: firstRow.origin_distance,
                  lat: parseFloat(firstRow.origin_stop_lat),
                  lng: parseFloat(firstRow.origin_stop_lon),
                },
                {
                  id: firstRow.dest_stop_id,
                  name: firstRow.dest_stop_name,
                  distance: firstRow.dest_distance,
                  lat: parseFloat(firstRow.dest_stop_lat),
                  lng: parseFloat(firstRow.dest_stop_lon),
                },
              ],
            },
          };
        }

        // 結果がなければ空の結果を返す
        return {
          success: true,
          data: {
            journeys: [],
            stops: [],
            message: "直行便が見つかりませんでした",
          },
        };
      } catch (dbError) {
        console.error("[TransitService] SQLクエリ実行エラー:", dbError);
        throw new Error("直行経路検索クエリの実行中にエラーが発生しました");
      }
    } catch (error) {
      console.error("[TransitService] 直行経路検索エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "経路検索に失敗しました",
        data: { journeys: [], stops: [] },
      };
    }
  }

  /**
   * 最寄りのバス停を検索する
   */
  private async findNearestStop(lat: number, lng: number): Promise<any> {
    const sql = `
      SELECT 
        stop_id, stop_name, stop_lat, stop_lon,
        (((stop_lat - ?) * (stop_lat - ?)) + ((stop_lon - ?) * (stop_lon - ?))) AS distance
      FROM stops
      ORDER BY distance ASC
      LIMIT 1
    `;

    try {
      // this.dbを初期化
      await this.initDb();

      if (!this.db) {
        throw new Error("データベース接続が初期化されていません");
      }

      try {
        // better-sqlite3の同期APIを使用
        const stmt = this.db.prepare(sql);
        const row = stmt.get(lat, lat, lng, lng);
        return row;
      } catch (dbError) {
        console.error("[TransitService] SQLクエリ実行エラー:", dbError);
        throw new Error("バス停検索クエリの実行中にエラーが発生しました");
      }
    } catch (error) {
      console.error("[TransitService] 最寄りバス停検索エラー:", error);
      return null;
    }
  }
}
