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
import {
  ROUTE_PARAMS,
  TimeTableRouter,
  type TimeTableRouteResult,
} from "./route-algorithm";
import { TRANSIT_PARAMS } from "./transit-params";
import {
  calculateJourneyDurationMinutes,
  calculateRouteSearchTime,
  parseGtfsTime,
} from "./walking";
import {
  calculateHaversineDistanceKm,
  selectNearbyStops,
} from "./stop-selection";
import {
  getWalkNetwork,
  prepareWalkSearch,
  walkLeg,
  type LngLat,
} from "./walk-network";
import { selectBestRouteCandidate } from "./route-result-ranking";

interface StopLocation {
  lat: number;
  lng: number;
  stopId: string;
  stopName: string;
}

/**
 * 停留所までの徒歩距離が上限を超え、経路を検索できなかった地点。
 * `field`はどちらの地点か、`meters`はその徒歩距離（メートル）。
 */
export interface BlockedBy {
  field: "origin" | "destination";
  meters: number;
}

interface RouteSearchOutcome {
  journeys: Journey[];
  stops: NearbyStop[];
  blockedBy?: BlockedBy;
  /** 出発地から乗車停留所までの徒歩距離（メートル）。 */
  originWalkMeters?: number;
  /** 降車停留所から目的地までの徒歩距離（メートル）。 */
  destinationWalkMeters?: number;
}

/**
 * 出発地と目的地の最寄り停留所までの徒歩距離から、経路検索の対象外になる
 * 地点を選ぶ。上限を超える地点が2つあるときは、遠い方を示す。
 */
function blockedLocation(
  originMeters: number,
  destinationMeters: number
): BlockedBy | null {
  const limit = TRANSIT_PARAMS.MAX_WALK_TO_STOP_METERS;
  const originBlocked = !(originMeters <= limit);
  const destinationBlocked = !(destinationMeters <= limit);
  if (!originBlocked && !destinationBlocked) {
    return null;
  }
  if (originBlocked && destinationBlocked) {
    return originMeters >= destinationMeters
      ? { field: "origin", meters: originMeters }
      : { field: "destination", meters: destinationMeters };
  }
  return originBlocked
    ? { field: "origin", meters: originMeters }
    : { field: "destination", meters: destinationMeters };
}

// 内部で使用するRouteJourney インターフェース - 完全な移動経路を表現
interface RouteJourney {
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  segments: RouteSegment[];
  transfers: number;
  transferInfo?: TransferInfo;
}

// RouteSegment インターフェース - 移動経路のセグメントを表現
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

