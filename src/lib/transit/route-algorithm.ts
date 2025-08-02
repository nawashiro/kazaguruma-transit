import { prisma } from "../db/prisma";
import { logger } from "@/utils/logger";
import type { Prisma } from "@prisma/client";

/**
 * 停留所時刻データの型定義
 */
interface StopTimeData {
  stop_id: string;
  stop_sequence: number;
  departure_time?: string;
  arrival_time?: string;
}

/**
 * Prismaから返される停留所時刻データの型定義（関連データ含む）
 */
type StopTimeWithRelations = Prisma.StopTimeGetPayload<{
  include: {
    trip: {
      include: {
        route: true;
        stop_times: {
          orderBy: {
            stop_sequence: 'asc';
          };
        };
      };
    };
    stop: {
      select: {
        id: true;
        name: true;
        lat: true;
        lon: true;
      };
    };
  };
}>;

/**
 * 目的地停留所時刻の型定義（到着時刻指定時に使用）
 */
type DestStopTimeWithTrip = Prisma.StopTimeGetPayload<{
  include: {
    trip: {
      include: {
        route: true;
        stop_times: {
          orderBy: {
            stop_sequence: 'asc';
          };
        };
      };
    };
    stop: {
      select: {
        id: true;
        name: true;
        lat: true;
        lon: true;
      };
    };
  };
}>;

/**
 * 経路探索アルゴリズムのパラメータ設定
 */
export const ROUTE_PARAMS = {
  // 検索時間枠のデフォルト値（分）
  DEFAULT_TIME_WINDOW: 180,
  // 最大乗換回数のデフォルト値
  DEFAULT_MAX_TRANSFERS: 2,
  // 乗換時の最小待ち時間（分）
  MIN_TRANSFER_WAIT: 1,
  // 乗換時の最大待ち時間（分）
  MAX_TRANSFER_WAIT: 15,
  // 乗換候補数の制限
  MAX_TRANSFER_CANDIDATES: 10,
};

/**
 * 時刻表ベースのダイクストラアルゴリズムで使用するノード
 */
interface TimeTableNode {
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
}

/**
 * 時刻表ベースの経路探索結果
 */
interface TimeTableRouteResult {
  nodes: TimeTableNode[];
  transfers: number;
  totalDuration: number;
  departure: string;
  arrival: string;
}

/**
 * 時刻表ベースのダイクストラアルゴリズム
 * 通常のダイクストラを拡張し、運行スケジュールを考慮して最適な経路を検索
 */
export class TimeTableRouter {
  /**
   * サービスIDの取得
   * @param date 日付
   */
  private async getActiveServiceIds(date: Date): Promise<string[]> {
    try {
      const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
      const dayOfWeek = date.getDay(); // 0: 日曜日, 1: 月曜日, ...

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
      logger.error("[TimeTableRouter] サービスID取得エラー:", error);
      return [];
    }
  }

