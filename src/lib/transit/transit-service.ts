import {
  TransitQuery,
  StopQuery,
  TimetableQuery,
  TransitResponse,
  RouteSegment as ApiRouteSegment,
  TransferInfo as ApiTransferInfo,
} from "@/types/transit-api";
import { loadConfig, TransitConfig } from "../config/config";
import { prisma } from "../db/prisma";
import { logger } from "@/utils/logger";
import { TimeTableRouter } from "./route-algorithm";
import {
  RouteQuery as ApiRouteQuery,
  Journey,
  NearbyStop,
} from "../../types/transit-api";

// StopLocation interface - represents a stop with location information
interface StopLocation {
  lat: number;
  lng: number;
  stop_id: string;
  stop_name: string;
}

// 内部で使用するRouteJourney interface - represents a complete journey
interface RouteJourney {
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  segments: RouteSegment[];
  transfers: number;
  transferInfo?: TransferInfo;
}

// RouteSegment interface - represents a segment of a journey
interface RouteSegment {
  type: "transit" | "transfer" | "wait";
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  fromStop: {
    id: string;
    name: string;
    lat: number;
    lng: number;
  };
  toStop: {
    id: string;
    name: string;
    lat: number;
    lng: number;
  };
  routeId?: string;
  routeName?: string;
  tripId?: string;
  waitMinutes?: number;
  transferInfo?: TransferInfo;
}

// TransferInfo interface - represents information about a transfer
interface TransferInfo {
  fromStop: {
    id: string;
    name: string;
    lat: number;
    lng: number;
  };
  toStop: {
    id: string;
    name: string;
    lat: number;
    lng: number;
  };
  distanceMeters: number;
  walkingTimeMinutes: number;
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
   * 経路検索API
   */
  public async findRoute(query: ApiRouteQuery): Promise<TransitResponse> {
    try {
      const result = await this.searchRoute(query);
      return {
        success: true,
        data: {
          journeys: result.journeys,
          stops: result.stops,
        },
      };
    } catch (error) {
      logger.error("[TransitService] API経路検索エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "経路検索に失敗しました",
        data: { journeys: [], stops: [] },
      };
    }
  }

