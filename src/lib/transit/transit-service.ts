import { Prisma } from "@prisma/client";
import {
  TransitQuery,
  RouteQuery,
  StopQuery,
  TimetableQuery,
  TransitResponse,
} from "@/types/transit-api";
import { loadConfig, TransitConfig } from "../config/config";
import { prisma } from "../db/prisma";
import { logger } from "@/utils/logger";

// 型定義をクラス外部に配置
export interface StopLocation {
  lat: number;
  lng: number;
  stop_id: string;
  stop_name: string;
}

// Journeyとその関連型の定義
export interface RouteJourney {
  departure: string;
  arrival: string;
  duration: number;
  transfers: number;
  route?: string;
  from: string;
  to: string;
  color?: string;
  textColor?: string;
  segments?: RouteSegment[];
  transferInfo?: TransferInfo;
}

export interface RouteSegment {
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: number;
  route: string;
  color?: string;
  textColor?: string;
}

export interface TransferInfo {
  stop: string;
  waitTime: number;
  location: {
    lat: number;
    lng: number;
  };
}

// Prismaの型定義
export type PrismaStopTime = Prisma.StopTimeGetPayload<{
  include: {
    trip: {
      include: {
        route: true;
      };
    };
  };
}>;

// 直行経路の結果型定義
export interface DirectRouteResult {
  origin_stop_time: PrismaStopTime;
  dest_stop_time: Prisma.StopTimeGetPayload<{
    include?: {
      trip?: {
        include?: {
          route?: true;
        };
      };
    };
  }>;
}

export interface TransferRouteResult {
  // 第1区間
  origin_stop_id: string;
  origin_stop_name: string;
  origin_stop_lat: number;
  origin_stop_lon: number;
  origin_departure: string | null;
  first_leg_trip: string;
  first_leg_route_id: string;
  first_route_short_name: string | null;
  first_route_long_name: string | null;
  first_route_color: string | null;
  first_route_text_color: string | null;

  // 乗り換え停留所
  transfer_stop_id: string;
  transfer_stop_name: string;
  transfer_stop_lat: number;
  transfer_stop_lon: number;
  transfer_arrival: string | null;
  transfer_departure: string | null;
  transfer_wait_time: number;

  // 第2区間
  dest_stop_id: string;
  dest_stop_name: string;
  dest_stop_lat: number;
  dest_stop_lon: number;
  dest_arrival: string | null;
  second_leg_trip: string;
  second_leg_route_id: string;
  second_route_short_name: string | null;
  second_route_long_name: string | null;
  second_route_color: string | null;
  second_route_text_color: string | null;

  // 所要時間
  first_leg_duration: number;
  second_leg_duration: number;
  total_duration: number;
}

/**
 * 統合トランジットサービスクラス
 * Prisma ORMを使用してデータベース操作を行い、トランジット関連の全ての機能を提供
 */
export class TransitService {
  private config: TransitConfig;
  private static instance: TransitService;
  private isDbInitialized = false;

