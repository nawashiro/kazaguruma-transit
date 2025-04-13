import fs from "fs";
import path from "path";
import { prisma } from "../db/prisma";
import {
  TransitQuery,
  RouteQuery,
  StopQuery,
  TimetableQuery,
  TransitResponse,
} from "@/types/transit-api";
import { loadConfig, TransitConfig } from "../config/config";
import { logger } from "../../utils/logger";

/**
 * 統合トランジットサービスクラス
 * データベース接続とトランジット関連の全ての機能を単一のクラスで提供
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
   * データベース接続を初期化
   */
  private async initDb(): Promise<void> {
    if (this.isDbInitialized) {
      return;
    }

    try {
      logger.log("[TransitService] データベース接続を初期化しています...");

      // データベースが存在するか確認
      const dbPath = path.join(process.cwd(), this.config.sqlitePath);
      const dbDir = path.dirname(dbPath);

      // データベースディレクトリが存在しない場合は作成
      if (!fs.existsSync(dbDir)) {
        logger.log(`[TransitService] ディレクトリを作成します: ${dbDir}`);
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // データベースへの接続テスト
      await prisma.$queryRaw`SELECT 1`;

      // DBが初期化されたことを記録
      this.isDbInitialized = true;
      logger.log("[TransitService] データベース接続が初期化されました");
    } catch (error) {
      logger.error("[TransitService] データベース初期化エラー:", error);
      throw new Error("データベース接続に失敗しました");
    }
  }

  /**
   * データベース接続を閉じる
   */
  public async closeConnection(): Promise<void> {
    if (this.isDbInitialized) {
      try {
        logger.log("[TransitService] データベース接続を閉じます");
        await prisma.$disconnect();
        this.isDbInitialized = false;
        logger.log("[TransitService] データベース接続が閉じられました");
      } catch (error) {
        logger.warn(
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

    logger.log(
      `[TransitService] 乗り換え経路検索: ${
        isDeparture ? "出発" : "到着"
      }時刻 = ${timeStr}`
    );

    try {
      const requestedDate = new Date(dateStr);
      const dayOfWeek = requestedDate.getDay();
      const formattedDate = requestedDate
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

      // 有効なserviceを取得
      const validServices = await prisma.calendar.findMany({
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
      });

      const serviceIds = validServices.map(
        (s: { service_id: string }) => s.service_id
      );

      // 出発と目的地のバス停情報を取得
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
        throw new Error("出発地または目的地のバス停情報が見つかりません");
      }

      // 乗り換え候補バス停を探す（距離ベース）
      const transferStops = await prisma.stop.findMany({
        where: {
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
      });

      // 乗り換え候補バス停に距離計算フィールドを追加
      const stopsWithDistance = transferStops.map(
        (stop: {
          id: string;
          name: string | null;
          lat: number;
          lon: number;
        }) => {
          // 距離を計算（単純な平方ユークリッド距離）
          const distance =
            Math.pow(stop.lat - originStop.lat, 2) +
            Math.pow(stop.lon - originStop.lon, 2);

          return {
            ...stop,
            distance,
          };
        }
      );

      // 距離でソート
      stopsWithDistance.sort(
        (a: { distance: number }, b: { distance: number }) =>
          a.distance - b.distance
      );

      logger.log(`[TransitService] 乗り換え経路検索中...`);

      // better-sqlite3の代わりにPrismaを使用
      // SQLを直接実行する代わりに構造化クエリを使用
      // 以下、SQL相当の処理をPrismaに置き換え（簡略化）

      // 結果格納配列
      const results = [];

      for (const transferStop of stopsWithDistance) {
        // Prismaでの乗り換え経路検索（簡略化）
        // 実際の実装ではより複雑なクエリが必要
        const journeys = await this.findTransferJourneys(
          originStop,
          transferStop,
          destStop,
          serviceIds,
          timeStr,
          isDeparture
        );

        results.push(...journeys);
      }

      // 結果をフォーマットして返す
      return this.formatRouteResults(results, true);
    } catch (dbError) {
      logger.error("[TransitService] 乗り換え経路検索エラー:", dbError);
      return {
        success: false,
        error: "乗り換え経路の検索に失敗しました",
        data: { journeys: [], stops: [] },
      };
    }
  }

  /**
   * 指定された乗り換えバス停を経由する経路を検索
   */
  private async findTransferJourneys(
    originStop: any,
    transferStop: any,
    destStop: any,
    serviceIds: string[],
    timeStr: string,
    isDeparture: boolean = true
  ): Promise<any[]> {
    const journeys = [];

    try {
      if (isDeparture) {
        // 出発時刻指定の場合

        // 1. 出発地から乗り換えバス停への経路を検索
        const firstLegTrips = await prisma.stopTime.findMany({
          where: {
            stop_id: originStop.id,
            departure_time: {
              gte: timeStr,
            },
            trip: {
              service_id: {
                in: serviceIds,
              },
            },
          },
          select: {
            trip_id: true,
            departure_time: true,
            stop_sequence: true,
            trip: {
              select: {
                id: true,
                route_id: true,
                headsign: true,
                service_id: true,
                route: {
                  select: {
                    id: true,
                    short_name: true,
                    long_name: true,
                    color: true,
                    text_color: true,
                  },
                },
              },
            },
          },
          orderBy: {
            departure_time: "asc",
          },
          take: 20,
        });

        // 各最初の経路について処理
        for (const firstLeg of firstLegTrips) {
          // 乗り換えバス停への到着時刻を検索
          const transferArrival = await prisma.stopTime.findFirst({
            where: {
              trip_id: firstLeg.trip_id,
              stop_id: transferStop.id,
              stop_sequence: {
                gt: firstLeg.stop_sequence,
              },
            },
            select: {
              arrival_time: true,
            },
          });

          if (!transferArrival) continue;

          // 乗り換えバス停から目的地への経路を検索
          const secondLegTrips = await prisma.stopTime.findMany({
            where: {
              stop_id: transferStop.id,
              departure_time: {
                gt: transferArrival.arrival_time,
              },
              trip: {
                service_id: {
                  in: serviceIds,
                },
              },
            },
            select: {
              trip_id: true,
              departure_time: true,
              stop_sequence: true,
              trip: {
                select: {
                  id: true,
                  route_id: true,
                  headsign: true,
                  service_id: true,
                  route: {
                    select: {
                      id: true,
                      short_name: true,
                      long_name: true,
                      color: true,
                      text_color: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              departure_time: "asc",
            },
            take: 10,
          });

          // 各二番目の経路について処理
          for (const secondLeg of secondLegTrips) {
            // 目的地への到着時刻を検索
            const destArrival = await prisma.stopTime.findFirst({
              where: {
                trip_id: secondLeg.trip_id,
                stop_id: destStop.id,
                stop_sequence: {
                  gt: secondLeg.stop_sequence,
                },
              },
              select: {
                arrival_time: true,
              },
            });

            if (!destArrival) continue;

            // 乗り換え時間を計算（分）
            const transferWaitMinutes = this.calculateTimeDiffMinutes(
              transferArrival.arrival_time,
              secondLeg.departure_time
            );

            // 待ち時間が3〜60分の範囲内のみ使用
            if (transferWaitMinutes < 3 || transferWaitMinutes > 60) continue;

            // 総所要時間を計算
            const totalDurationMinutes = this.calculateTimeDiffMinutes(
              firstLeg.departure_time,
              destArrival.arrival_time
            );

            // 経路情報を構築
            journeys.push({
              legs: [
                {
                  origin: {
                    id: originStop.id,
                    name: originStop.name || "名称不明",
                    lat: originStop.lat,
                    lng: originStop.lon,
                  },
                  destination: {
                    id: transferStop.id,
                    name: transferStop.name || "名称不明",
                    lat: transferStop.lat,
                    lng: transferStop.lon,
                  },
                  departure_time: firstLeg.departure_time,
                  arrival_time: transferArrival.arrival_time,
                  trip_id: firstLeg.trip_id,
                  route: {
                    id: firstLeg.trip.route.id,
                    name:
                      firstLeg.trip.route.short_name ||
                      firstLeg.trip.route.long_name ||
                      "名称不明",
                    short_name: firstLeg.trip.route.short_name || "",
                    long_name: firstLeg.trip.route.long_name || "",
                    color: firstLeg.trip.route.color
                      ? `#${firstLeg.trip.route.color}`
                      : "#000000",
                    text_color: firstLeg.trip.route.text_color
                      ? `#${firstLeg.trip.route.text_color}`
                      : "#FFFFFF",
                  },
                  headsign: firstLeg.trip.headsign || "不明",
                },
                {
                  origin: {
                    id: transferStop.id,
                    name: transferStop.name || "名称不明",
                    lat: transferStop.lat,
                    lng: transferStop.lon,
                  },
                  destination: {
                    id: destStop.id,
                    name: destStop.name || "名称不明",
                    lat: destStop.lat,
                    lng: destStop.lon,
                  },
                  departure_time: secondLeg.departure_time,
                  arrival_time: destArrival.arrival_time,
                  trip_id: secondLeg.trip_id,
                  route: {
                    id: secondLeg.trip.route.id,
                    name:
                      secondLeg.trip.route.short_name ||
                      secondLeg.trip.route.long_name ||
                      "名称不明",
                    short_name: secondLeg.trip.route.short_name || "",
                    long_name: secondLeg.trip.route.long_name || "",
                    color: secondLeg.trip.route.color
                      ? `#${secondLeg.trip.route.color}`
                      : "#000000",
                    text_color: secondLeg.trip.route.text_color
                      ? `#${secondLeg.trip.route.text_color}`
                      : "#FFFFFF",
                  },
                  headsign: secondLeg.trip.headsign || "不明",
                },
              ],
              departure_time: firstLeg.departure_time,
              arrival_time: destArrival.arrival_time,
              duration: totalDurationMinutes,
              transfer_time: transferWaitMinutes,
              stops: [
                {
                  id: originStop.id,
                  name: originStop.name || "名称不明",
                  lat: originStop.lat,
                  lng: originStop.lon,
                },
                {
                  id: transferStop.id,
                  name: transferStop.name || "名称不明",
                  lat: transferStop.lat,
                  lng: transferStop.lon,
                },
                {
                  id: destStop.id,
                  name: destStop.name || "名称不明",
                  lat: destStop.lat,
                  lng: destStop.lon,
                },
              ],
            });

            // 最大5件に制限
            if (journeys.length >= 5) break;
          }

          if (journeys.length >= 5) break;
        }
      } else {
        // 到着時刻指定の場合の処理（仕組みは同様だが逆順）
        // 実装は省略
      }
    } catch (error) {
      logger.error("[TransitService] 乗り換え経路検索でエラー:", error);
    }

    return journeys;
  }

  /**
   * 時刻文字列間の差分を分単位で計算
   */
  private calculateTimeDiffMinutes(start: string, end: string): number {
    const [startHours, startMinutes] = start.split(":").map(Number);
    const [endHours, endMinutes] = end.split(":").map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    return endTotalMinutes - startTotalMinutes;
  }

  /**
   * バス停検索
   */
  private async findStops(query: StopQuery): Promise<TransitResponse> {
    try {
      logger.log(
        `[TransitService] バス停検索：${query.name || "位置情報から"}`
      );

      const { location, name } = query;

      // DBを初期化
      await this.initDb();

      if (!this.isDbInitialized) {
        throw new Error("データベース接続が初期化されていません");
      }

      let stops = [];

      if (location) {
        // 位置情報からの検索
        const allStops = await prisma.stop.findMany({
          select: {
            id: true,
            name: true,
            lat: true,
            lon: true,
          },
        });

        // 距離計算とソート
        stops = allStops
          .map(
            (stop: {
              id: string;
              name: string | null;
              lat: number;
              lon: number;
            }) => {
              const dx = stop.lat - location.lat;
              const dy = stop.lon - location.lng;
              const distance = dx * dx + dy * dy; // 平方ユークリッド距離

              return {
                stop_id: stop.id,
                stop_name: stop.name || "",
                stop_lat: stop.lat,
                stop_lon: stop.lon,
                distance,
              };
            }
          )
          .sort(
            (a: { distance: number }, b: { distance: number }) =>
              a.distance - b.distance
          )
          .slice(0, 10); // 上位10件を取得
      } else if (name) {
        // 名前からの検索
        const nameStops = await prisma.stop.findMany({
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

        // 形式を揃える
        stops = nameStops.map(
          (stop: {
            id: string;
            name: string | null;
            lat: number;
            lon: number;
          }) => ({
            stop_id: stop.id,
            stop_name: stop.name || "",
            stop_lat: stop.lat,
            stop_lon: stop.lon,
          })
        );
      } else {
        return {
          success: false,
          error: "検索条件が指定されていません",
          data: { stops: [] },
        };
      }

      if (stops.length === 0) {
        return {
          success: true,
          data: { stops: [] },
        };
      }

      return {
        success: true,
        data: {
          stops: stops.map((stop: any) => ({
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
      const dateStr = time
        ? new Date(time).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      // DBを初期化
      await this.initDb();

      if (!this.isDbInitialized) {
        throw new Error("データベース接続が初期化されていません");
      }

      // 日付関連の処理
      const requestedDate = new Date(dateStr);
      const dayOfWeek = requestedDate.getDay();
      const formattedDate = requestedDate
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

      // 有効なサービスIDを取得
      const validServices = await prisma.calendar.findMany({
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
      });

      const serviceIds = validServices.map(
        (s: { service_id: string }) => s.service_id
      );

      // 時刻表データを取得
      const stopTimes = await prisma.stopTime.findMany({
        where: {
          stop_id: stopId,
          departure_time: {
            gte: timeStr,
          },
          trip: {
            service_id: {
              in: serviceIds,
            },
          },
        },
        select: {
          departure_time: true,
          arrival_time: true,
          trip: {
            select: {
              route_id: true,
              headsign: true,
              direction_id: true,
              route: {
                select: {
                  id: true,
                  short_name: true,
                  long_name: true,
                  color: true,
                  text_color: true,
                },
              },
            },
          },
        },
        orderBy: {
          departure_time: "asc",
        },
        take: 30,
      });

      if (!stopTimes || stopTimes.length === 0) {
        return {
          success: true,
          data: { timetable: [] },
        };
      }

      return {
        success: true,
        data: {
          timetable: stopTimes.map((entry: any) => ({
            departureTime: entry.departure_time,
            arrivalTime: entry.arrival_time,
            routeId: entry.trip.route_id,
            routeName:
              entry.trip.route.short_name || entry.trip.route.long_name,
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

    logger.log(
      `[TransitService] 直行経路検索: ${
        isDeparture ? "出発" : "到着"
      }時刻 = ${timeStr}`
    );

    try {
      // this.dbを初期化
      await this.initDb();

      if (!this.isDbInitialized) {
        throw new Error("データベース接続が初期化されていません");
      }

      const requestedDate = new Date(dateStr);
      const dayOfWeek = requestedDate.getDay();
      const formattedDate = requestedDate
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

      // 有効なサービスIDを取得
      const validServices = await prisma.calendar.findMany({
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
      });

      const serviceIds = validServices.map(
        (s: { service_id: string }) => s.service_id
      );

      // 出発バス停情報を取得
      const originStop = await prisma.stop.findUnique({
        where: { id: origin.stop_id },
        select: {
          id: true,
          name: true,
          lat: true,
          lon: true,
        },
      });

      // 目的地バス停情報を取得
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
        throw new Error("バス停情報が見つかりません");
      }

      // 最終結果を格納する配列
      const results = [];

      // 出発時刻指定の場合
      if (isDeparture) {
        const originStopTimes = await prisma.stopTime.findMany({
          where: {
            stop_id: origin.stop_id,
            departure_time: {
              gte: timeStr,
            },
          },
          include: {
            trip: {
              where: {
                service_id: {
                  in: serviceIds,
                },
              },
              include: {
                route: true,
              },
            },
          },
          orderBy: {
            departure_time: "asc",
          },
          take: 50, // 十分な数を取得
        });

        // 有効なトリップIDのみフィルタリング
        const validTrips = originStopTimes.filter(
          (st: any) => st.trip && st.trip.service_id
        );

        // 各トリップについて目的地停留所の時刻を検索
        for (const originStopTime of validTrips) {
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
            // 直行経路情報を作成
            const route = originStopTime.trip.route;

            // 所要時間を計算（分単位）
            const durationMinutes = this.calculateTimeDiffMinutes(
              originStopTime.departure_time,
              destStopTime.arrival_time
            );

            results.push({
              departure_time: originStopTime.departure_time,
              arrival_time: destStopTime.arrival_time,
              duration_minutes: durationMinutes,
              route_id: route.id,
              route_short_name: route.short_name,
              route_long_name: route.long_name,
              route_color: route.color ? `#${route.color}` : "#000000",
              route_text_color: route.text_color
                ? `#${route.text_color}`
                : "#FFFFFF",
              trip_headsign: originStopTime.trip.headsign,
              direction_id: originStopTime.trip.direction_id,
              origin_stop_id: originStopTime.stop_id,
              origin_stop_name: originStopTime.stop.name,
              origin_stop_lat: originStopTime.stop.lat,
              origin_stop_lon: originStopTime.stop.lon,
              dest_stop_id: destStopTime.stop_id,
              dest_stop_name: destStopTime.stop.name,
              dest_stop_lat: destStopTime.stop.lat,
              dest_stop_lon: destStopTime.stop.lon,
              origin_distance: this.calculateDistance(
                originStopTime.stop,
                originStopTime.stop
              ),
              dest_distance: this.calculateDistance(
                destStopTime.stop,
                originStopTime.stop
              ),
            });
          }
        }
      } else {
        // 到着時刻指定の場合の処理（仕組みは同様だが逆順）
        // 実装は省略
      }

      return {
        success: true,
        data: {
          journeys: results,
        },
      };
    } catch (error) {
      logger.error("[TransitService] 直行経路検索エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "直行経路検索に失敗しました",
        data: { journeys: [] },
      };
    }
  }

  /**
   * 最寄りのバス停を検索する
   */
  private async findNearestStop(lat: number, lng: number): Promise<any> {
    try {
      // this.dbを初期化
      await this.initDb();

      if (!this.isDbInitialized) {
        throw new Error("データベース接続が初期化されていません");
      }

      // Prismaを使用してすべてのバス停を取得
      const stops = await prisma.stop.findMany({
        select: {
          id: true,
          name: true,
          lat: true,
          lon: true,
        },
      });

      // 距離計算を行いソート
      const stopsWithDistance = stops.map(
        (stop: {
          id: string;
          name: string | null;
          lat: number;
          lon: number;
        }) => {
          // 距離を計算（単純な平方ユークリッド距離）
          const distance =
            Math.pow(stop.lat - lat, 2) + Math.pow(stop.lon - lng, 2);

          return {
            stop_id: stop.id,
            stop_name: stop.name || "",
            stop_lat: stop.lat,
            stop_lon: stop.lon,
            distance,
          };
        }
      );

      // 距離でソート
      stopsWithDistance.sort(
        (a: { distance: number }, b: { distance: number }) =>
          a.distance - b.distance
      );

      // 最も近いバス停を返す
      return stopsWithDistance.length > 0 ? stopsWithDistance[0] : null;
    } catch (error) {
      logger.error("[TransitService] 最寄りバス停検索エラー:", error);
      return null;
    }
  }

  private calculateDistance(stop1: any, stop2: any): number {
    const dx = stop1.lat - stop2.lat;
    const dy = stop1.lon - stop2.lon;
    return Math.sqrt(dx * dx + dy * dy) * 111.32; // 1度の緯度が約111.32km
  }
}