  /**
   * 出発地点と目的地点の座標から最適な経路を検索
   */
  private async searchRoute(
    query: ApiRouteQuery
  ): Promise<{ journeys: Journey[]; stops: NearbyStop[] }> {
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
        return { journeys: [], stops: [] };
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

      // 出発・到着バス停の情報をログ出力
      logger.log(
        `[TransitService] 出発バス停: ID=${from.stop_id}, 名称=${from.stop_name}, 緯度=${from.lat}, 経度=${from.lng}`
      );
      logger.log(
        `[TransitService] 到着バス停: ID=${to.stop_id}, 名称=${to.stop_name}, 緯度=${to.lat}, 経度=${to.lng}`
      );

      // 同じバス停の場合はエラー
      if (from.stop_id === to.stop_id) {
        return { journeys: [], stops: [] };
      }

      try {
        // 時刻表ベースのダイクストラアルゴリズムを使用して経路を検索
        const timeTableRouter = new TimeTableRouter();
        const departureTime = time ? new Date(time) : new Date();

        // 最大2回の乗換、3時間の時間枠で検索
        const routes = await timeTableRouter.findOptimalRoute(
          from.stop_id,
          to.stop_id,
          departureTime,
          isDeparture,
          2,
          180
        );

        if (routes.length === 0) {
          return { journeys: [], stops: [] };
        }

        // ルートを整理して最適なものを選択
        // まず直行便と乗換ありのルートを分ける
        const directRoutes = routes.filter((route) => route.transfers === 0);
        const transferRoutes = routes.filter((route) => route.transfers > 0);

        // 経路選択ロジック
        // 直行便が存在する場合は優先
        // 到着時刻指定と出発時刻指定で異なるソート方法を使用
        let selectedRoute;

        if (directRoutes.length > 0) {
          // 直行便が存在する場合
          if (isDeparture) {
            // 出発時刻指定の場合：出発時刻順に並べて最初のものを選択
            directRoutes.sort((a, b) => {
              const timeA = new Date(`2000-01-01T${a.departure}`).getTime();
              const timeB = new Date(`2000-01-01T${b.departure}`).getTime();
              return timeA - timeB;
            });
          } else {
            // 到着時刻指定の場合：到着時刻の降順（指定時刻に近い順）
            directRoutes.sort((a, b) => {
              const timeA = new Date(`2000-01-01T${a.arrival}`).getTime();
              const timeB = new Date(`2000-01-01T${b.arrival}`).getTime();
              return timeB - timeA;
            });
          }
          selectedRoute = directRoutes[0];
        } else if (transferRoutes.length > 0) {
          // 乗換ありの場合
          if (isDeparture) {
            // 出発時刻指定の場合：出発時刻順に並べて最初のものを選択
            transferRoutes.sort((a, b) => {
              const timeA = new Date(`2000-01-01T${a.departure}`).getTime();
              const timeB = new Date(`2000-01-01T${b.departure}`).getTime();
              return timeA - timeB;
            });
          } else {
            // 到着時刻指定の場合：到着時刻の降順（指定時刻に近い順）
            transferRoutes.sort((a, b) => {
              const timeA = new Date(`2000-01-01T${a.arrival}`).getTime();
              const timeB = new Date(`2000-01-01T${b.arrival}`).getTime();
              return timeB - timeA;
            });
          }
          selectedRoute = transferRoutes[0];
        } else {
          return { journeys: [], stops: [] };
        }

        // 使用する停留所のリストを作成
        const stops: NearbyStop[] = [
          {
            id: from.stop_id,
            name: from.stop_name,
            distance: 0,
          },
          {
            id: to.stop_id,
            name: to.stop_name,
            distance: 0,
          },
        ];

        // 乗換停留所がある場合は追加
        if (selectedRoute.transfers > 0 && selectedRoute.nodes.length > 2) {
          // 乗換地点を取得（最初の目的地兼次の出発地）
          const transferNode = selectedRoute.nodes[1];

          // 停留所情報を検索
          const transferStop = await prisma.stop.findUnique({
            where: { id: transferNode.stopId },
            select: {
              id: true,
              name: true,
              lat: true,
              lon: true,
            },
          });

          if (transferStop) {
            stops.push({
              id: transferStop.id,
              name: transferStop.name,
              distance: 0,
            });
          }
        }

        // 内部のRouteJourneyをAPIのJourney型に変換
        const transformToJourney = (route: any): Journey => {
          // 内部のRouteSegmentをAPI用のRouteSegmentに変換
          const convertSegments = (
            segments: RouteSegment[]
          ): ApiRouteSegment[] => {
            return segments.map((segment) => ({
              from: segment.fromStop.name,
              to: segment.toStop.name,
              departure: segment.departureTime,
              arrival: segment.arrivalTime,
              duration: segment.durationMinutes,
              route: segment.routeName || segment.routeId || "",
              color: "#000000", // 後でroutesテーブルから取得するよう修正
              textColor: "#FFFFFF",
            }));
          };

          // 内部のTransferInfoをAPI用のTransferInfoに変換
          const convertTransferInfo = (
            info?: TransferInfo
          ): ApiTransferInfo | undefined => {
            if (!info) return undefined;
            return {
              stop: info.fromStop.name,
              waitTime: Math.round(info.walkingTimeMinutes || 0),
              location: {
                lat: info.fromStop.lat,
                lng: info.fromStop.lng,
              },
            };
          };

          const journey = this.convertTimeTableRouteToJourney(route, from, to);

          return {
            departure: journey.departureTime,
            arrival: journey.arrivalTime,
            duration: journey.durationMinutes,
            transfers: journey.transfers,
            from: from.stop_name,
            to: to.stop_name,
            route: journey.segments
              .map((s) => s.routeName || s.routeId)
              .join(" → "),
            color: "#000000",
            textColor: "#FFFFFF",
            segments: convertSegments(journey.segments),
            transferInfo: convertTransferInfo(journey.transferInfo),
          };
        };

        // 選択したルートを変換して返す
        return {
          journeys: [transformToJourney(selectedRoute)],
          stops,
        };
      } catch (error) {
        logger.error("[TransitService] 経路検索クエリエラー:", error);
        throw error;
      }
    } catch (error) {
      logger.error("[TransitService] 経路検索エラー:", error);
      return { journeys: [], stops: [] };
    }
  }

  /**
   * 時刻表ベースのルート結果をRouteJourney形式に変換
   */
  private convertTimeTableRouteToJourney(
    route: any,
    from: StopLocation,
    to: StopLocation
  ): RouteJourney {
    logger.log(
      `経路変換: ${from.stop_name} から ${to.stop_name} への経路を変換します`
    );

    if (route.transfers === 0) {
      // 直行便の場合
      return {
        departureTime: route.departure,
        arrivalTime: route.arrival,
        durationMinutes: Math.round(route.totalDuration),
        segments: [
          {
            type: "transit",
            departureTime: route.departure,
            arrivalTime: route.arrival,
            durationMinutes: Math.round(route.totalDuration),
            fromStop: {
              id: route.nodes[0].stopId,
              name: route.nodes[0].stopName,
              lat: route.nodes[0].stopLat,
              lng: route.nodes[0].stopLon,
            },
            toStop: {
              id: route.nodes[1].stopId,
              name: route.nodes[1].stopName,
              lat: route.nodes[1].stopLat,
              lng: route.nodes[1].stopLon,
            },
            routeId: route.nodes[0].routeId,
            routeName: route.nodes[0].routeName,
            tripId: route.nodes[0].tripId,
          },
        ],
        transfers: 0,
      };
    } else {
      // 乗換が必要な場合
      const firstLeg: RouteSegment = {
        type: "transit",
        departureTime: route.nodes[0].departureTime,
        arrivalTime: route.nodes[1].arrivalTime,
        durationMinutes: this.calculateDurationMinutes(
          route.nodes[0].departureTime,
          route.nodes[1].arrivalTime
        ),
        fromStop: {
          id: route.nodes[0].stopId,
          name: route.nodes[0].stopName,
          lat: route.nodes[0].stopLat,
          lng: route.nodes[0].stopLon,
        },
        toStop: {
          id: route.nodes[1].stopId,
          name: route.nodes[1].stopName,
          lat: route.nodes[1].stopLat,
          lng: route.nodes[1].stopLon,
        },
        routeId: route.nodes[0].routeId,
        routeName: route.nodes[0].routeName,
        tripId: route.nodes[0].tripId,
      };

      const secondLeg: RouteSegment = {
        type: "transit",
        departureTime: route.nodes[2].departureTime,
        arrivalTime: route.nodes[3].arrivalTime,
        durationMinutes: this.calculateDurationMinutes(
          route.nodes[2].departureTime,
          route.nodes[3].arrivalTime
        ),
        fromStop: {
          id: route.nodes[2].stopId,
          name: route.nodes[2].stopName,
          lat: route.nodes[2].stopLat,
          lng: route.nodes[2].stopLon,
        },
        toStop: {
          id: route.nodes[3].stopId,
          name: route.nodes[3].stopName,
          lat: route.nodes[3].stopLat,
          lng: route.nodes[3].stopLon,
        },
        routeId: route.nodes[2].routeId,
        routeName: route.nodes[2].routeName,
        tripId: route.nodes[2].tripId,
      };

      // waitTimeを使用
      const waitTime = this.calculateDurationMinutes(
        route.nodes[1].arrivalTime,
        route.nodes[2].departureTime
      );

      const transferInfo: TransferInfo = {
        fromStop: {
          id: route.nodes[1].stopId,
          name: route.nodes[1].stopName,
          lat: route.nodes[1].stopLat,
          lng: route.nodes[1].stopLon,
        },
        toStop: {
          id: route.nodes[2].stopId,
          name: route.nodes[2].stopName,
          lat: route.nodes[2].stopLat,
          lng: route.nodes[2].stopLon,
        },
        distanceMeters: 0, // 後で修正
        walkingTimeMinutes: waitTime, // 計算したwaitTimeを使用
      };

      return {
        departureTime: route.departure,
        arrivalTime: route.arrival,
        durationMinutes: Math.round(route.totalDuration),
        segments: [firstLeg, secondLeg],
        transfers: route.transfers,
        transferInfo: transferInfo,
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

  /**
   * 時間差を分単位で計算する
   */
  private calculateTimeDifference(time1: string, time2: string): number {
    const t1 = new Date(`2000-01-01T${time1}`);
    const t2 = new Date(`2000-01-01T${time2}`);
    const timeDiff = (t2.getTime() - t1.getTime()) / (60 * 1000);
    return timeDiff;
  }
}