  /**
   * プライベートコンストラクタでシングルトンパターンを実現
   */
  private constructor() {
    try {
      this.config = loadConfig();
      logger.log("[TransitService] 設定ファイルを読み込みました");
    } catch (error) {
      logger.error(
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
   * データベース初期化
   * Prismaではコネクションプールが自動的に管理されるため、明示的な初期化は不要
   * 代わりにデータベースが利用可能かどうかをチェック
   */
  private async checkDatabase(): Promise<void> {
    if (this.isDbInitialized) {
      return;
    }

    try {
      logger.log("[TransitService] データベース接続を確認しています...");

      // 簡単なクエリを実行してデータベース接続を確認
      const count = await prisma.stop.count();

      logger.log(
        `[TransitService] データベース接続OK、${count}件のバス停データが存在します`
      );
      this.isDbInitialized = true;
    } catch (error) {
      logger.error("[TransitService] データベース接続エラー:", error);
      throw new Error("データベースに接続できませんでした");
    }
  }

  /**
   * トランジットクエリを処理する単一エントリーポイント
   * @param query トランジットクエリオブジェクト
   * @returns クエリ結果
   */
  public async process(query: TransitQuery): Promise<TransitResponse> {
    try {
      await this.checkDatabase();

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
      logger.error(
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
   * バス停検索
   */
  private async findStops(query: StopQuery): Promise<TransitResponse> {
    try {
      logger.log(
        `[TransitService] バス停検索：${query.name || "位置情報から"}`
      );

      const { location, name, radius = 1 } = query;

      if (location) {
        // 位置情報からの検索
        // Prismaを使用して位置情報に基づく近いバス停を検索
        const stops = await prisma.stop.findMany({
          select: {
            id: true,
            name: true,
            lat: true,
            lon: true,
          },
          orderBy: {
            // 緯度経度の差の二乗和でソート
            // SQLiteでは複雑な計算式を直接ソートできないため、JavaScriptで計算
          },
          take: 10,
        });

        // 距離計算をJavaScriptで実施
        const stopsWithDistance = stops.map((stop) => {
          const latDiff = stop.lat - location.lat;
          const lngDiff = stop.lon - location.lng;
          const distance =
            Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111.32; // km換算の概算

          return {
            id: stop.id,
            name: stop.name,
            lat: stop.lat,
            lng: stop.lon,
            distance,
          };
        });

        // 距離でソートして必要な分だけ返す
        const sortedStops = stopsWithDistance
          .sort((a, b) => a.distance - b.distance)
          .filter((stop) => stop.distance <= radius)
          .slice(0, 10);

        return {
          success: true,
          data: {
            stops: sortedStops,
          },
        };
      } else if (name) {
        // 名前からの検索
        const stops = await prisma.stop.findMany({
          where: {
            name: {
              contains: name,
            },
          },
          select: {
            id: true,
            name: true,
            lat: true,
            lon: true,
          },
          orderBy: {
            name: "asc",
          },
          take: 10,
        });

        return {
          success: true,
          data: {
            stops: stops.map((stop) => ({
              id: stop.id,
              name: stop.name,
              lat: stop.lat,
              lng: stop.lon,
            })),
          },
        };
      } else {
        return {
          success: false,
          error: "検索条件が指定されていません",
          data: { stops: [] },
        };
      }
    } catch (error) {
      logger.error("[TransitService] バス停検索エラー:", error);
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
      logger.log(`[TransitService] 時刻表取得：バス停ID ${stopId}`);

      const timeStr = this.formatTime(time ? new Date(time) : new Date());
      const dateObj = time ? new Date(time) : new Date();
      const dayOfWeek = dateObj.getDay(); // 0: 日曜日, 1: 月曜日, ...

      // 現在の日付をYYYYMMDD形式に変換
      const dateStr = dateObj.toISOString().split("T")[0].replace(/-/g, "");

      // Prismaを使用して時刻表データを取得
      const stopTimes = await prisma.stopTime.findMany({
        where: {
          stop_id: stopId,
          departure_time: {
            gte: timeStr,
          },
          trip: {
            service_id: {
              in: await this.getActiveServiceIds(dayOfWeek, dateStr),
            },
          },
        },
        include: {
          trip: {
            include: {
              route: true,
            },
          },
        },
        orderBy: {
          departure_time: "asc",
        },
        take: 30,
      });

      if (stopTimes.length === 0) {
        return {
          success: true,
          data: { timetable: [] },
        };
      }

      return {
        success: true,
        data: {
          timetable: stopTimes.map((entry) => ({
            departureTime: entry.departure_time || "",
            arrivalTime: entry.arrival_time || "",
            routeId: entry.trip.route_id,
            routeName:
              entry.trip.route.short_name || entry.trip.route.long_name || "",
            routeShortName: entry.trip.route.short_name || "",
            routeLongName: entry.trip.route.long_name || "",
            routeColor: entry.trip.route.color
              ? `#${entry.trip.route.color}`
              : "#000000",
            routeTextColor: entry.trip.route.text_color
              ? `#${entry.trip.route.text_color}`
              : "#FFFFFF",
            headsign: entry.trip.headsign,
            directionId: entry.trip.direction_id,
          })),
        },
      };
    } catch (error) {
      logger.error("[TransitService] 時刻表取得エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "時刻表取得に失敗しました",
        data: { timetable: [] },
      };
    }
  }

  /**
   * 最寄りのバス停を検索する
   * @param lat 緯度
   * @param lng 経度
   * @returns 最寄りのバス停情報または null
   */
  private async findNearestStop(
    lat: number,
    lng: number
  ): Promise<{
    stop_id: string;
    stop_name: string;
    stop_lat: number;
    stop_lon: number;
  } | null> {
    try {
      // すべてのバス停を取得
      const stops = await prisma.stop.findMany({
        select: {
          id: true,
          name: true,
          lat: true,
          lon: true,
        },
      });

      if (stops.length === 0) {
        return null;
      }

      // JavaScript側で距離計算と並べ替えを行う
      const stopsWithDistance = stops.map((stop) => {
        const latDiff = stop.lat - lat;
        const lonDiff = stop.lon - lng;
        const distance = latDiff * latDiff + lonDiff * lonDiff; // 平方距離（並べ替えだけなので平方根は不要）

        return {
          stop_id: stop.id,
          stop_name: stop.name,
          stop_lat: stop.lat,
          stop_lon: stop.lon,
          distance,
        };
      });

      // 距離でソートして最も近いバス停を返す
      const nearest = stopsWithDistance.sort(
        (a, b) => a.distance - b.distance
      )[0];

      return {
        stop_id: nearest.stop_id,
        stop_name: nearest.stop_name,
        stop_lat: nearest.stop_lat,
        stop_lon: nearest.stop_lon,
      };
    } catch (error) {
      logger.error("[TransitService] 最寄りバス停検索エラー:", error);
      return null;
    }
  }

  /**
   * 指定された曜日と日付で有効なサービスIDを取得
   */
  private async getActiveServiceIds(
    dayOfWeek: number,
    dateStr: string
  ): Promise<string[]> {
    try {
      // 曜日のフィールド名をマッピング
      const dayFields = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];

      const field = dayFields[dayOfWeek];

      // 通常のカレンダールールに基づくサービスIDを取得
      const calendars = await prisma.calendar.findMany({
        where: {
          [field]: 1,
          start_date: {
            lte: dateStr,
          },
          end_date: {
            gte: dateStr,
          },
        },
        select: {
          service_id: true,
        },
      });

      // カレンダー日付の例外を取得
      const calendarDates = await prisma.calendarDate.findMany({
        where: {
          date: dateStr,
        },
        select: {
          service_id: true,
          exception_type: true,
        },
      });

      // 基本的なサービスID
      const serviceIds = new Set(
        calendars.map((calendar) => calendar.service_id)
      );

      // 例外処理
      calendarDates.forEach((date) => {
        if (date.exception_type === 1) {
          // 追加されるサービス
          serviceIds.add(date.service_id);
        } else if (date.exception_type === 2) {
          // 削除されるサービス
          serviceIds.delete(date.service_id);
        }
      });

      return Array.from(serviceIds);
    } catch (error) {
      logger.error("[TransitService] サービスID取得エラー:", error);
      return [];
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

  /**
   * 経路検索を処理する
   * 出発地点と目的地点の座標から最適な経路を検索
   */
  private async findRoute(query: RouteQuery): Promise<TransitResponse> {
    try {
      const { origin, destination, time, isDeparture = true } = query;

      logger.log(
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

      const from: StopLocation = {
        ...origin,
        stop_id: originStop.stop_id,
        stop_name: originStop.stop_name,
      };

      const to: StopLocation = {
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
        let allRoutes: RouteJourney[] = [];

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

        // 直行便がない場合のみ乗り換え経路を検索
        let transferResults: TransitResponse = {
          success: true,
          data: { journeys: [], stops: [] },
        };

        if (allRoutes.length === 0) {
          transferResults = await this.findRouteWithTransfer(
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
                  lat: originStop.stop_lat,
                  lng: originStop.stop_lon,
                },
                {
                  id: to.stop_id,
                  name: to.stop_name,
                  distance: 0,
                  lat: destStop.stop_lat,
                  lng: destStop.stop_lon,
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
        const requestedTimeMs = new Date(`2000-01-01T${timeStr}`).getTime();

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
          }
          // 指定時刻以降の便がない場合は最初（最も早い）の便
          if (
            bestRouteIndex === 0 &&
            sortedRoutes.length > 0 &&
            new Date(`2000-01-01T${sortedRoutes[0].departure}`).getTime() <
              requestedTimeMs
          ) {
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
          }
          // 指定時刻以前の便がない場合は最後（最も遅い）の便
          if (
            bestRouteIndex === 0 &&
            sortedRoutes.length > 0 &&
            new Date(`2000-01-01T${sortedRoutes[0].arrival}`).getTime() >
              requestedTimeMs
          ) {
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
            lat: originStop.stop_lat,
            lng: originStop.stop_lon,
          },
          {
            id: to.stop_id,
            name: to.stop_name,
            distance: 0,
            lat: destStop.stop_lat,
            lng: destStop.stop_lon,
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
      } catch (error) {
        logger.error("[TransitService] 経路検索クエリエラー:", error);
        throw error;
      }
    } catch (error) {
      logger.error("[TransitService] 経路検索エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "経路検索に失敗しました",
        data: { journeys: [], stops: [] },
      };
    }
  }

  /**
   * 直行経路を検索する
   */
  private async findDirectRoute(
    origin: StopLocation,
    destination: StopLocation,
    time?: string,
    isDeparture: boolean = true
  ): Promise<TransitResponse> {
    const timeStr = this.formatTime(time ? new Date(time) : new Date());
    const dateObj = time ? new Date(time) : new Date();
    const dayOfWeek = dateObj.getDay(); // 0: 日曜日, 1: 月曜日, ...

    // 現在の日付をYYYYMMDD形式に変換
    const dateStr = dateObj.toISOString().split("T")[0].replace(/-/g, "");

    logger.log(
      `[TransitService] 直行経路検索: ${
        isDeparture ? "出発" : "到着"
      }時刻 = ${timeStr}`
    );

    try {
      // 有効なサービスIDを取得
      const activeServiceIds = await this.getActiveServiceIds(
        dayOfWeek,
        dateStr
      );

      if (activeServiceIds.length === 0) {
        return {
          success: true,
          data: {
            journeys: [],
            stops: [],
            message: "本日の運行予定がありません",
          },
        };
      }

      // 直行経路検索のロジック
      // 同じtrip_idで出発停留所と目的地停留所を通る便を探す
      const directRoutes: DirectRouteResult[] = [];

      // 出発停留所を通る停留所時刻を取得
      const originStopTimes = await prisma.stopTime.findMany({
        where: {
          stop_id: origin.stop_id,
          ...(isDeparture ? { departure_time: { gte: timeStr } } : {}),
          trip: {
            service_id: {
              in: activeServiceIds,
            },
          },
        },
        include: {
          trip: {
            include: {
              route: true,
            },
          },
        },
        orderBy: {
          departure_time: isDeparture ? "asc" : "desc",
        },
        take: 20, // 検索対象を増やして多くのルートを見つけられるようにする
      });

      // 各出発停留所時刻に対して、同じトリップで目的地停留所に到着する時刻を探す
      for (const originStopTime of originStopTimes) {
        const destStopTime = await prisma.stopTime.findFirst({
          where: {
            trip_id: originStopTime.trip_id,
            stop_id: destination.stop_id,
            stop_sequence: {
              gt: originStopTime.stop_sequence,
            },
          },
          include: {
            trip: {
              include: {
                route: true,
              },
            },
          },
        });

        if (destStopTime) {
          // 到着時刻指定の場合、指定時刻以前の便のみを対象にする
          if (
            !isDeparture &&
            destStopTime.arrival_time &&
            destStopTime.arrival_time > timeStr
          ) {
            continue;
          }

          // 一致する経路が見つかった
          const combinedRoute = {
            origin_stop_time: originStopTime,
            dest_stop_time: destStopTime,
          };

          directRoutes.push(combinedRoute);

          // 十分な数の経路が見つかったら終了
          if (directRoutes.length >= 20) {
            break;
          }
        }
      }

      // 結果があれば経路情報として整形して返す
      if (directRoutes.length > 0) {
        const formattedRoutes = directRoutes.map((route) => {
          const originST = route.origin_stop_time;
          const destST = route.dest_stop_time;
          const originTrip = originST.trip;

          // 所要時間を計算（分単位）
          const departureTime = new Date(
            `2000-01-01T${originST.departure_time}`
          );
          const arrivalTime = new Date(`2000-01-01T${destST.arrival_time}`);
          const durationMinutes =
            (arrivalTime.getTime() - departureTime.getTime()) / (60 * 1000);

          return {
            departure: originST.departure_time,
            arrival: destST.arrival_time,
            duration: Math.round(durationMinutes),
            transfers: 0,
            route: originTrip.route.short_name || originTrip.route.long_name,
            routeId: originTrip.route_id,
            from: origin.stop_name,
            to: destination.stop_name,
            headsign: originTrip.headsign,
            directionId: originTrip.direction_id,
            color: originTrip.route.color
              ? `#${originTrip.route.color}`
              : "#000000",
            textColor: originTrip.route.text_color
              ? `#${originTrip.route.text_color}`
              : "#FFFFFF",
          };
        });

        // 最寄りバス停情報
        const originStop = await prisma.stop.findUnique({
          where: { id: origin.stop_id },
          select: {
            id: true,
            name: true,
            lat: true,
            lon: true,
          },
        });

        const destStop = await prisma.stop.findUnique({
          where: { id: destination.stop_id },
          select: {
            id: true,
            name: true,
            lat: true,
            lon: true,
          },
        });

        const stops = [
          {
            id: origin.stop_id,
            name: origin.stop_name,
            distance: 0,
            lat: originStop?.lat || 0,
            lng: originStop?.lon || 0,
          },
          {
            id: destination.stop_id,
            name: destination.stop_name,
            distance: 0,
            lat: destStop?.lat || 0,
            lng: destStop?.lon || 0,
          },
        ];

        return {
          success: true,
          data: {
            journeys: formattedRoutes,
            stops,
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
    } catch (error) {
      logger.error("[TransitService] 直行経路検索エラー:", error);
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
    origin: StopLocation,
    destination: StopLocation,
    time?: string,
    isDeparture: boolean = true
  ): Promise<TransitResponse> {
    const timeStr = this.formatTime(time ? new Date(time) : new Date());
    const dateObj = time ? new Date(time) : new Date();
    const dayOfWeek = dateObj.getDay(); // 0: 日曜日, 1: 月曜日, ...

    // 現在の日付をYYYYMMDD形式に変換
    const dateStr = dateObj.toISOString().split("T")[0].replace(/-/g, "");

    logger.log(
      `[TransitService] 乗り換え経路検索: ${
        isDeparture ? "出発" : "到着"
      }時刻 = ${timeStr}`
    );

    try {
      // 有効なサービスIDを取得
      const activeServiceIds = await this.getActiveServiceIds(
        dayOfWeek,
        dateStr
      );

      if (activeServiceIds.length === 0) {
        return {
          success: true,
          data: {
            journeys: [],
            stops: [],
            message: "本日の運行予定がありません",
          },
        };
      }

      // 出発地と目的地の停留所情報を取得
      const originStop = await prisma.stop.findUnique({
        where: { id: origin.stop_id },
        select: {
          id: true,
          name: true,
          lat: true,
          lon: true,
        },
      });

      const destStop = await prisma.stop.findUnique({
        where: { id: destination.stop_id },
        select: {
          id: true,
          name: true,
          lat: true,
          lon: true,
        },
      });

      if (!originStop || !destStop) {
        return {
          success: false,
          error: "停留所情報が見つかりませんでした",
          data: { journeys: [], stops: [] },
        };
      }

      // 乗り換え候補となる停留所を選定
      // 出発地と目的地の中間に位置する停留所を探す
      const transferStops = await prisma.stop.findMany({
        where: {
          // 出発地と目的地は除外
          id: {
            notIn: [origin.stop_id, destination.stop_id],
          },
        },
        select: {
          id: true,
          name: true,
          lat: true,
          lon: true,
        },
        take: 20,
      });

      // 各乗り換え停留所の出発地と目的地からの距離を計算
      const transferStopsWithDistance = transferStops.map((stop) => {
        const fromOriginLatDiff = stop.lat - originStop.lat;
        const fromOriginLonDiff = stop.lon - originStop.lon;
        const fromOriginDistance = Math.sqrt(
          fromOriginLatDiff * fromOriginLatDiff +
            fromOriginLonDiff * fromOriginLonDiff
        );

        const toDestLatDiff = stop.lat - destStop.lat;
        const toDestLonDiff = stop.lon - destStop.lon;
        const toDestDistance = Math.sqrt(
          toDestLatDiff * toDestLatDiff + toDestLonDiff * toDestLonDiff
        );

        // 出発地と目的地からの距離の合計
        const totalDistance = fromOriginDistance + toDestDistance;

        return {
          ...stop,
          fromOriginDistance,
          toDestDistance,
          totalDistance,
        };
      });

      // 乗り換え停留所を総距離の昇順でソート
      const sortedTransferStops = transferStopsWithDistance
        .sort((a, b) => a.totalDistance - b.totalDistance)
        .slice(0, 10); // 最も近い10個の停留所のみ使用

      // 乗り換え経路の検索結果
      const transferRoutes: TransferRouteResult[] = [];

      if (isDeparture) {
        // 出発時刻指定の場合の検索ロジック

        // 第1区間: 出発地から各乗り換え停留所までの経路
        for (const transferStop of sortedTransferStops) {
          // 出発地から乗り換え停留所への経路を検索
          const firstLegStopTimes = await prisma.stopTime.findMany({
            where: {
              stop_id: origin.stop_id,
              departure_time: {
                gte: timeStr,
              },
              trip: {
                service_id: {
                  in: activeServiceIds,
                },
              },
            },
            include: {
              trip: {
                include: {
                  route: true,
                },
              },
            },
            orderBy: {
              departure_time: "asc",
            },
            take: 10,
          });

          for (const originStopTime of firstLegStopTimes) {
            // 同じトリップで乗り換え停留所に到着する便を探す
            const transferArrival = await prisma.stopTime.findFirst({
              where: {
                trip_id: originStopTime.trip_id,
                stop_id: transferStop.id,
                stop_sequence: {
                  gt: originStopTime.stop_sequence,
                },
              },
              include: {
                trip: {
                  include: {
                    route: true,
                  },
                },
              },
            });

            if (transferArrival) {
              // 乗り換え停留所から第2区間を検索
              const transferDepartures = await prisma.stopTime.findMany({
                where: {
                  stop_id: transferStop.id,
                  departure_time: {
                    gt: transferArrival.arrival_time || "",
                  },
                  trip: {
                    service_id: {
                      in: activeServiceIds,
                    },
                  },
                },
                include: {
                  trip: {
                    include: {
                      route: true,
                    },
                  },
                },
                orderBy: {
                  departure_time: "asc",
                },
                take: 5,
              });

              for (const transferDeparture of transferDepartures) {
                // 乗り換え時間が適切か確認（3分〜60分）
                const transferArrivalTime = new Date(
                  `2000-01-01T${transferArrival.arrival_time || ""}`
                );
                const transferDepartureTime = new Date(
                  `2000-01-01T${transferDeparture.departure_time || ""}`
                );
                const waitTimeMinutes =
                  (transferDepartureTime.getTime() -
                    transferArrivalTime.getTime()) /
                  (60 * 1000);

                if (waitTimeMinutes < 1 || waitTimeMinutes > 120) {
                  continue;
                }

                // 同じトリップで目的地に到着する便を探す
                const destArrival = await prisma.stopTime.findFirst({
                  where: {
                    trip_id: transferDeparture.trip_id,
                    stop_id: destination.stop_id,
                    stop_sequence: {
                      gt: transferDeparture.stop_sequence,
                    },
                  },
                  include: {
                    trip: {
                      include: {
                        route: true,
                      },
                    },
                  },
                });

                if (destArrival) {
                  // 乗り換え経路が見つかった
                  transferRoutes.push({
                    // 第1区間
                    origin_stop_id: origin.stop_id,
                    origin_stop_name: origin.stop_name,
                    origin_stop_lat: originStop.lat,
                    origin_stop_lon: originStop.lon,
                    origin_departure: originStopTime.departure_time,
                    first_leg_trip: originStopTime.trip_id,
                    first_leg_route_id: originStopTime.trip.route_id,
                    first_route_short_name:
                      originStopTime.trip.route.short_name,
                    first_route_long_name: originStopTime.trip.route.long_name,
                    first_route_color: originStopTime.trip.route.color,
                    first_route_text_color:
                      originStopTime.trip.route.text_color,

                    // 乗り換え停留所
                    transfer_stop_id: transferStop.id,
                    transfer_stop_name: transferStop.name,
                    transfer_stop_lat: transferStop.lat,
                    transfer_stop_lon: transferStop.lon,
                    transfer_arrival: transferArrival.arrival_time,
                    transfer_departure: transferDeparture.departure_time,
                    transfer_wait_time: waitTimeMinutes,

                    // 第2区間
                    dest_stop_id: destination.stop_id,
                    dest_stop_name: destination.stop_name,
                    dest_stop_lat: destStop.lat,
                    dest_stop_lon: destStop.lon,
                    dest_arrival: destArrival.arrival_time,
                    second_leg_trip: transferDeparture.trip_id,
                    second_leg_route_id: transferDeparture.trip.route_id,
                    second_route_short_name:
                      transferDeparture.trip.route.short_name,
                    second_route_long_name:
                      transferDeparture.trip.route.long_name,
                    second_route_color: transferDeparture.trip.route.color,
                    second_route_text_color:
                      transferDeparture.trip.route.text_color,

                    // 所要時間計算
                    first_leg_duration: this.calculateDurationMinutes(
                      originStopTime.departure_time || "",
                      transferArrival.arrival_time || ""
                    ),
                    second_leg_duration: this.calculateDurationMinutes(
                      transferDeparture.departure_time || "",
                      destArrival.arrival_time || ""
                    ),
                    total_duration: this.calculateDurationMinutes(
                      originStopTime.departure_time || "",
                      destArrival.arrival_time || ""
                    ),
                  });

                  // 十分な数の経路が見つかったら終了
                  if (transferRoutes.length >= 5) {
                    break;
                  }
                }
              }

              if (transferRoutes.length >= 5) {
                break;
              }
            }
          }

          if (transferRoutes.length >= 5) {
            break;
          }
        }
      } else {
        // 到着時刻指定の場合の検索ロジック

        // 第2区間: 各乗り換え停留所から目的地までの経路
        for (const transferStop of sortedTransferStops) {
          // 乗り換え停留所から目的地への経路を検索
          const secondLegStopTimes = await prisma.stopTime.findMany({
            where: {
              stop_id: destination.stop_id,
              arrival_time: {
                lte: timeStr,
              },
              trip: {
                service_id: {
                  in: activeServiceIds,
                },
              },
            },
            include: {
              trip: {
                include: {
                  route: true,
                },
              },
            },
            orderBy: {
              arrival_time: "desc",
            },
            take: 5,
          });

          for (const destStopTime of secondLegStopTimes) {
            // 同じトリップで乗り換え停留所から出発する便を探す
            const transferDeparture = await prisma.stopTime.findFirst({
              where: {
                trip_id: destStopTime.trip_id,
                stop_id: transferStop.id,
                stop_sequence: {
                  lt: destStopTime.stop_sequence,
                },
              },
              include: {
                trip: {
                  include: {
                    route: true,
                  },
                },
              },
            });

            if (transferDeparture) {
              // 乗り換え停留所への第1区間を検索
              const transferArrivals = await prisma.stopTime.findMany({
                where: {
                  stop_id: transferStop.id,
                  arrival_time: {
                    lt: transferDeparture.departure_time || "",
                  },
                  trip: {
                    service_id: {
                      in: activeServiceIds,
                    },
                  },
                },
                include: {
                  trip: {
                    include: {
                      route: true,
                    },
                  },
                },
                orderBy: {
                  arrival_time: "desc",
                },
                take: 5,
              });

              for (const transferArrival of transferArrivals) {
                // 乗り換え時間が適切か確認（3分〜60分）
                const transferArrivalTime = new Date(
                  `2000-01-01T${transferArrival.arrival_time || ""}`
                );
                const transferDepartureTime = new Date(
                  `2000-01-01T${transferDeparture.departure_time || ""}`
                );
                const waitTimeMinutes =
                  (transferDepartureTime.getTime() -
                    transferArrivalTime.getTime()) /
                  (60 * 1000);

                if (waitTimeMinutes < 1 || waitTimeMinutes > 120) {
                  continue;
                }

                // 同じトリップで出発地から出発する便を探す
                const originDeparture = await prisma.stopTime.findFirst({
                  where: {
                    trip_id: transferArrival.trip_id,
                    stop_id: origin.stop_id,
                    stop_sequence: {
                      lt: transferArrival.stop_sequence,
                    },
                  },
                  include: {
                    trip: {
                      include: {
                        route: true,
                      },
                    },
                  },
                });

                if (originDeparture) {
                  // 乗り換え経路が見つかった
                  transferRoutes.push({
                    // 第1区間
                    origin_stop_id: origin.stop_id,
                    origin_stop_name: origin.stop_name,
                    origin_stop_lat: originStop.lat,
                    origin_stop_lon: originStop.lon,
                    origin_departure: originDeparture.departure_time,
                    first_leg_trip: originDeparture.trip_id,
                    first_leg_route_id: transferArrival.trip.route_id,
                    first_route_short_name:
                      transferArrival.trip.route.short_name,
                    first_route_long_name: transferArrival.trip.route.long_name,
                    first_route_color: transferArrival.trip.route.color,
                    first_route_text_color:
                      transferArrival.trip.route.text_color,

                    // 乗り換え停留所
                    transfer_stop_id: transferStop.id,
                    transfer_stop_name: transferStop.name,
                    transfer_stop_lat: transferStop.lat,
                    transfer_stop_lon: transferStop.lon,
                    transfer_arrival: transferArrival.arrival_time,
                    transfer_departure: transferDeparture.departure_time,
                    transfer_wait_time: waitTimeMinutes,

                    // 第2区間
                    dest_stop_id: destination.stop_id,
                    dest_stop_name: destination.stop_name,
                    dest_stop_lat: destStop.lat,
                    dest_stop_lon: destStop.lon,
                    dest_arrival: destStopTime.arrival_time,
                    second_leg_trip: transferDeparture.trip_id,
                    second_leg_route_id: destStopTime.trip.route_id,
                    second_route_short_name: destStopTime.trip.route.short_name,
                    second_route_long_name: destStopTime.trip.route.long_name,
                    second_route_color: destStopTime.trip.route.color,
                    second_route_text_color: destStopTime.trip.route.text_color,

                    // 所要時間計算
                    first_leg_duration: this.calculateDurationMinutes(
                      originDeparture.departure_time || "",
                      transferArrival.arrival_time || ""
                    ),
                    second_leg_duration: this.calculateDurationMinutes(
                      transferDeparture.departure_time || "",
                      destStopTime.arrival_time || ""
                    ),
                    total_duration: this.calculateDurationMinutes(
                      originDeparture.departure_time || "",
                      destStopTime.arrival_time || ""
                    ),
                  });

                  // 十分な数の経路が見つかったら終了
                  if (transferRoutes.length >= 5) {
                    break;
                  }
                }
              }

              if (transferRoutes.length >= 5) {
                break;
              }
            }
          }

          if (transferRoutes.length >= 5) {
            break;
          }
        }
      }

      // 乗り換え経路が見つかった場合
      if (transferRoutes.length > 0) {
        return this.formatRouteResults(transferRoutes, true);
      }

      // 乗り換え経路が見つからなかった場合
      return {
        success: true,
        data: {
          journeys: [],
          stops: [],
          message: "乗り換え経路が見つかりませんでした",
        },
      };
    } catch (error) {
      logger.error("[TransitService] 乗り換え経路検索エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "経路検索に失敗しました",
        data: { journeys: [], stops: [] },
      };
    }
  }

  /**
   * 経路検索結果をフォーマットする
   */
  private formatRouteResults(
    results: TransferRouteResult[],
    isTransfer: boolean
  ): TransitResponse {
    if (isTransfer) {
      // 乗り換え経路のフォーマット
      return {
        success: true,
        data: {
          journeys: results.map((route: TransferRouteResult) => ({
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
                departure: route.origin_departure || "",
                arrival: route.transfer_arrival || "",
                duration: Math.round(route.first_leg_duration),
                route:
                  route.first_route_short_name ||
                  route.first_route_long_name ||
                  "",
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
                departure: route.transfer_departure || "",
                arrival: route.dest_arrival || "",
                duration: Math.round(route.second_leg_duration),
                route:
                  route.second_route_short_name ||
                  route.second_route_long_name ||
                  "",
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
                lat: parseFloat(route.transfer_stop_lat.toString()),
                lng: parseFloat(route.transfer_stop_lon.toString()),
              },
            },
          })),
          stops: [
            {
              id: results[0].origin_stop_id,
              name: results[0].origin_stop_name,
              distance: 0,
              lat: parseFloat(results[0].origin_stop_lat.toString()),
              lng: parseFloat(results[0].origin_stop_lon.toString()),
            },
            {
              id: results[0].dest_stop_id,
              name: results[0].dest_stop_name,
              distance: 0,
              lat: parseFloat(results[0].dest_stop_lat.toString()),
              lng: parseFloat(results[0].dest_stop_lon.toString()),
            },
          ],
        },
      };
    } else {
      // 直接経路のフォーマット（この部分は現在使用されていないが、将来的な拡張に備えて実装）
      return {
        success: true,
        data: {
          journeys: results.map((route: any) => ({
            departure: route.departure_time,
            arrival: route.arrival_time,
            duration: Math.round(route.duration_minutes || 0),
            transfers: 0,
            route: route.route_short_name || route.route_long_name || "",
            from: route.origin_stop_name,
            to: route.dest_stop_name,
            color: route.route_color ? `#${route.route_color}` : "#000000",
            textColor: route.route_text_color
              ? `#${route.route_text_color}`
              : "#FFFFFF",
          })),
          stops:
            results.length > 0
              ? [
                  {
                    id: results[0].origin_stop_id,
                    name: results[0].origin_stop_name,
                    distance: 0,
                    lat: parseFloat(
                      results[0].origin_stop_lat?.toString() || "0"
                    ),
                    lng: parseFloat(
                      results[0].origin_stop_lon?.toString() || "0"
                    ),
                  },
                  {
                    id: results[0].dest_stop_id,
                    name: results[0].dest_stop_name,
                    distance: 0,
                    lat: parseFloat(
                      results[0].dest_stop_lat?.toString() || "0"
                    ),
                    lng: parseFloat(
                      results[0].dest_stop_lon?.toString() || "0"
                    ),
                  },
                ]
              : [],
        },
      };
    }
  }

  /**
   * 所要時間を分単位で計算する
   */
  private calculateDurationMinutes(startTime: string, endTime: string): number {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    return (end.getTime() - start.getTime()) / (60 * 1000);
  }
}