// TransferInfo インターフェース - 乗り換え情報を表現
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
    });

    const stopsWithDistance = stops.map((stop) => {
      const distance = calculateHaversineDistanceKm(
        location.lat,
        location.lng,
        stop.lat,
        stop.lon
      );

      return {
        id: stop.id,
        name: stop.name,
        lat: stop.lat,
        lng: stop.lon,
        distance,
      };
    });

    const sortedStops = stopsWithDistance
      .filter((stop) => stop.distance <= radius)
      .sort((firstStop, secondStop) => firstStop.distance - secondStop.distance)
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
    /** 入力座標から停留所までの徒歩距離（メートル）。到達できなければ Infinity。 */
    walkMeters: number;
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
        walkMeters: nearestStop.walkMeters,
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
    const graph = getWalkNetwork();
    const prepared = prepareWalkSearch(graph, { lat: targetLat, lng: targetLng });
    const scored = stops.map((stop) => {
      const leg = walkLeg(
        graph,
        prepared,
        { lat: stop.lat, lng: stop.lon },
        { path: false }
      );

      return {
        stopId: stop.id,
        stopName: stop.name,
        stopLat: stop.lat,
        stopLon: stop.lon,
        distance: leg === null ? Number.POSITIVE_INFINITY : leg.distanceKm,
        walkMeters:
          leg === null ? Number.POSITIVE_INFINITY : leg.distanceKm * 1000,
      };
    });

    return scored.sort(
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
      // 徒歩ネットワークを読めないときは、直線距離で代替せず失敗を返す。
      // 代替すると、artifactの更新漏れが精度の低い経路として静かに現れる。
      getWalkNetwork();
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
          ...(result.blockedBy === undefined ? {} : { blockedBy: result.blockedBy }),
          ...(result.originWalkMeters === undefined
            ? {}
            : { originWalkMeters: result.originWalkMeters }),
          ...(result.destinationWalkMeters === undefined
            ? {}
            : { destinationWalkMeters: result.destinationWalkMeters }),
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
  private async searchRoute(query: RouteQuery): Promise<RouteSearchOutcome> {
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

      const blockedBy = blockedLocation(originStop.walkMeters, destStop.walkMeters);
      if (blockedBy !== null) {
        logger.log(
          `[searchRoute] 最寄りバス停までの徒歩が上限を超える: ${blockedBy.field}=${blockedBy.meters.toFixed(0)}m`
        );
        return { journeys: [], stops: [], blockedBy };
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
          isDeparture,
          prioritizeSpeed
        );
      }

      // 従来のアルゴリズムで経路検索
      const conventionalResult = await this.findConventionalRoute(
        from,
        to,
        origin,
        destination,
        time,
        isDeparture,
        prioritizeSpeed
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
        isDeparture,
        prioritizeSpeed
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
    time: string | undefined,
    isDeparture: boolean,
    prioritizeSpeed: boolean
  ): Promise<RouteSearchOutcome> {
    try {
      const graph = getWalkNetwork();

      // 出発地点から最初のバス停までの徒歩経路を計算
      const toFirstStop = walkLeg(
        graph,
        prepareWalkSearch(graph, origin),
        { lat: from.lat, lng: from.lng }
      );
      if (toFirstStop === null) {
        logger.log("[findConventionalRoute] 出発地から乗車停留所まで歩けません");
        return { journeys: [], stops: [] };
      }
      const walkToFirstStop = toFirstStop.distanceKm;
      const walkTimeToFirstStop =
        walkToFirstStop / TRANSIT_PARAMS.WALKING_SPEED_KM_MIN;

      const fromLastStop = walkLeg(
        graph,
        prepareWalkSearch(graph, { lat: to.lat, lng: to.lng }),
        destination
      );
      if (fromLastStop === null) {
        logger.log("[findConventionalRoute] 降車停留所から目的地まで歩けません");
        return { journeys: [], stops: [] };
      }
      const walkFromLastStop = fromLastStop.distanceKm;
      const walkTimeFromLastStop =
        walkFromLastStop / TRANSIT_PARAMS.WALKING_SPEED_KM_MIN;

      const limitKm = TRANSIT_PARAMS.MAX_WALK_TO_STOP_METERS / 1000;
      if (walkToFirstStop > limitKm || walkFromLastStop > limitKm) {
        logger.log(
          `[findConventionalRoute] 最寄りバス停までの徒歩が上限を超える: 出発=${walkToFirstStop.toFixed(3)}km, 到着=${walkFromLastStop.toFixed(3)}km`
        );
        return { journeys: [], stops: [] };
      }

      const timeTableRouter = new TimeTableRouter();
      const userRequestedTime = time ? new Date(time) : new Date();

      // 出発時刻指定の場合、バス停までの徒歩時間を考慮した時刻を計算
      const routeSearchTime = calculateRouteSearchTime(
        userRequestedTime,
        isDeparture,
        walkTimeToFirstStop,
        walkTimeFromLastStop
      );
      if (isDeparture) {
        logger.log(
          `[findConventionalRoute] バス停到着時間の調整: 出発時刻=${this.formatTime(
            userRequestedTime
          )}, ` +
            `徒歩時間=${Math.ceil(
              walkTimeToFirstStop
            )}分, バス停到着時刻=${this.formatTime(routeSearchTime)}`
          );
      }

      const routes = await timeTableRouter.findOptimalRoute(
        from.stopId,
        to.stopId,
        routeSearchTime,
        isDeparture,
        ROUTE_PARAMS.MAX_TRANSFERS,
        ROUTE_PARAMS.DEFAULT_TIME_WINDOW
      );

      if (routes.length === 0) {
        return { journeys: [], stops: [] };
      }

      const routeTotalWalkingDistance = walkToFirstStop + walkFromLastStop;
      const selectedRoute = selectBestRouteCandidate(
        routes.map((route) => ({
          route,
          totalWalkingDistance: routeTotalWalkingDistance,
          departure: route.departure,
          arrival: route.arrival,
          transfers: route.transfers,
        })),
        { prioritizeSpeed, isDeparture }
      )?.route;
      if (!selectedRoute) {
        return { journeys: [], stops: [] };
      }

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
          distance: calculateHaversineDistanceKm(
            origin.lat,
            origin.lng,
            from.lat,
            from.lng
          ),
          walkingTimeMinutes: Math.ceil(walkTimeToFirstStop),
          lat: parseFloat(from.lat.toString()),
          lng: parseFloat(from.lng.toString()),
        },
        // 目的地点の最寄りバス停
        {
          id: to.stopId,
          name: to.stopName,
          distance: calculateHaversineDistanceKm(
            to.lat,
            to.lng,
            destination.lat,
            destination.lng
          ),
          walkingTimeMinutes: Math.ceil(walkTimeFromLastStop),
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

      // 合計徒歩距離
      const totalWalkingDistance = walkToFirstStop + walkFromLastStop;

      // 内部のRouteJourneyをAPIのJourney型に変換
      const journey = this.convertTimeTableRouteToJourney(
        selectedRoute,
        from,
        to
      );

      const totalDuration = calculateJourneyDurationMinutes({
        isDeparture,
        requestedTime: this.formatTime(userRequestedTime),
        transitDepartureTime: selectedRoute.departure,
        transitArrivalTime: selectedRoute.arrival,
        walkToFirstStopMinutes: walkTimeToFirstStop,
        walkFromLastStopMinutes: walkTimeFromLastStop,
      });

      // Journey型に変換
      const convertedJourney = this.transformToJourney(journey, from, to);

      // 徒歩情報を追加
      convertedJourney.walkingDistanceKm = totalWalkingDistance;
      convertedJourney.walkingTimeMinutes = Math.round(
        walkTimeToFirstStop + walkTimeFromLastStop
      );
      convertedJourney.originWalkPath = toFirstStop.path;
      convertedJourney.destinationWalkPath = fromLastStop.path;
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
        originWalkMeters: walkToFirstStop * 1000,
        destinationWalkMeters: walkFromLastStop * 1000,
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
    isDeparture: boolean = true,
    prioritizeSpeed: boolean = false
  ): Promise<RouteSearchOutcome> {
    try {
      // 検索半径をメートルからキロメートルに変換
      const radiusKm = TRANSIT_PARAMS.MAX_WALK_TO_STOP_METERS / 1000;

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
        departure: string;
        arrival: string;
        transfers: number;
        originWalkMeters: number;
        destWalkMeters: number;
      }[] = [];

      // 時刻表ベースのルーター
      const timeTableRouter = new TimeTableRouter();
      const userRequestedTime = time ? new Date(time) : new Date();
      const graph = getWalkNetwork();
      const originWalk = prepareWalkSearch(graph, origin);

      // 降車停留所から目的地までの徒歩経路は、出発停留所の組み合わせに
      // 依存しない。停留所ごとに1度だけ求める。
      const destinationLegs = new Map<string, ReturnType<typeof walkLeg>>();
      for (const destStop of topDestStops) {
        if (!destStop.lat || !destStop.lng) {
          continue;
        }
        destinationLegs.set(
          destStop.id,
          walkLeg(
            graph,
            prepareWalkSearch(graph, { lat: destStop.lat, lng: destStop.lng }),
            destination
          )
        );
      }

      // すべての組み合わせを試す
      for (const originStop of topOriginStops) {
        if (!originStop.lat || !originStop.lng) {
          continue;
        }

        const toFirstStop = walkLeg(graph, originWalk, {
          lat: originStop.lat,
          lng: originStop.lng,
        });
        if (toFirstStop === null) {
          continue;
        }
        const walkToFirstStop = toFirstStop.distanceKm;

        const walkTimeToFirstStop = walkToFirstStop / TRANSIT_PARAMS.WALKING_SPEED_KM_MIN;

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

            const fromLastStop = destinationLegs.get(destStop.id);
            if (fromLastStop === undefined || fromLastStop === null) {
              continue;
            }
            const walkFromLastStop = fromLastStop.distanceKm;
            const walkTimeFromLastStop =
              walkFromLastStop / TRANSIT_PARAMS.WALKING_SPEED_KM_MIN;
            const routeSearchTime = calculateRouteSearchTime(
              userRequestedTime,
              isDeparture,
              walkTimeToFirstStop,
              walkTimeFromLastStop
            );

            // 経路を検索
            const routes = await timeTableRouter.findOptimalRoute(
              originStop.id,
              destStop.id,
              routeSearchTime,
              isDeparture,
              ROUTE_PARAMS.MAX_TRANSFERS,
              ROUTE_PARAMS.DEFAULT_TIME_WINDOW
            );

            for (const route of routes) {
              const routeResult = this.buildRouteResult(
                route,
                from,
                to,
                walkToFirstStop,
                walkTimeToFirstStop,
                walkFromLastStop,
                walkTimeFromLastStop,
                isDeparture,
                time,
                userRequestedTime,
                toFirstStop.path,
                fromLastStop.path
              );

              allResults.push({
                journey: routeResult.journey,
                originWalkMeters: walkToFirstStop * 1000,
                destWalkMeters: walkFromLastStop * 1000,
                originStop: {
                  ...originStop,
                  walkingTimeMinutes: Math.ceil(walkTimeToFirstStop),
                },
                destStop: {
                  ...destStop,
                  walkingTimeMinutes: Math.ceil(walkTimeFromLastStop),
                },
                totalWalkingDistance: routeResult.totalWalkingDistance,
                totalDuration: routeResult.totalDuration,
                departure: route.departure,
                arrival: route.arrival,
                transfers: route.transfers,
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

      const bestResult = selectBestRouteCandidate(allResults, {
        prioritizeSpeed,
        isDeparture,
      });

      if (!bestResult) {
        return { journeys: [], stops: [] };
      }

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
        originWalkMeters: bestResult.originWalkMeters,
        destinationWalkMeters: bestResult.destWalkMeters,
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
        // 探索は降車停留所と同じ停留所からの乗り継ぎだけを生成するため、乗換の徒歩距離は0になる。
        // 異なる停留所へ歩く乗換を扱うときは、停留所間の徒歩距離をここへ入れる。
        distanceMeters: 0,
        // 乗換に要する時間は待ち時間だけである。徒歩時間ではない。
        walkingTimeMinutes: waitTime,
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
    return (parseGtfsTime(endTime) - parseGtfsTime(startTime)) / 60;
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
    walkFromLastStop: number,
    walkTimeFromLastStop: number,
    isDeparture: boolean,
    time?: string,
    userRequestedTime?: Date,
    originWalkPath?: LngLat[],
    destinationWalkPath?: LngLat[]
  ) {
    const totalWalkingDistance = walkToFirstStop + walkFromLastStop;

    const journey = this.convertTimeTableRouteToJourney(selectedRoute, from, to);
    const totalDuration = calculateJourneyDurationMinutes({
      isDeparture,
      requestedTime: this.formatTime(userRequestedTime ?? new Date()),
      transitDepartureTime: selectedRoute.departure,
      transitArrivalTime: selectedRoute.arrival,
      walkToFirstStopMinutes: walkTimeToFirstStop,
      walkFromLastStopMinutes: walkTimeFromLastStop,
    });

    const convertedJourney = this.transformToJourney(journey, from, to);
    convertedJourney.walkingDistanceKm = totalWalkingDistance;
    convertedJourney.walkingTimeMinutes = Math.round(walkTimeToFirstStop + walkTimeFromLastStop);
    convertedJourney.originWalkPath = originWalkPath;
    convertedJourney.destinationWalkPath = destinationWalkPath;
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
   * 指定した座標から特定の半径内にあるバス停を検索
   */
  private async findNearbyStops(
    lat: number,
    lng: number,
    radiusKm: number = TRANSIT_PARAMS.MAX_WALK_TO_STOP_METERS / 1000
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

      const nearbyStops = selectNearbyStops(stops, lat, lng, radiusKm);

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
   * 全てのルートとその停留所を取得
   */
  async getAllRoutesWithStops(): Promise<{ route: string; stops: string[] }[]> {
    try {
      const routes = await prisma.route.findMany({
        select: {
          id: true,
          short_name: true,
          long_name: true,
          trips: {
            select: {
              stop_times: {
                select: {
                  stop: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
                orderBy: {
                  stop_sequence: 'asc',
                },
              },
            },
          },
        },
        orderBy: {
          short_name: 'asc',
        },
      });

      return routes.map(route => {
        const routeName = route.short_name || route.long_name || route.id;
        
        if (!route.trips || route.trips.length === 0) {
          return { route: routeName, stops: [] };
        }

        // 全てのトリップから重複を除いてバス停名のリストを作成
        const uniqueStops = new Set<string>();
        route.trips.forEach(trip => {
          trip.stop_times.forEach(stopTime => {
            uniqueStops.add(stopTime.stop.name);
          });
        });

        return {
          route: routeName,
          stops: Array.from(uniqueStops),
        };
      });
    } catch (error) {
      logger.error("[TransitService] ルート・バス停取得エラー:", error);
      return [];
    }
  }
}