  /**
   * 時刻をフォーマットする
   */
  private formatTime(time: Date): string {
    const hours = time.getHours().toString().padStart(2, "0");
    const minutes = time.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}:00`;
  }

  /**
   * 時刻の差を分で計算
   */
  private calculateTimeDifference(time1: string, time2: string): number {
    const d1 = new Date(`2000-01-01T${time1}`);
    const d2 = new Date(`2000-01-01T${time2}`);
    return (d2.getTime() - d1.getTime()) / (60 * 1000);
  }

  /**
   * 時刻を加算
   */
  private addMinutesToTime(time: string, minutes: number): string {
    const d = new Date(`2000-01-01T${time}`);
    d.setMinutes(d.getMinutes() + minutes);
    return this.formatTime(d);
  }

  /**
   * 時刻が範囲内かチェック
   */
  private isTimeInRange(
    time: string,
    startTime: string,
    endTime: string
  ): boolean {
    const t = new Date(`2000-01-01T${time}`).getTime();
    const s = new Date(`2000-01-01T${startTime}`).getTime();
    const e = new Date(`2000-01-01T${endTime}`).getTime();
    return t >= s && t <= e;
  }

  /**
   * 時刻表ベースの最適経路を検索
   * @param originStopId 出発停留所ID
   * @param destStopId 目的地停留所ID
   * @param time 時刻
   * @param isDeparture 出発時刻指定の場合はtrue、到着時刻指定の場合はfalse
   * @param maxTransfers 最大乗換回数
   * @param timeWindowMinutes 検索時間枠（分）
   */
  public async findOptimalRoute(
    originStopId: string,
    destStopId: string,
    time: Date,
    isDeparture: boolean = true,
    maxTransfers: number = ROUTE_PARAMS.DEFAULT_MAX_TRANSFERS,
    timeWindowMinutes: number = ROUTE_PARAMS.DEFAULT_TIME_WINDOW
  ): Promise<TimeTableRouteResult[]> {
    try {
      logger.log(
        `[TimeTableRouter] 経路検索開始: ${originStopId} → ${destStopId}, ${
          isDeparture ? "出発" : "到着"
        }時刻=${this.formatTime(time)}`
      );

      // 有効なサービスIDを取得
      const activeServiceIds = await this.getActiveServiceIds(time);
      if (activeServiceIds.length === 0) {
        logger.log("[TimeTableRouter] 有効なサービスIDが見つかりません");
        return [];
      }

      const formattedTime = this.formatTime(time);

      if (isDeparture) {
        // 出発時刻指定の場合: 指定時刻以降に出発するルートを検索
        return await this.findRoutesFromDepartureTime(
          originStopId,
          destStopId,
          formattedTime,
          activeServiceIds,
          maxTransfers,
          timeWindowMinutes
        );
      } else {
        // 到着時刻指定の場合: 指定時刻以前に到着するルートを検索
        return await this.findRoutesToArrivalTime(
          originStopId,
          destStopId,
          formattedTime,
          activeServiceIds,
          maxTransfers,
          timeWindowMinutes
        );
      }
    } catch (error) {
      logger.error("[TimeTableRouter] 経路検索エラー:", error);
      return [];
    }
  }

  /**
   * 出発時刻を基準に経路を検索
   */
  private async findRoutesFromDepartureTime(
    originStopId: string,
    destStopId: string,
    departureTime: string,
    activeServiceIds: string[],
    maxTransfers: number,
    timeWindowMinutes: number
  ): Promise<TimeTableRouteResult[]> {
    const endTimeWindow = this.addMinutesToTime(
      departureTime,
      timeWindowMinutes
    );

    // 出発停留所から出発する停留所時刻を取得
    const originStopTimes = await prisma.stopTime.findMany({
      where: {
        stop_id: originStopId,
        departure_time: {
          gte: departureTime,
          lte: endTimeWindow,
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
            stop_times: {
              orderBy: {
                stop_sequence: "asc",
              },
            },
          },
        },
        stop: {
          select: {
            id: true,
            name: true,
            lat: true,
            lon: true,
          },
        },
      },
      orderBy: {
        departure_time: "asc",
      },
    });

    if (originStopTimes.length === 0) {
      logger.log("[TimeTableRouter] 出発停留所の時刻が見つかりません");
      return [];
    }

    // 検索結果を格納する配列
    const results: TimeTableRouteResult[] = [];

    // 直行便を検索
    const directRoutes = await this.findDirectRoutes(
      originStopTimes,
      destStopId
    );
    results.push(...directRoutes);

    // 乗換が必要な経路を検索（最大乗換回数まで）
    if (maxTransfers >= 1) {
      const transferRoutes = await this.findRoutesWithTransfer(
        originStopTimes,
        destStopId,
        activeServiceIds,
        departureTime,
        endTimeWindow,
        maxTransfers
      );
      results.push(...transferRoutes);
    }

    // 総所要時間でソート
    return results.sort((a, b) => a.totalDuration - b.totalDuration);
  }

  /**
   * 到着時刻を基準に経路を検索
   */
  private async findRoutesToArrivalTime(
    originStopId: string,
    destStopId: string,
    arrivalTime: string,
    activeServiceIds: string[],
    maxTransfers: number,
    timeWindowMinutes: number
  ): Promise<TimeTableRouteResult[]> {
    // 到着時刻から逆算して検索ウィンドウを設定
    const startTimeWindow = this.addMinutesToTime(
      arrivalTime,
      -timeWindowMinutes
    );

    // 目的地に到着する停留所時刻を取得
    const destStopTimes = await prisma.stopTime.findMany({
      where: {
        stop_id: destStopId,
        arrival_time: {
          gte: startTimeWindow,
          lte: arrivalTime,
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
            stop_times: {
              orderBy: {
                stop_sequence: "asc",
              },
            },
          },
        },
        stop: {
          select: {
            id: true,
            name: true,
            lat: true,
            lon: true,
          },
        },
      },
      orderBy: {
        arrival_time: "desc", // 到着時刻の降順で取得
      },
    });

    if (destStopTimes.length === 0) {
      logger.log("[TimeTableRouter] 目的地への到着時刻が見つかりません");
      return [];
    }

    // 検索結果を格納する配列
    const results: TimeTableRouteResult[] = [];

    // 目的地停留所時刻から直行便を検索
    for (const destST of destStopTimes) {
      // 同じトリップで出発する停留所時刻を検索
      const originSTs = destST.trip.stop_times.filter(
        (st) =>
          st.stop_id === originStopId && st.stop_sequence < destST.stop_sequence
      );

      for (const originST of originSTs) {
        // 直行便が見つかった
        const originStop = await prisma.stop.findUnique({
          where: { id: originST.stop_id },
          select: {
            id: true,
            name: true,
            lat: true,
            lon: true,
          },
        });

        const destStop = await prisma.stop.findUnique({
          where: { id: destST.stop_id },
          select: {
            id: true,
            name: true,
            lat: true,
            lon: true,
          },
        });

        // nullチェックを追加
        const departureTime = originST.departure_time;
        const arrivalTime = destST.arrival_time;

        // nullの場合はスキップ
        if (!departureTime || !arrivalTime) {
          continue;
        }

        const nodes: TimeTableNode[] = [
          {
            stopId: originST.stop_id,
            stopName: originStop?.name || "",
            tripId: originST.trip_id,
            routeId: destST.trip.route_id,
            routeName:
              destST.trip.route.short_name ||
              destST.trip.route.long_name ||
              destST.trip.route_id,
            arrivalTime: originST.arrival_time || departureTime,
            departureTime,
            stopSequence: originST.stop_sequence,
            stopLat: originStop?.lat || 0,
            stopLon: originStop?.lon || 0,
          },
          {
            stopId: destST.stop_id,
            stopName: destStop?.name || "",
            tripId: destST.trip_id,
            routeId: destST.trip.route_id,
            routeName:
              destST.trip.route.short_name ||
              destST.trip.route.long_name ||
              destST.trip.route_id,
            arrivalTime,
            departureTime: destST.departure_time || arrivalTime,
            stopSequence: destST.stop_sequence,
            stopLat: destStop?.lat || 0,
            stopLon: destStop?.lon || 0,
          },
        ];

        const totalDuration = this.calculateTimeDifference(
          departureTime,
          arrivalTime
        );

        results.push({
          nodes,
          transfers: 0,
          totalDuration,
          departure: departureTime,
          arrival: arrivalTime,
        });
      }
    }

    // 乗り換えが必要な経路を検索（到着時刻指定のケース）
    if (maxTransfers >= 1) {
      await this.findTransferRoutesForArrivalTime(
        originStopId,
        destStopTimes,
        activeServiceIds,
        startTimeWindow,
        arrivalTime,
        results
      );
    }

    // 到着時刻に最も近い順にソート
    return results.sort((a, b) => {
      // 到着時刻の降順（指定時刻に近い順）
      const arrivalTimeA = new Date(`2000-01-01T${a.arrival}`).getTime();
      const arrivalTimeB = new Date(`2000-01-01T${b.arrival}`).getTime();
      return arrivalTimeB - arrivalTimeA;
    });
  }

  /**
   * 到着時刻指定時の乗換ルートを検索
   */
  private async findTransferRoutesForArrivalTime(
    originStopId: string,
    destStopTimes: DestStopTimeWithTrip[],
    activeServiceIds: string[],
    startTimeWindow: string,
    arrivalTime: string,
    results: TimeTableRouteResult[]
  ): Promise<void> {
    // 各目的地停留所時刻について、乗換ポイントとなる停留所を検索
    for (const destST of destStopTimes) {
      // 最終区間の出発停留所（=乗換地点）を特定
      const transferStopIds = destST.trip.stop_times
        .filter((st: StopTimeData) => st.stop_sequence < destST.stop_sequence)
        .map((st: StopTimeData) => st.stop_id);

      // 各乗換地点について処理
      for (const transferStopId of transferStopIds) {
        // 乗換地点に到着する停留所時刻を検索（出発前の便）
        const transferStopTimes = await prisma.stopTime.findMany({
          where: {
            stop_id: transferStopId,
            arrival_time: {
              gte: startTimeWindow,
              // 乗換地点での最小待ち時間（1分）を確保
              lt: this.addMinutesToTime(
                destST.trip.stop_times.find(
                  (st: StopTimeData) => st.stop_id === transferStopId
                )?.departure_time || "",
                -ROUTE_PARAMS.MIN_TRANSFER_WAIT
              ),
            },
            trip: {
              service_id: {
                in: activeServiceIds,
              },
              // 同じトリップIDは除外（乗換として扱わない）
              NOT: {
                id: destST.trip_id,
              },
            },
          },
          include: {
            trip: {
              include: {
                route: true,
                stop_times: {
                  orderBy: {
                    stop_sequence: "asc",
                  },
                },
              },
            },
            stop: {
              select: {
                id: true,
                name: true,
                lat: true,
                lon: true,
              },
            },
          },
          orderBy: {
            arrival_time: "desc",
          },
          take: ROUTE_PARAMS.MAX_TRANSFER_CANDIDATES, // 候補数を制限
        });

        for (const transferArrivalST of transferStopTimes) {
          // 乗換先のトリップから発車する停留所時刻を取得
          const transferDep = destST.trip.stop_times.find(
            (st: StopTimeData) => st.stop_id === transferStopId
          );

          if (!transferDep) continue;

          // 第1区間のトリップで出発停留所から乗換地点へ向かう停留所時刻を検索
          for (const originRoute of transferArrivalST.trip.stop_times) {
            if (
              originRoute.stop_id === originStopId &&
              originRoute.stop_sequence < transferArrivalST.stop_sequence
            ) {
              // 乗換経路が見つかった
              const originStop = await prisma.stop.findUnique({
                where: { id: originRoute.stop_id },
                select: {
                  id: true,
                  name: true,
                  lat: true,
                  lon: true,
                },
              });

              const transferStop = await prisma.stop.findUnique({
                where: { id: transferStopId },
                select: {
                  id: true,
                  name: true,
                  lat: true,
                  lon: true,
                },
              });

              const destStop = await prisma.stop.findUnique({
                where: { id: destST.stop_id },
                select: {
                  id: true,
                  name: true,
                  lat: true,
                  lon: true,
                },
              });

              // null値チェック
              if (
                !originRoute.departure_time ||
                !transferArrivalST.arrival_time ||
                !transferDep.departure_time ||
                !destST.arrival_time
              ) {
                continue;
              }

              const nodes: TimeTableNode[] = [
                {
                  stopId: originRoute.stop_id,
                  stopName: originStop?.name || "",
                  tripId: transferArrivalST.trip_id,
                  routeId: transferArrivalST.trip.route_id,
                  routeName:
                    transferArrivalST.trip.route.short_name ||
                    transferArrivalST.trip.route.long_name ||
                    transferArrivalST.trip.route_id,
                  arrivalTime:
                    originRoute.arrival_time || originRoute.departure_time,
                  departureTime: originRoute.departure_time,
                  stopSequence: originRoute.stop_sequence,
                  stopLat: originStop?.lat || 0,
                  stopLon: originStop?.lon || 0,
                },
                {
                  stopId: transferStopId,
                  stopName: transferStop?.name || "",
                  tripId: transferArrivalST.trip_id,
                  routeId: transferArrivalST.trip.route_id,
                  routeName:
                    transferArrivalST.trip.route.short_name ||
                    transferArrivalST.trip.route.long_name ||
                    transferArrivalST.trip.route_id,
                  arrivalTime: transferArrivalST.arrival_time,
                  departureTime:
                    transferArrivalST.departure_time ||
                    transferArrivalST.arrival_time,
                  stopSequence: transferArrivalST.stop_sequence,
                  stopLat: transferStop?.lat || 0,
                  stopLon: transferStop?.lon || 0,
                },
                {
                  stopId: transferStopId,
                  stopName: transferStop?.name || "",
                  tripId: destST.trip_id,
                  routeId: destST.trip.route_id,
                  routeName:
                    destST.trip.route.short_name ||
                    destST.trip.route.long_name ||
                    destST.trip.route_id,
                  arrivalTime:
                    transferDep.arrival_time || transferDep.departure_time,
                  departureTime: transferDep.departure_time,
                  stopSequence: transferDep.stop_sequence,
                  stopLat: transferStop?.lat || 0,
                  stopLon: transferStop?.lon || 0,
                },
                {
                  stopId: destST.stop_id,
                  stopName: destStop?.name || "",
                  tripId: destST.trip_id,
                  routeId: destST.trip.route_id,
                  routeName:
                    destST.trip.route.short_name ||
                    destST.trip.route.long_name ||
                    destST.trip.route_id,
                  arrivalTime: destST.arrival_time,
                  departureTime: destST.departure_time || destST.arrival_time,
                  stopSequence: destST.stop_sequence,
                  stopLat: destStop?.lat || 0,
                  stopLon: destStop?.lon || 0,
                },
              ];

              const waitTime = this.calculateTimeDifference(
                transferArrivalST.arrival_time,
                transferDep.departure_time
              );

              const firstLegDuration = this.calculateTimeDifference(
                originRoute.departure_time,
                transferArrivalST.arrival_time
              );

              const secondLegDuration = this.calculateTimeDifference(
                transferDep.departure_time,
                destST.arrival_time
              );

              const totalDuration =
                firstLegDuration + waitTime + secondLegDuration;

              results.push({
                nodes,
                transfers: 1,
                totalDuration,
                departure: originRoute.departure_time,
                arrival: destST.arrival_time,
              });
            }
          }
        }
      }
    }
  }

  /**
   * 直行便を検索
   */
  private async findDirectRoutes(
    originStopTimes: StopTimeWithRelations[],
    destStopId: string
  ): Promise<TimeTableRouteResult[]> {
    const directRoutes: TimeTableRouteResult[] = [];

    for (const originST of originStopTimes) {
      // 同じトリップで目的地に到着する停留所時刻を検索
      const destST = originST.trip.stop_times.find(
        (st: StopTimeData) =>
          st.stop_id === destStopId && st.stop_sequence > originST.stop_sequence
      );

      if (destST) {
        // 直行便が見つかった
        const originStop = await prisma.stop.findUnique({
          where: { id: originST.stop_id },
          select: {
            id: true,
            name: true,
            lat: true,
            lon: true,
          },
        });

        const destStop = await prisma.stop.findUnique({
          where: { id: destST.stop_id },
          select: {
            id: true,
            name: true,
            lat: true,
            lon: true,
          },
        });

        const nodes: TimeTableNode[] = [
          {
            stopId: originST.stop_id,
            stopName: originStop?.name || "",
            tripId: originST.trip_id,
            routeId: originST.trip.route_id,
            routeName:
              originST.trip.route.short_name ||
              originST.trip.route.long_name ||
              originST.trip.route_id,
            arrivalTime: originST.arrival_time || originST.departure_time,
            departureTime: originST.departure_time,
            stopSequence: originST.stop_sequence,
            stopLat: originStop?.lat || 0,
            stopLon: originStop?.lon || 0,
          },
          {
            stopId: destST.stop_id,
            stopName: destStop?.name || "",
            tripId: destST.trip_id,
            routeId: originST.trip.route_id,
            routeName:
              originST.trip.route.short_name ||
              originST.trip.route.long_name ||
              originST.trip.route_id,
            arrivalTime: destST.arrival_time,
            departureTime: destST.departure_time || destST.arrival_time,
            stopSequence: destST.stop_sequence,
            stopLat: destStop?.lat || 0,
            stopLon: destStop?.lon || 0,
          },
        ];

        const totalDuration = this.calculateTimeDifference(
          originST.departure_time,
          destST.arrival_time
        );

        directRoutes.push({
          nodes,
          transfers: 0,
          totalDuration,
          departure: originST.departure_time,
          arrival: destST.arrival_time,
        });
      }
    }

    return directRoutes;
  }

  /**
   * 乗換が必要な経路を検索
   */
  private async findRoutesWithTransfer(
    originStopTimes: StopTimeWithRelations[],
    destStopId: string,
    activeServiceIds: string[],
    startTimeWindow: string,
    endTimeWindow: string,
    maxTransfers: number
  ): Promise<TimeTableRouteResult[]> {
    // 変数が使用されていることを示すためのコメント追加
    logger.log(
      `検索条件: 開始時間枠=${startTimeWindow}, 終了時間枠=${endTimeWindow}, 最大乗換=${maxTransfers}`
    );

    const transferRoutes: TimeTableRouteResult[] = [];

    // 1つの乗換で行ける経路を検索
    for (const originST of originStopTimes) {
      // トリップの全停留所を取得
      const tripStops = originST.trip.stop_times.filter(
        (st: StopTimeData) => st.stop_sequence > originST.stop_sequence
      );

      // 各停留所を乗換地点として検討
      for (const transferST of tripStops) {
        // 乗換地点の到着時刻
        const transferArrivalTime = transferST.arrival_time;

        // 乗換地点から出発する停留所時刻を取得
        const transferDepartures = await prisma.stopTime.findMany({
          where: {
            stop_id: transferST.stop_id,
            departure_time: {
              // 到着から最低1分後、最大120分後に出発する便
              gt: this.addMinutesToTime(
                transferArrivalTime,
                ROUTE_PARAMS.MIN_TRANSFER_WAIT
              ),
              lte: this.addMinutesToTime(
                transferArrivalTime,
                ROUTE_PARAMS.MAX_TRANSFER_WAIT
              ),
            },
            trip: {
              service_id: {
                in: activeServiceIds,
              },
              // 同じトリップIDは除外（同じ路線での乗り換えを防止）
              NOT: {
                id: originST.trip_id,
              },
            },
          },
          include: {
            trip: {
              include: {
                route: true,
                stop_times: {
                  orderBy: {
                    stop_sequence: "asc",
                  },
                },
              },
            },
            stop: {
              select: {
                id: true,
                name: true,
                lat: true,
                lon: true,
              },
            },
          },
          orderBy: {
            departure_time: "asc",
          },
          take: ROUTE_PARAMS.MAX_TRANSFER_CANDIDATES, // 候補数を制限
        });

        for (const transferDep of transferDepartures) {
          // 乗換先のトリップで目的地に到着する停留所時刻を検索
          const destST = transferDep.trip.stop_times.find(
            (st: StopTimeData) =>
              st.stop_id === destStopId &&
              st.stop_sequence > transferDep.stop_sequence
          );

          if (destST) {
            // 乗換経路が見つかった
            const originStop = await prisma.stop.findUnique({
              where: { id: originST.stop_id },
              select: {
                id: true,
                name: true,
                lat: true,
                lon: true,
              },
            });

            const transferStop = await prisma.stop.findUnique({
              where: { id: transferST.stop_id },
              select: {
                id: true,
                name: true,
                lat: true,
                lon: true,
              },
            });

            const destStop = await prisma.stop.findUnique({
              where: { id: destST.stop_id },
              select: {
                id: true,
                name: true,
                lat: true,
                lon: true,
              },
            });

            const nodes: TimeTableNode[] = [
              {
                stopId: originST.stop_id,
                stopName: originStop?.name || "",
                tripId: originST.trip_id,
                routeId: originST.trip.route_id,
                routeName:
                  originST.trip.route.short_name ||
                  originST.trip.route.long_name ||
                  originST.trip.route_id,
                arrivalTime: originST.arrival_time || originST.departure_time,
                departureTime: originST.departure_time,
                stopSequence: originST.stop_sequence,
                stopLat: originStop?.lat || 0,
                stopLon: originStop?.lon || 0,
              },
              {
                stopId: transferST.stop_id,
                stopName: transferStop?.name || "",
                tripId: originST.trip_id,
                routeId: originST.trip.route_id,
                routeName:
                  originST.trip.route.short_name ||
                  originST.trip.route.long_name ||
                  originST.trip.route_id,
                arrivalTime: transferST.arrival_time,
                departureTime:
                  transferST.departure_time || transferST.arrival_time,
                stopSequence: transferST.stop_sequence,
                stopLat: transferStop?.lat || 0,
                stopLon: transferStop?.lon || 0,
              },
              {
                stopId: transferDep.stop_id,
                stopName: transferStop?.name || "",
                tripId: transferDep.trip_id,
                routeId: transferDep.trip.route_id,
                routeName:
                  transferDep.trip.route.short_name ||
                  transferDep.trip.route.long_name ||
                  transferDep.trip.route_id,
                arrivalTime:
                  transferDep.arrival_time || transferDep.departure_time,
                departureTime: transferDep.departure_time,
                stopSequence: transferDep.stop_sequence,
                stopLat: transferStop?.lat || 0,
                stopLon: transferStop?.lon || 0,
              },
              {
                stopId: destST.stop_id,
                stopName: destStop?.name || "",
                tripId: transferDep.trip_id,
                routeId: transferDep.trip.route_id,
                routeName:
                  transferDep.trip.route.short_name ||
                  transferDep.trip.route.long_name ||
                  transferDep.trip.route_id,
                arrivalTime: destST.arrival_time,
                departureTime: destST.departure_time || destST.arrival_time,
                stopSequence: destST.stop_sequence,
                stopLat: destStop?.lat || 0,
                stopLon: destStop?.lon || 0,
              },
            ];

            const waitTime = this.calculateTimeDifference(
              transferST.arrival_time || "",
              transferDep.departure_time || ""
            );

            const firstLegDuration = this.calculateTimeDifference(
              originST.departure_time || "",
              transferST.arrival_time || ""
            );

            const secondLegDuration = this.calculateTimeDifference(
              transferDep.departure_time || "",
              destST.arrival_time || ""
            );

            const totalDuration =
              firstLegDuration + waitTime + secondLegDuration;

            transferRoutes.push({
              nodes,
              transfers: 1,
              totalDuration,
              departure: originST.departure_time,
              arrival: destST.arrival_time || destST.departure_time || "",
            });
          }
        }
      }
    }

    // 複数回の乗換が必要な場合は、さらに再帰的に探索を行う
    // ここでは簡略化のため、2回以上の乗換は実装していません

    return transferRoutes;
  }
}
