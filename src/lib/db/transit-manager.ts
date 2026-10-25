import { Database } from "./database";
import { Departure } from "@/types/core";

// Using local Stop type definition for this module
interface Stop {
  id: string;
  name: string;
  code?: string;
  stop_id?: string;
  stop_name?: string;
}
import { prisma } from "../db/prisma";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import { logger } from "../../utils/logger";

// Prismaが生成した型定義
type PrismaStop = Prisma.StopGetPayload<{ include: { stop_times: true } }>;
type PrismaRoute = Prisma.RouteGetPayload<{ include: { trips: true } }>;

// 出力用の型定義
type FormattedDeparture = {
  trip_id: string;
  route_id: string;
  stop_id: string;
  route_name: string;
  stop_name: string;
  departure_time: string;
  formatted_time: string;
  time_until: string;
  ms_until_departure: number;
  headsign: string;
  color: string;
  text_color: string;
};

/**
 * 交通データの取得と管理を担当するマネージャークラス
 */
export class TransitManager {
  private static instance: TransitManager;
  private db: Database;
  private prisma: PrismaClient;

  /**
   * プライベートコンストラクタでシングルトンパターンを実現
   */
  private constructor() {
    this.db = Database.getInstance();
    this.prisma = prisma;

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
   * すべてのバス停を取得する
   */
  public async getStops(): Promise<PrismaStop[]> {
    return await this.prisma.stop.findMany({
      include: {
        stop_times: true,
      },
    });
  }

  /**
   * すべての路線を取得する
   */
  public async getRoutes(): Promise<PrismaRoute[]> {
    return await this.prisma.route.findMany({
      include: {
        trips: true,
      },
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

      // データベースから出発時刻を取得
      return await this.gtfsGetDepartures(
        stopId,
        routeId || null,
        now,
        isDeparture
      );
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
    try {
      // 指定された日付に有効なservice_idのリストを取得
      const serviceIds = await this.getValidServiceIds(date);

      if (serviceIds.length === 0) {
        logger.warn("有効なサービスIDが見つかりませんでした");
        return [];
      }

      // 時刻データを取得（Prismaを使用）
      const query = {
        where: {
          stop_id: stop_id || undefined,
          trip: {
            service_id: {
              in: serviceIds,
            },
            route_id: route_id || undefined,
          },
        },
        include: {
          trip: {
            include: {
              route: true,
            },
          },
          stop: true,
        },
        orderBy: isDeparture
          ? { departure_time: "asc" as const }
          : { arrival_time: "asc" as const },
      } satisfies Prisma.Args<typeof this.prisma.stopTime, "findMany">;

      const stopTimes = await this.prisma.stopTime.findMany(query);

      if (!stopTimes || stopTimes.length === 0) {
        return [];
      }

      const timeField = isDeparture ? "departure_time" : "arrival_time";

      // 時刻をパースして結果を整形
      const formattedDepartures = stopTimes
        .filter((st) => st[timeField])
        .map((stopTime) => {
          const timeStr = stopTime[timeField] as string;
          const trip = stopTime.trip;
          const route = trip.route;
          const stop = stopTime.stop;

          // 時刻文字列からDateオブジェクトを作成
          const departureDate = this.getTimeAsDate(timeStr, date);

          // 現在時刻との差分（ミリ秒）
          const msUntilDeparture = departureDate.getTime() - Date.now();

          return {
            trip_id: trip.id,
            route_id: route.id,
            stop_id: stop.id,
            route_name: route.short_name || route.long_name || "",
            stop_name: stop.name || "",
            departure_time: timeStr,
            formatted_time: this.formatTime(departureDate),
            time_until: this.formatTimeUntilDeparture(msUntilDeparture),
            ms_until_departure: msUntilDeparture,
            headsign: trip.headsign || "",
            color: route.color ? `#${route.color}` : "#000000",
            text_color: route.text_color ? `#${route.text_color}` : "#FFFFFF",
          } as FormattedDeparture;
        })
        .filter((d) => d !== null);

      // Departure型に変換
      const departures: Departure[] = formattedDepartures.map((fd) => ({
        routeId: fd.route_id,
        routeName: fd.route_name,
        stopId: fd.stop_id,
        stopName: fd.stop_name,
        tripId: fd.trip_id,
        time: fd.formatted_time,
        timeUntilDeparture: fd.time_until,
        msUntilDeparture: fd.ms_until_departure,
        headsign: fd.headsign,
        scheduledTime: fd.departure_time,
      }));

      // 時刻でソート
      return departures.sort(
        (a, b) => (a.msUntilDeparture || 0) - (b.msUntilDeparture || 0)
      );
    } catch (error) {
      logger.error("出発時刻の取得中にエラーが発生しました:", error);
      return [];
    }
  }

  /**
   * 時刻文字列（HH:MM:SS）からDateオブジェクトを生成
   */
  private getTimeAsDate(timeStr: string, baseDate: Date = new Date()): Date {
    if (!timeStr) {
      return new Date();
    }

    // HH:MM:SSを解析
    const [hours, minutes, seconds] = timeStr.split(":").map(Number);

    // 基準日に時刻を設定したDateオブジェクトを作成
    const date = new Date(baseDate);
    date.setHours(hours % 24); // 24時以降は翌日として処理
    date.setMinutes(minutes);
    date.setSeconds(seconds || 0);

    // 24時以降の場合は日付を進める
    if (hours >= 24) {
      date.setDate(date.getDate() + Math.floor(hours / 24));
    }

    return date;
  }

  /**
   * Dateオブジェクトから時刻文字列（HH:MM）を生成
   */
  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  /**
   * 出発までの残り時間を人間が読みやすい形式（例: "5分", "1時間20分"）で返す
   */
  private formatTimeUntilDeparture(msUntilDeparture: number): string {
    // 過去の場合は「発車済み」と表示
    if (msUntilDeparture < 0) {
      return "発車済み";
    }

    // 分に変換
    const minutes = Math.floor(msUntilDeparture / (1000 * 60));

    if (minutes < 60) {
      // 1時間未満
      return `${minutes}分`;
    } else {
      // 1時間以上
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours}時間${remainingMinutes}分`
        : `${hours}時間`;
    }
  }

  /**
   * 現在地から最も近いバス停を取得する
   */
  public async getNearestStops(
    lat: number,
    lng: number
  ): Promise<{
    stops: Stop[];
    nearestStop: {
      id: string;
      name: string;
      code: string | null;
      lat: number;
      lon: number;
      distance: number;
    } | null;
  }> {
    return this.db.withConnection(async () => {
      try {
        // すべてのバス停を取得
        const query = {
          select: {
            id: true,
            name: true,
            code: true,
            lat: true,
            lon: true,
          },
        } satisfies Prisma.Args<typeof this.prisma.stop, "findMany">;

        const stops = await this.prisma.stop.findMany(query);

        // ユーザーの現在地から各バス停までの距離を計算
        const stopsWithDistance = stops.map((stop) => {
          const distance = this.calculateDistance(lat, lng, stop.lat, stop.lon);

          return {
            ...stop,
            distance,
          };
        });

        // 距離でソート
        stopsWithDistance.sort((a, b) => a.distance - b.distance);

        // 最も近いバス停
        const nearestStop =
          stopsWithDistance.length > 0 ? stopsWithDistance[0] : null;

        // UIで使用するStopオブジェクト形式に変換
        const formattedStops = stopsWithDistance.map((stop) => ({
          id: stop.id,
          name: stop.name || "名称不明",
          code: stop.code || undefined,
        }));

        return {
          stops: formattedStops,
          nearestStop,
        };
      } catch (error) {
        logger.error("最寄りバス停の取得中にエラーが発生しました:", error);
        return {
          stops: [],
          nearestStop: null,
        };
      }
    });
  }

  /**
   * ハバーサイン公式を使用して2点間の距離をキロメートル単位で計算
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
    const distance = R * c;
    return distance;
  }

  /**
   * 度からラジアンに変換
   */
  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * バス停IDから位置情報を取得
   */
  public async getStopLocation(
    stopId: string
  ): Promise<{ lat: number; lon: number } | null> {
    return this.db.withConnection(async () => {
      try {
        const query = {
          where: { id: stopId },
          select: { lat: true, lon: true },
        } satisfies Prisma.Args<typeof this.prisma.stop, "findUnique">;

        const stop = await this.prisma.stop.findUnique(query);

        if (!stop) {
          return null;
        }

        return {
          lat: stop.lat,
          lon: stop.lon,
        };
      } catch (error) {
        logger.error("バス停位置情報の取得中にエラーが発生しました:", error);
        return null;
      }
    });
  }

  /**
   * 指定された日付に有効なGTFSサービスIDのリストを取得する
   * calendar.txtとcalendar_dates.txtの両方を考慮する
   */
  public async getValidServiceIds(targetDate: Date): Promise<string[]> {
    try {
      // 日付をYYYYMMDD形式に変換
      const formattedDate = targetDate
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

      // 曜日を取得（0=日曜, 1=月曜, ..., 6=土曜）
      const dayOfWeek = targetDate.getDay();

      // calendar.txtのデータで日付範囲内かつ曜日が一致するサービスID
      const calendarQuery = {
        where: {
          start_date: {
            lte: formattedDate,
          },
          end_date: {
            gte: formattedDate,
          },
          OR: [
            { sunday: dayOfWeek === 0 ? 1 : 0 },
            { monday: dayOfWeek === 1 ? 1 : 0 },
            { tuesday: dayOfWeek === 2 ? 1 : 0 },
            { wednesday: dayOfWeek === 3 ? 1 : 0 },
            { thursday: dayOfWeek === 4 ? 1 : 0 },
            { friday: dayOfWeek === 5 ? 1 : 0 },
            { saturday: dayOfWeek === 6 ? 1 : 0 },
          ],
        },
        select: {
          service_id: true,
        },
      } satisfies Prisma.Args<typeof this.prisma.calendar, "findMany">;

      const calendarServices = await this.prisma.calendar.findMany(
        calendarQuery
      );

      // calendar_dates.txtの例外データを取得
      const calendarDatesQuery = {
        where: {
          date: formattedDate,
        },
        select: {
          service_id: true,
          exception_type: true,
        },
      } satisfies Prisma.Args<typeof this.prisma.calendarDate, "findMany">;

      const calendarDates = await this.prisma.calendarDate.findMany(
        calendarDatesQuery
      );

      // calendarから基本の有効なサービスIDを取得
      let validServiceIds = calendarServices.map((cs) => cs.service_id);

      // カレンダー例外を適用
      for (const cd of calendarDates) {
        if (cd.exception_type === 1) {
          // 例外タイプ1: サービス追加
          if (!validServiceIds.includes(cd.service_id)) {
            validServiceIds.push(cd.service_id);
          }
        } else if (cd.exception_type === 2) {
          // 例外タイプ2: サービス削除
          validServiceIds = validServiceIds.filter(
            (id: string) => id !== cd.service_id
          );
        }
      }

      return validServiceIds;
    } catch (error) {
      logger.error("有効なサービスIDの取得中にエラーが発生しました:", error);
      return [];
    }
  }

  /**
   * カスタムクエリを実行するためのメソッド
   * トランザクション内でコールバック関数を実行
   */
  public async withCustomQuery<T>(
    callback: (client: PrismaClient) => Promise<T>
  ): Promise<T> {
    return this.db.withTransaction(async (tx) => {
      return await callback(tx as PrismaClient);
    });
  }
}
