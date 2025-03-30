import fs from "fs";
import path from "path";
import { openDb, closeDb } from "gtfs";
import { DateTime } from "luxon";
import {
  TransitQuery,
  RouteQuery,
  StopQuery,
  TimetableQuery,
  TransitResponse,
  RouteResponse,
  StopResponse,
  TimetableResponse,
} from "@/types/transit-api";

// 設定ファイルのパス
const CONFIG_PATH = path.join(process.cwd(), "transit-config.json");

// GTFSデータを保存するための一時ディレクトリ
const GTFS_TEMP_DIR = ".temp";

/**
 * 統合トランジットサービスクラス
 * データベース接続とトランジット関連の全ての機能を単一のクラスで提供
 */
export class TransitService {
  private db: any;
  private config: any = null;
  private static instance: TransitService;
  private isDbInitialized = false;

  /**
   * プライベートコンストラクタでシングルトンパターンを実現
   */
  private constructor() {
    try {
      this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
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
      const dbExists = fs.existsSync(dbPath);

      if (!dbExists || this.config.skipImport === false) {
        console.log("[TransitService] GTFSデータをインポートします...");

        // importGtfs関数がないので、openDb()を使用
        this.db = await openDb(this.config);

        // インポート後に設定ファイルを更新
        if (this.config.skipImport === false) {
          this.config.skipImport = true;
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
          console.log("[TransitService] skipImportをtrueに更新しました");
        }
      } else {
        // 既存のデータベースに接続
        this.db = await openDb(this.config);
      }

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
        await closeDb();
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
  private async findRoute(query: RouteQuery): Promise<RouteResponse> {
    const { origin, destination, time } = query;
    const timeStr = this.formatTime(time ? new Date(time) : new Date());

    // 最適化された単一SQLクエリを使用して経路検索
    const sql = `
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
      available_trips AS (
        SELECT 
          origin_st.trip_id,
          origin_st.departure_time AS origin_departure,
          dest_st.arrival_time AS destination_arrival,
          (julianday(dest_st.arrival_time) - julianday(origin_st.departure_time)) * 24 * 60 AS duration_minutes,
          t.route_id,
          t.trip_headsign,
          t.service_id
        FROM stop_times origin_st
        JOIN stop_times dest_st ON origin_st.trip_id = dest_st.trip_id
        JOIN trips t ON origin_st.trip_id = t.trip_id
        JOIN origin_stop o ON origin_st.stop_id = o.stop_id
        JOIN destination_stop d ON dest_st.stop_id = d.stop_id
        WHERE origin_st.stop_sequence < dest_st.stop_sequence
          AND origin_st.departure_time >= ?
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
        ORDER BY duration_minutes ASC, origin_departure ASC
        LIMIT 5
      )
      SELECT 
        a.*,
        r.route_short_name, r.route_long_name, r.route_color, r.route_text_color,
        o.stop_id as origin_stop_id, o.stop_name as origin_stop_name, o.distance as origin_distance,
        d.stop_id as dest_stop_id, d.stop_name as dest_stop_name, d.distance as dest_distance
      FROM available_trips a
      JOIN routes r ON a.route_id = r.route_id
      JOIN origin_stop o ON 1=1
      JOIN destination_stop d ON 1=1
    `;

    const dateStr = time
      ? new Date(time).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const params = [
      origin.lat,
      origin.lat,
      origin.lng,
      origin.lng,
      destination.lat,
      destination.lat,
      destination.lng,
      destination.lng,
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

    try {
      const results = await this.db.prepare(sql).all(...params);

      if (!results || results.length === 0) {
        // 直接の経路が見つからない場合は乗り換え経路を検索
        const transferResults = await this.findRouteWithTransfer(
          origin,
          destination,
          time
        );
        return transferResults;
      }

      return this.formatRouteResults(results, false);
    } catch (error) {
      console.error("[TransitService] 経路検索クエリエラー:", error);
      throw error;
    }
  }

  /**
   * 乗り換えが必要な経路を検索する
   */
  private async findRouteWithTransfer(
    origin: any,
    destination: any,
    time?: string
  ): Promise<RouteResponse> {
    const timeStr = this.formatTime(time ? new Date(time) : new Date());
    const dateStr = time
      ? new Date(time).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // 乗り換え経路を一度のクエリで検索する最適化SQLクエリ
    const sql = `
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
    `;

    const params = [
      origin.lat,
      origin.lat,
      origin.lng,
      origin.lng,
      destination.lat,
      destination.lat,
      destination.lng,
      destination.lng,
      dateStr,
      dateStr,
      dateStr,
      dateStr,
      dateStr,
      dateStr,
      dateStr,
      dateStr,
      dateStr,
      timeStr,
    ];

    try {
      const results = await this.db.prepare(sql).all(...params);

      if (!results || results.length === 0) {
        return {
          success: true,
          data: {
            journeys: [],
            stops: [],
            message: "経路が見つかりませんでした",
          },
        };
      }

      return this.formatRouteResults(results, true);
    } catch (error) {
      console.error("[TransitService] 乗り換え経路検索クエリエラー:", error);
      throw error;
    }
  }

  /**
   * バス停検索を処理する
   */
  private async findStops(query: StopQuery): Promise<StopResponse> {
    // 位置情報による検索か名前による検索かを判断
    if (query.location) {
      const { lat, lng } = query.location;
      const radius = query.radius || 1; // デフォルト1km半径

      const sql = `
        SELECT 
          stop_id, stop_name, stop_lat, stop_lon,
          (((stop_lat - ?) * (stop_lat - ?)) + ((stop_lon - ?) * (stop_lon - ?))) * 111.32 AS distance
        FROM stops
        WHERE ((stop_lat - ?) * (stop_lat - ?)) + ((stop_lon - ?) * (stop_lon - ?)) < ? * ? / (111.32 * 111.32)
        ORDER BY distance ASC
        LIMIT 20
      `;

      const params = [lat, lat, lng, lng, lat, lat, lng, lng, radius, radius];

      const results = await this.db.prepare(sql).all(...params);

      return {
        success: true,
        data: {
          stops: results.map((stop: any) => ({
            id: stop.stop_id,
            name: stop.stop_name,
            lat: parseFloat(stop.stop_lat),
            lng: parseFloat(stop.stop_lon),
            distance: parseFloat(stop.distance.toFixed(2)),
          })),
        },
      };
    } else if (query.name) {
      // 名前による検索
      const name = query.name;

      const sql = `
        SELECT stop_id, stop_name, stop_lat, stop_lon
        FROM stops
        WHERE stop_name LIKE ?
        ORDER BY stop_name
        LIMIT 20
      `;

      const results = await this.db.prepare(sql).all(`%${name}%`);

      return {
        success: true,
        data: {
          stops: results.map((stop: any) => ({
            id: stop.stop_id,
            name: stop.stop_name,
            lat: parseFloat(stop.stop_lat),
            lng: parseFloat(stop.stop_lon),
          })),
        },
      };
    } else {
      throw new Error("検索パラメータが指定されていません");
    }
  }

  /**
   * 時刻表を取得する
   */
  private async getTimetable(
    query: TimetableQuery
  ): Promise<TimetableResponse> {
    const { stopId, time } = query;
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
      LIMIT 50
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

    const results = await this.db.prepare(sql).all(...params);

    return {
      success: true,
      data: {
        timetable: results.map((entry: any) => ({
          departureTime: entry.departure_time,
          arrivalTime: entry.arrival_time,
          routeId: entry.route_id,
          routeName: entry.route_short_name || entry.route_long_name,
          routeShortName: entry.route_short_name || "",
          routeLongName: entry.route_long_name || "",
          routeColor: entry.route_color ? `#${entry.route_color}` : "#000000",
          routeTextColor: entry.route_text_color
            ? `#${entry.route_text_color}`
            : "#FFFFFF",
          headsign: entry.trip_headsign,
          directionId: entry.direction_id,
        })),
      },
    };
  }

  /**
   * 経路検索結果をフォーマットする
   */
  private formatRouteResults(
    results: any[],
    isTransfer: boolean
  ): RouteResponse {
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
            },
            {
              id: results[0].dest_stop_id,
              name: results[0].dest_stop_name,
              distance: results[0].dest_distance,
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
            departure: route.origin_departure,
            arrival: route.destination_arrival,
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
            },
            {
              id: results[0].dest_stop_id,
              name: results[0].dest_stop_name,
              distance: results[0].dest_distance,
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
}
