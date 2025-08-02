import {
  TransitQuery,
  StopQuery,
  TimetableQuery,
  TransitResponse,
  RouteSegment as ApiRouteSegment,
  TransferInfo as ApiTransferInfo,
  RouteQuery,
  Journey,
  NearbyStop,
} from "@/types/core";
import { loadConfig, TransitConfig } from "../config/config";
import { prisma } from "../db/prisma";
import { logger } from "@/utils/logger";
import { TimeTableRouter } from "./route-algorithm";
import { TRANSIT_PARAMS } from "./transit-params";

// TimeTableRouteResult interface from route-algorithm.ts
interface TimeTableRouteResult {
  nodes: Array<{
    stopId: string;
    stopName: string;
    tripId: string;
    routeId: string;
    routeName: string;
    arrivalTime: string;
    departureTime: string;
    stopSequence: number;
    stopLat: number;
    stopLon: number;
  }>;
  transfers: number;
  totalDuration: number;
  departure: string;
  arrival: string;
}

interface StopLocation {
  lat: number;
  lng: number;
  stopId: string;
  stopName: string;
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
        return await this.findStopsByLocation(location, radius);
      }
      
      if (name) {
        return await this.findStopsByName(name);
      }
      
      return {
        success: false,
        error: "検索条件が指定されていません",
        data: { stops: [] },
      };
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

  private async findStopsByLocation(
    location: { lat: number; lng: number },
    radius: number
  ): Promise<TransitResponse> {
    const stops = await prisma.stop.findMany({
      select: {
        id: true,
        name: true,
        lat: true,
        lon: true,
      },
      take: 10,
    });

    const stopsWithDistance = stops.map((stop) => {
      const latitudeDifference = stop.lat - location.lat;
      const longitudeDifference = stop.lon - location.lng;
      const distance =
        Math.sqrt(latitudeDifference * latitudeDifference + longitudeDifference * longitudeDifference) * 111.32;

      return {
        id: stop.id,
        name: stop.name,
        lat: stop.lat,
        lng: stop.lon,
        distance,
      };
    });

    const sortedStops = stopsWithDistance
      .sort((firstStop, secondStop) => firstStop.distance - secondStop.distance)
      .filter((stop) => stop.distance <= radius)
      .slice(0, 10);

    return {
      success: true,
      data: {
        stops: sortedStops,
      },
    };
  }

  private async findStopsByName(name: string): Promise<TransitResponse> {
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
    stopId: string;
    stopName: string;
    stopLat: number;
    stopLon: number;
  } | null> {
    try {
      logger.log("[findNearestStop] 入力座標:", { lat, lng });

      const stops = await prisma.stop.findMany({
        select: {
          id: true,
          name: true,
          lat: true,
          lon: true,
        },
      });

      if (stops.length === 0) {
        logger.log("[findNearestStop] バス停データが見つかりません");
        return null;
      }

      const nearestStop = this.findClosestStop(stops, lat, lng);

      logger.log("[findNearestStop] 最寄りバス停:", {
        stopId: nearestStop.stopId,
        stopName: nearestStop.stopName,
        stopLat: nearestStop.stopLat,
        stopLon: nearestStop.stopLon,
        inputCoords: { lat, lng },
      });

      return nearestStop;
    } catch (error) {
      logger.error("[TransitService] 最寄りバス停検索エラー:", error);
      return null;
    }
  }

  private findClosestStop(
    stops: Array<{ id: string; name: string; lat: number; lon: number }>,
    targetLat: number,
    targetLng: number
  ) {
    const stopsWithDistance = stops.map((stop) => {
      const latitudeDifference = stop.lat - targetLat;
      const longitudeDifference = stop.lon - targetLng;
      const squaredDistance = latitudeDifference * latitudeDifference + longitudeDifference * longitudeDifference;

      return {
        stopId: stop.id,
        stopName: stop.name,
        stopLat: stop.lat,
        stopLon: stop.lon,
        distance: squaredDistance,
      };
    });

    return stopsWithDistance.sort(
      (firstStop, secondStop) => firstStop.distance - secondStop.distance
    )[0];
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
  public async findRoute(query: RouteQuery): Promise<TransitResponse> {
    try {
      logger.log(
        `[TransitService] 経路検索API: 出発地(${query.origin.lat}, ${
          query.origin.lng
        }), 目的地(${query.destination.lat}, ${query.destination.lng}), ${
          query.isDeparture ? "出発" : "到着"
        }時刻=${query.time}, はやさ優先=${query.prioritizeSpeed || false}`
      );
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
    query: RouteQuery
  ): Promise<{ journeys: Journey[]; stops: NearbyStop[] }> {
    try {
      const {
        origin,
        destination,
        time,
        isDeparture = true,
        prioritizeSpeed = false,
      } = query;

      logger.log(
        `[TransitService] 経路検索: ${origin.lat},${origin.lng} → ${
          destination.lat
        },${destination.lng}, ${
          isDeparture ? "出発" : "到着"
        }時刻 = ${time}, はやさ優先 = ${prioritizeSpeed}`
      );

      // 最寄りのバス停を特定
      const originStop = await this.findNearestStop(origin.lat, origin.lng);
      const destStop = await this.findNearestStop(
        destination.lat,
        destination.lng
      );

      if (!originStop || !destStop) {
        logger.error("[searchRoute] 最寄りバス停が見つかりません");
        return { journeys: [], stops: [] };
      }

      logger.log("[searchRoute] 座標データ詳細:", {
        origin: {
          userLatitude: origin.lat,
          userLongitude: origin.lng,
          stopId: originStop.stopId,
          stopName: originStop.stopName,
          stopLatitude: originStop.stopLat,
          stopLongitude: originStop.stopLon,
        },
        destination: {
          userLatitude: destination.lat,
          userLongitude: destination.lng,
          stopId: destStop.stopId,
          stopName: destStop.stopName,
          stopLatitude: destStop.stopLat,
          stopLongitude: destStop.stopLon,
        },
      });

      const from: StopLocation = {
        lat: originStop.stopLat,
        lng: originStop.stopLon,
        stopId: originStop.stopId,
        stopName: originStop.stopName,
      };

      const to: StopLocation = {
        lat: destStop.stopLat,
        lng: destStop.stopLon,
        stopId: destStop.stopId,
        stopName: destStop.stopName,
      };

      logger.log("[searchRoute] StopLocation変換後:", {
        from,
        to,
      });

      // 同じバス停の場合はエラー
      if (from.stopId === to.stopId) {
        return { journeys: [], stops: [] };
      }

      // はやさ優先の場合、直接近隣バス停を使用した検索を実施
      if (prioritizeSpeed) {
        logger.log(
          "[searchRoute] はやさ優先モードが有効: 直接近隣バス停を使用した検索を開始します"
        );
        return await this.findRouteWithNearbyStops(
          origin,
          destination,
          time,
          isDeparture
        );
      }

      // 従来のアルゴリズムで経路検索
      const conventionalResult = await this.findConventionalRoute(
        from,
        to,
        origin,
        destination,
        time,
        isDeparture
      );

      // 従来の方法で結果が見つかった場合はそれを返す
      if (conventionalResult.journeys.length > 0) {
        return conventionalResult;
      }

      // 結果が見つからなかった場合、周辺バス停を利用した検索を実施
      logger.log(
        "[searchRoute] 通常の検索で経路が見つかりませんでした。近隣バス停を使用した検索を開始します。"
      );

      return await this.findRouteWithNearbyStops(
        origin,
        destination,
        time,
        isDeparture
      );
    } catch (error) {
      logger.error("[TransitService] 経路検索エラー:", error);
      return { journeys: [], stops: [] };
    }
  }

  /**
   * 従来のアルゴリズムを使用して経路を検索
   */
  private async findConventionalRoute(
    from: StopLocation,
    to: StopLocation,
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    time?: string,
    isDeparture: boolean = true
  ): Promise<{ journeys: Journey[]; stops: NearbyStop[] }> {
    try {
      // 出発地点から最初のバス停までの徒歩距離を計算
      const walkToFirstStop = this.calculateDistance(
        origin.lat,
        origin.lng,
        from.lat,
        from.lng
      );

      // 徒歩時間（分）を計算
      const walkTimeToFirstStop =
        walkToFirstStop / TRANSIT_PARAMS.WALKING_SPEED_KM_MIN;

      // 時刻表ベースのダイクストラアルゴリズムを使用して経路を検索
      const timeTableRouter = new TimeTableRouter();
      const userRequestedTime = time ? new Date(time) : new Date();

      // 出発時刻指定の場合、バス停までの徒歩時間を考慮した時刻を計算
      let departureTime = userRequestedTime;
      if (isDeparture) {
        // バス停までの所要時間を計算し、実際のバス停出発可能時刻を算出
        const walkTimeMs = Math.ceil(walkTimeToFirstStop) * 60 * 1000; // 分をミリ秒に変換（切り上げ）
        departureTime = new Date(userRequestedTime.getTime() + walkTimeMs);

        logger.log(
          `[findConventionalRoute] バス停到着時間の調整: 出発時刻=${this.formatTime(
            userRequestedTime
          )}, ` +
            `徒歩時間=${Math.ceil(
              walkTimeToFirstStop
            )}分, バス停到着時刻=${this.formatTime(departureTime)}`
        );
      }

      // 最大2回の乗換、3時間の時間枠で検索
      const routes = await timeTableRouter.findOptimalRoute(
        from.stopId,
        to.stopId,
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
      const routesToConsider = directRoutes.length > 0 ? directRoutes : transferRoutes;
      
      if (routesToConsider.length === 0) {
        return { journeys: [], stops: [] };
      }

      const selectedRoute = this.selectOptimalRoute(routesToConsider, isDeparture);

      // 使用する停留所のリストを作成
      const stops: NearbyStop[] = [
        // ユーザーの出発地点（出発地点の表示用）
        {
          id: "user_origin",
          name: "出発地点",
          distance: 0,
          lat: origin.lat,
          lng: origin.lng,
        },
        // 出発地点の最寄りバス停
        {
          id: from.stopId,
          name: from.stopName,
          distance: 0,
          lat: parseFloat(from.lat.toString()),
          lng: parseFloat(from.lng.toString()),
        },
        // 目的地点の最寄りバス停
        {
          id: to.stopId,
          name: to.stopName,
          distance: 0,
          lat: parseFloat(to.lat.toString()),
          lng: parseFloat(to.lng.toString()),
        },
        // ユーザーの目的地点（目的地点の表示用）
        {
          id: "user_destination",
          name: "目的地点",
          distance: 0,
          lat: destination.lat,
          lng: destination.lng,
        },
      ];

      // 最後のバス停から目的地までの徒歩距離
      const walkFromLastStop = this.calculateDistance(
        to.lat,
        to.lng,
        destination.lat,
        destination.lng
      );

      // 合計徒歩距離
      const totalWalkingDistance = walkToFirstStop + walkFromLastStop;

      // 残りの徒歩時間（分）
      const walkTimeFromLastStop =
        walkFromLastStop / TRANSIT_PARAMS.WALKING_SPEED_KM_MIN;

      // 内部のRouteJourneyをAPIのJourney型に変換
      const journey = this.convertTimeTableRouteToJourney(
        selectedRoute,
        from,
        to
      );

      // 総所要時間 = バスの所要時間 + 徒歩時間
      const totalDuration =
        journey.durationMinutes + walkTimeToFirstStop + walkTimeFromLastStop;

      // Journey型に変換
      const convertedJourney = this.transformToJourney(journey, from, to);

      // 徒歩情報を追加
      convertedJourney.walkingDistanceKm = totalWalkingDistance;
      convertedJourney.walkingTimeMinutes = Math.round(
        walkTimeToFirstStop + walkTimeFromLastStop
      );
      convertedJourney.duration = Math.round(totalDuration); // 総所要時間を更新

      // 出発時刻指定の場合、ユーザーが指定した元の時刻を表示用に設定
      if (isDeparture && time) {
        convertedJourney.userRequestedDepartureTime =
          this.formatTime(userRequestedTime);
      }

      logger.log(
        `[findConventionalRoute] 経路発見: ${from.stopName} → ${
          to.stopName
        }, 総徒歩距離: ${totalWalkingDistance.toFixed(
          2
        )}km (出発地→バス停: ${walkToFirstStop.toFixed(
          2
        )}km, バス停→目的地: ${walkFromLastStop.toFixed(
          2
        )}km), 総所要時間: ${totalDuration.toFixed(0)}分`
      );

      return {
        journeys: [convertedJourney],
        stops,
      };
    } catch (error) {
      logger.error("[TransitService] 従来型経路検索エラー:", error);
      return { journeys: [], stops: [] };
    }
  }

  /**
   * 周辺のバス停を使用して経路を検索
   */
  private async findRouteWithNearbyStops(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    time?: string,
    isDeparture: boolean = true
  ): Promise<{ journeys: Journey[]; stops: NearbyStop[] }> {
    try {
      // 検索半径をメートルからキロメートルに変換
      const radiusKm = TRANSIT_PARAMS.DEFAULT_SEARCH_RADIUS / 1000;

      // 出発地点と目的地点の周辺バス停を取得
      const nearbyOriginStops = await this.findNearbyStops(
        origin.lat,
        origin.lng,
        radiusKm
      );
      const nearbyDestStops = await this.findNearbyStops(
        destination.lat,
        destination.lng,
        radiusKm
      );

      logger.log(
        `[findRouteWithNearbyStops] 出発地点周辺：${nearbyOriginStops.length}件、目的地点周辺：${nearbyDestStops.length}件のバス停を検討`
      );

      if (nearbyOriginStops.length === 0 || nearbyDestStops.length === 0) {
        logger.log("[findRouteWithNearbyStops] 半径内にバス停が見つかりません");
        return { journeys: [], stops: [] };
      }

      // 処理数を削減するため、上位の停留所だけを使用
      const topOriginStops = nearbyOriginStops.slice(
        0,
        TRANSIT_PARAMS.ROUTE_SEARCH.MAX_ORIGIN_STOPS
      );
      const topDestStops = nearbyDestStops.slice(
        0,
        TRANSIT_PARAMS.ROUTE_SEARCH.MAX_DEST_STOPS
      );

      // 全ての組み合わせで検索した結果を格納する配列
      const allResults: {
        journey: Journey;
        originStop: NearbyStop;
        destStop: NearbyStop;
        totalWalkingDistance: number;
        totalDuration: number;
      }[] = [];

      // 時刻表ベースのルーター
      const timeTableRouter = new TimeTableRouter();
      const userRequestedTime = time ? new Date(time) : new Date();

      // すべての組み合わせを試す
      for (const originStop of topOriginStops) {
        if (!originStop.lat || !originStop.lng) {
          continue;
        }

        const walkToFirstStop = this.calculateDistance(
          origin.lat,
          origin.lng,
          originStop.lat,
          originStop.lng
        );

        const walkTimeToFirstStop = walkToFirstStop / TRANSIT_PARAMS.WALKING_SPEED_KM_MIN;

        const departureTime = isDeparture 
          ? this.calculateDepartureTimeWithWalk(userRequestedTime, walkTimeToFirstStop, originStop.name)
          : userRequestedTime;

        for (const destStop of topDestStops) {
          if (!destStop.lat || !destStop.lng || originStop.id === destStop.id) {
            continue;
          }

          try {
            const from: StopLocation = {
              lat: originStop.lat,
              lng: originStop.lng,
              stopId: originStop.id,
              stopName: originStop.name,
            };

            const to: StopLocation = {
              lat: destStop.lat,
              lng: destStop.lng,
              stopId: destStop.id,
              stopName: destStop.name,
            };

            // 経路を検索
            const routes = await timeTableRouter.findOptimalRoute(
              originStop.id,
              destStop.id,
              departureTime,
              isDeparture,
              2, // 最大2回の乗換
              180 // 3時間の時間枠
            );

            if (routes.length > 0) {
              const selectedRoute = this.selectOptimalRoute(routes, isDeparture);

              const routeResult = this.buildRouteResult(
                selectedRoute,
                from,
                to,
                walkToFirstStop,
                walkTimeToFirstStop,
                destStop,
                destination,
                isDeparture,
                time,
                userRequestedTime
              );

              allResults.push({
                journey: routeResult.journey,
                originStop,
                destStop,
                totalWalkingDistance: routeResult.totalWalkingDistance,
                totalDuration: routeResult.totalDuration,
              });
            }
          } catch (error) {
            logger.error(
              `[findRouteWithNearbyStops] 検索エラー: ${originStop.id} → ${destStop.id}`,
              error
            );
            continue;
          }
        }
      }

      // 結果が見つからなかった場合
      if (allResults.length === 0) {
        logger.log("[findRouteWithNearbyStops] 利用可能な経路が見つかりません");
        return { journeys: [], stops: [] };
      }

      // 所要時間の少ない順にソート
      allResults.sort((firstResult, secondResult) => firstResult.totalDuration - secondResult.totalDuration);

      // 最適な結果を選択
      const bestResult = allResults[0];

      // ユーザーの実際の出発地と目的地の座標と、使用するバス停情報を追加
      const stops: NearbyStop[] = [
        // ユーザーの出発地点（出発地点の表示用）
        {
          id: "user_origin",
          name: "出発地点",
          distance: 0,
          lat: origin.lat,
          lng: origin.lng,
        },
        // 出発地点の最寄りバス停
        bestResult.originStop,
        // 目的地点の最寄りバス停
        bestResult.destStop,
        // ユーザーの目的地点（目的地点の表示用）
        {
          id: "user_destination",
          name: "目的地点",
          distance: 0,
          lat: destination.lat,
          lng: destination.lng,
        },
      ];

      logger.log(
        `[findRouteWithNearbyStops] 最適経路を発見: ${
          bestResult.originStop.name
        } → ${
          bestResult.destStop.name
        }, 総徒歩距離: ${bestResult.totalWalkingDistance.toFixed(
          2
        )}km, 総所要時間: ${bestResult.totalDuration.toFixed(0)}分`
      );

      return {
        journeys: [bestResult.journey],
        stops,
      };
    } catch (error) {
      logger.error(
        "[TransitService] 近隣バス停を使用した経路検索エラー:",
        error
      );
      return { journeys: [], stops: [] };
    }
  }

  /**
   * 内部のRouteJourney型をAPIのJourney型に変換するヘルパーメソッド
   */
  private transformToJourney(
    journey: RouteJourney,
    fromStop: StopLocation,
    toStop: StopLocation
  ): Journey {
    // 内部のRouteSegmentをAPI用のRouteSegmentに変換
    const convertSegments = (segments: RouteSegment[]): ApiRouteSegment[] => {
      return segments.map((segment) => ({
        from: segment.fromStop.name,
        to: segment.toStop.name,
        departure: segment.departureTime,
        arrival: segment.arrivalTime,
        duration: segment.durationMinutes,
        route: segment.routeName || segment.routeId || "",
        color: "#000000",
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

    return {
      departure: journey.departureTime,
      arrival: journey.arrivalTime,
      duration: journey.durationMinutes,
      transfers: journey.transfers,
      from: fromStop.stopName,
      to: toStop.stopName,
      segments: journey.segments
        ? convertSegments(journey.segments)
        : undefined,
      transferInfo: journey.transferInfo
        ? convertTransferInfo(journey.transferInfo)
        : undefined,
    };
  }

  /**
   * 時刻表ベースのルート結果をRouteJourney形式に変換
   */
  private convertTimeTableRouteToJourney(
    route: TimeTableRouteResult,
    fromStop: StopLocation,
    toStop: StopLocation
  ): RouteJourney {
    logger.log(
      `経路変換: ${fromStop.stopName} から ${toStop.stopName} への経路を変換します`
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
   * 最適なルートを選択する
   */
  private selectOptimalRoute(routes: TimeTableRouteResult[], isDeparture: boolean): TimeTableRouteResult {
    const sortComparator = (firstRoute: TimeTableRouteResult, secondRoute: TimeTableRouteResult) => {
      const timeField = isDeparture ? 'departure' : 'arrival';
      const firstTime = new Date(`2000-01-01T${firstRoute[timeField]}`).getTime();
      const secondTime = new Date(`2000-01-01T${secondRoute[timeField]}`).getTime();
      
      return isDeparture 
        ? firstTime - secondTime  // 出発時刻指定の場合：昇順
        : secondTime - firstTime; // 到着時刻指定の場合：降順
    };

    return routes.sort(sortComparator)[0];
  }

  /**
   * 徒歩時間を考慮した出発時刻を計算する
   */
  private calculateDepartureTimeWithWalk(userRequestedTime: Date, walkTimeMinutes: number, stopName: string): Date {
    const walkTimeMs = Math.ceil(walkTimeMinutes) * 60 * 1000;
    const departureTime = new Date(userRequestedTime.getTime() + walkTimeMs);

    logger.log(
      `[findRouteWithNearbyStops] バス停到着時間の調整 (${stopName}): ` +
        `出発時刻=${this.formatTime(userRequestedTime)}, ` +
        `徒歩時間=${Math.ceil(walkTimeMinutes)}分, バス停到着時刻=${this.formatTime(departureTime)}`
    );

    return departureTime;
  }

  /**
   * ルート結果を構築する
   */
  private buildRouteResult(
    selectedRoute: TimeTableRouteResult,
    from: StopLocation,
    to: StopLocation,
    walkToFirstStop: number,
    walkTimeToFirstStop: number,
    destStop: NearbyStop,
    destination: { lat: number; lng: number },
    isDeparture: boolean,
    time?: string,
    userRequestedTime?: Date
  ) {
    const walkFromLastStop = this.calculateDistance(
      destStop.lat!,
      destStop.lng!,
      destination.lat,
      destination.lng
    );

    const totalWalkingDistance = walkToFirstStop + walkFromLastStop;
    const walkTimeFromLastStop = walkFromLastStop / TRANSIT_PARAMS.WALKING_SPEED_KM_MIN;

    const journey = this.convertTimeTableRouteToJourney(selectedRoute, from, to);
    const totalDuration = journey.durationMinutes + walkTimeToFirstStop + walkTimeFromLastStop;

    const convertedJourney = this.transformToJourney(journey, from, to);
    convertedJourney.walkingDistanceKm = totalWalkingDistance;
    convertedJourney.walkingTimeMinutes = Math.round(walkTimeToFirstStop + walkTimeFromLastStop);
    convertedJourney.duration = Math.round(totalDuration);

    if (isDeparture && time && userRequestedTime) {
      convertedJourney.userRequestedDepartureTime = this.formatTime(userRequestedTime);
    }

    return {
      journey: convertedJourney,
      totalWalkingDistance,
      totalDuration,
    };
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

  /**
   * 指定した座標から特定の半径内にあるバス停を検索
   */
  private async findNearbyStops(
    lat: number,
    lng: number,
    radiusKm: number = TRANSIT_PARAMS.DEFAULT_SEARCH_RADIUS / 1000 // デフォルト500メートル
  ): Promise<NearbyStop[]> {
    try {
      logger.log(
        `[findNearbyStops] 検索条件: 座標(${lat}, ${lng}), 半径${radiusKm}km`
      );

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
        logger.log("[findNearbyStops] バス停データが見つかりません");
        return [];
      }

      // JavaScript側で距離計算と半径でのフィルタリングを行う
      const nearbyStops = stops
        .map((stop) => {
          // ハバーサイン公式で距離を計算
          const distance = this.calculateDistance(lat, lng, stop.lat, stop.lon);

          return {
            id: stop.id,
            name: stop.name,
            lat: stop.lat,
            lng: stop.lon,
            distance,
          };
        })
        .filter((stop) => stop.distance <= radiusKm) // 半径内のバス停だけをフィルタリング
        .sort((firstStop, secondStop) => firstStop.distance - secondStop.distance);

      logger.log(
        `[findNearbyStops] ${nearbyStops.length}件のバス停が半径${radiusKm}km内に見つかりました`
      );
      return nearbyStops;
    } catch (error) {
      logger.error("[TransitService] 周辺バス停検索エラー:", error);
      return [];
    }
  }

  /**
   * 2点間の距離をキロメートル単位で計算（ハバーサイン公式）
   */
  private calculateDistance(
    firstLatitude: number,
    firstLongitude: number,
    secondLatitude: number,
    secondLongitude: number
  ): number {
    const EARTH_RADIUS_KM = 6371;
    const firstLatitudeRad = this.toRadians(firstLatitude);
    const firstLongitudeRad = this.toRadians(firstLongitude);
    const secondLatitudeRad = this.toRadians(secondLatitude);
    const secondLongitudeRad = this.toRadians(secondLongitude);

    const latitudeDifference = secondLatitudeRad - firstLatitudeRad;
    const longitudeDifference = secondLongitudeRad - firstLongitudeRad;

    const haversineValue =
      Math.sin(latitudeDifference / 2) * Math.sin(latitudeDifference / 2) +
      Math.cos(firstLatitudeRad) *
        Math.cos(secondLatitudeRad) *
        Math.sin(longitudeDifference / 2) *
        Math.sin(longitudeDifference / 2);
    const centralAngle = 2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));
    const distance = EARTH_RADIUS_KM * centralAngle;

    // ロギングして結果を確認
    logger.log(
      `[calculateDistance] 距離計算: (${firstLatitude}, ${firstLongitude}) → (${secondLatitude}, ${secondLongitude}) = ${distance.toFixed(
        3
      )}km`
    );

    return distance;
  }

  /**
   * 角度をラジアンに変換
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
