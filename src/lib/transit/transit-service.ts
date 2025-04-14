import fs from "fs";
import path from "path";
import { prisma } from "../db/prisma";
import { Prisma } from "@prisma/client";
import {
  TransitQuery,
  RouteQuery,
  StopQuery,
  TimetableQuery,
  TransitResponse,
} from "@/types/transit-api";
import { loadConfig, TransitConfig } from "../config/config";
import { logger } from "../../utils/logger";

// タイプエイリアス定義
type PrismaStop = Prisma.StopGetPayload<{
  select: {
    id: true;
    name: true;
    lat: true;
    lon: true;
  };
}>;

type PrismaStopTime = Prisma.StopTimeGetPayload<{
  include: {
    trip: {
      select: {
        id: true;
        route_id: true;
        headsign: true;
      };
    };
  };
}>;

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
          logger.log(
            `[TransitService] 直行便が見つかりました: ${allRoutes.length}件`
          );
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
          logger.log(
            `[TransitService] 乗換経路が見つかりました: ${transferResults.data.journeys.length}件、合計 ${allRoutes.length}件`
          );
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
   * 乗り換えを含む経路を検索
   */
  private async findRouteWithTransfer(
    origin: any,
    destination: any,
    time?: string,
    isDeparture: boolean = true
  ): Promise<TransitResponse> {
    try {
      logger.log(
        `[TransitService] 乗り換え検索を開始: ${origin.stop_id} → ${destination.stop_id}`
      );

      // 直線距離を計算（km単位）
      const directDistance = this.calculateDistance(
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng
      );

      // 直線距離が500m未満の場合、乗り換え検索をスキップ
      if (directDistance < 0.5) {
        logger.log(
          `[TransitService] 目的地までの距離が近すぎるため乗り換え検索をスキップします (${directDistance.toFixed(
            2
          )}km)`
        );
        return {
          success: true,
          data: { journeys: [], stops: [] },
        };
      }

      const timeStr = this.formatTime(time ? new Date(time) : new Date());
      const dateStr = time
        ? new Date(time).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const requestedDate = new Date(dateStr);
      const dayOfWeek = requestedDate.getDay();
      const formattedDate = requestedDate
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

      // 有効なサービスを取得
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

      if (serviceIds.length === 0) {
        logger.log("[TransitService] 本日の有効なサービスが見つかりません");
        return {
          success: true,
          data: { journeys: [], stops: [] },
        };
      }

      // ルート情報を取得（null問題を避けるため先に取得）
      const routes = await prisma.route.findMany({
        select: {
          id: true,
          short_name: true,
          long_name: true,
          color: true,
          text_color: true,
        },
      });

      // ルート情報のマップを作成
      const routeMap = new Map();
      routes.forEach((route) => {
        routeMap.set(route.id, {
          id: route.id,
          short_name: route.short_name || "",
          long_name: route.long_name || "",
          color: route.color,
          text_color: route.text_color,
        });
      });

      // 乗り換え候補を絞り込むための矩形領域を作成
      const EXPANSION_FACTOR = 1.2; // 拡張係数（バス停が矩形外にある場合を考慮）

      // 矩形領域の座標を計算
      const minLat =
        Math.min(origin.lat, destination.lat) -
        Math.abs(origin.lat - destination.lat) * (EXPANSION_FACTOR - 1);
      const maxLat =
        Math.max(origin.lat, destination.lat) +
        Math.abs(origin.lat - destination.lat) * (EXPANSION_FACTOR - 1);
      const minLng =
        Math.min(origin.lng, destination.lng) -
        Math.abs(origin.lng - destination.lng) * (EXPANSION_FACTOR - 1);
      const maxLng =
        Math.max(origin.lng, destination.lng) +
        Math.abs(origin.lng - destination.lng) * (EXPANSION_FACTOR - 1);

      logger.log(
        `[TransitService] 検索範囲: lat(${minLat.toFixed(6)}-${maxLat.toFixed(
          6
        )}), lng(${minLng.toFixed(6)}-${maxLng.toFixed(6)})`
      );

      // 乗り換え候補のバス停を取得（矩形領域内のもののみ）
      const transferCandidates = await prisma.stop.findMany({
        where: {
          lat: {
            gte: minLat,
            lte: maxLat,
          },
          lon: {
            gte: minLng,
            lte: maxLng,
          },
          NOT: [
            {
              id: origin.stop_id,
            },
            {
              id: destination.stop_id,
            },
          ],
        },
        select: {
          id: true,
          name: true,
          lat: true,
          lon: true,
        },
      });

      if (transferCandidates.length === 0) {
        logger.log(
          "[TransitService] 乗り換え候補のバス停が見つかりませんでした"
        );
        return {
          success: true,
          data: { journeys: [], stops: [] },
        };
      }

      logger.log(
        `[TransitService] 乗り換え候補バス停数: ${transferCandidates.length}`
      );

      // 方向ベクトルを計算（出発地から目的地への方向）
      const directionVector = {
        lat: destination.lat - origin.lat,
        lng: destination.lng - origin.lng,
      };

      // 方向ベクトルの長さ（直線距離）
      const vectorLength = Math.sqrt(
        directionVector.lat * directionVector.lat +
          directionVector.lng * directionVector.lng
      );

      // 方向ベクトルを正規化（単位ベクトル化）
      const normalizedDirection = {
        lat: directionVector.lat / vectorLength,
        lng: directionVector.lng / vectorLength,
      };

      // 各乗り換え候補について、方向スコアと距離を計算
      const scoredCandidates = transferCandidates.map((stop) => {
        // 出発地からの距離（km）
        const distanceFromOrigin = this.calculateDistance(
          origin.lat,
          origin.lng,
          stop.lat,
          stop.lon
        );

        // 目的地までの距離（km）
        const distanceToDestination = this.calculateDistance(
          stop.lat,
          stop.lon,
          destination.lat,
          destination.lng
        );

        // バス停から見た方向ベクトル（出発地からバス停への方向）
        const stopVector = {
          lat: stop.lat - origin.lat,
          lng: stop.lon - origin.lng,
        };

        // stopVectorの長さを計算
        const stopVectorLength = Math.sqrt(
          stopVector.lat * stopVector.lat + stopVector.lng * stopVector.lng
        );

        // 方向スコアを計算（内積を使用：-1から1の範囲、1が完全に同じ方向）
        let directionScore = 0;
        if (stopVectorLength > 0) {
          // stopVectorを正規化
          const normalizedStopVector = {
            lat: stopVector.lat / stopVectorLength,
            lng: stopVector.lng / stopVectorLength,
          };

          // 内積を計算
          directionScore =
            normalizedDirection.lat * normalizedStopVector.lat +
            normalizedDirection.lng * normalizedStopVector.lng;
        }

        // 総合スコアを計算（方向スコアと距離の組み合わせ）
        const combinedScore =
          directionScore * (1 / (distanceFromOrigin + distanceToDestination));

        return {
          ...stop,
          distanceFromOrigin,
          distanceToDestination,
          totalDistance: distanceFromOrigin + distanceToDestination,
          directionScore,
          combinedScore,
          // 経路長の比率（総距離 / 直線距離）- 小さいほど効率的
          distanceRatio:
            (distanceFromOrigin + distanceToDestination) / directDistance,
        };
      });

      // 条件による絞り込み
      // 1. 方向スコアが0.5以上（進行方向に概ね一致）
      // 2. 距離比率が1.8以下（直線距離の1.8倍以内の経路）
      const MAX_DISTANCE_RATIO = 1.8;
      const MIN_DIRECTION_SCORE = 0.5;

      const filteredCandidates = scoredCandidates
        .filter(
          (stop) =>
            stop.directionScore >= MIN_DIRECTION_SCORE &&
            stop.distanceRatio <= MAX_DISTANCE_RATIO
        )
        .sort((a, b) => b.combinedScore - a.combinedScore) // スコアの降順
        .slice(0, 5); // 最大5件に制限

      if (filteredCandidates.length === 0) {
        logger.log(
          "[TransitService] 条件を満たす乗り換え候補が見つかりませんでした"
        );
        return {
          success: true,
          data: { journeys: [], stops: [] },
        };
      }

      logger.log(
        `[TransitService] 絞り込み後の乗り換え候補数: ${filteredCandidates.length}`
      );

      // 各乗り換え候補について乗り換え経路を検索
      const journeys = await this.findTransferJourneysWithCandidates(
        origin,
        destination,
        filteredCandidates,
        timeStr,
        serviceIds,
        routeMap,
        isDeparture
      );

      return this.formatRouteResults(journeys, true);
    } catch (error) {
      logger.error("[TransitService] 乗り換え検索エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "乗り換え検索中にエラーが発生しました",
        data: { journeys: [], stops: [] },
      };
    }
  }

  /**
   * 最適化された乗り換え経路検索処理
   * 事前に取得したデータを再利用し、クエリ数を削減
   */
  private async findTransferJourneysOptimized(
    originStop: any,
    transferStop: any,
    destStop: any,
    originStopTimes: any[],
    tripMap: Map<string, any>,
    timeStr: string,
    isDeparture: boolean = true
  ): Promise<any[]> {
    const journeys = [];
    const MAX_RESULTS = 3;
    const MAX_TRANSFER_WAIT_MINUTES = 45;
    const MIN_TRANSFER_WAIT_MINUTES = 3;

    try {
      if (isDeparture) {
        // 使用するtrip_idのリスト
        const relevantTripIds = originStopTimes.map((st) => st.trip_id);
        if (relevantTripIds.length === 0) return [];

        // 乗り換えバス停と目的地のストップタイムを一度に取得（バッチ処理）
        // これにより個別クエリの数を大幅に削減
        const allTransferStopTimes = await prisma.stopTime.findMany({
          where: {
            stop_id: transferStop.id,
            trip_id: {
              in: relevantTripIds,
            },
            stop_sequence: {
              gt: 0, // 任意の正の値
            },
          },
          select: {
            trip_id: true,
            arrival_time: true,
            departure_time: true,
            stop_sequence: true,
          },
          orderBy: [{ trip_id: "asc" }, { stop_sequence: "asc" }],
        });

        // 出発地→乗り換え地点の経路マップを構築
        const originToTransferMap = new Map();
        for (const transferTime of allTransferStopTimes) {
          if (!transferTime.arrival_time) continue;

          // まだそのトリップが登録されていなければ追加
          if (!originToTransferMap.has(transferTime.trip_id)) {
            originToTransferMap.set(transferTime.trip_id, transferTime);
          }
        }

        // 乗り換え地点から目的地への乗り継ぎ候補を取得
        // 全てのtrip_idを対象に目的地のstop_timesを取得
        const allDestinationStopTimes = await prisma.stopTime.findMany({
          where: {
            stop_id: destStop.id,
            trip_id: {
              in: Array.from(tripMap.keys()),
              notIn: relevantTripIds, // 最初の足と同じトリップは除外
            },
          },
          select: {
            trip_id: true,
            arrival_time: true,
            stop_sequence: true,
          },
          orderBy: [{ arrival_time: "asc" }],
        });

        // 乗り換え地点→目的地の経路マップを構築
        const transferToDestMap = new Map();
        for (const destTime of allDestinationStopTimes) {
          if (!destTime.arrival_time) continue;
          transferToDestMap.set(destTime.trip_id, destTime);
        }

        // 乗り換え地点での接続を見つける
        const transferConnections = await prisma.stopTime.findMany({
          where: {
            stop_id: transferStop.id,
            trip_id: {
              in: Array.from(transferToDestMap.keys()),
            },
          },
          select: {
            trip_id: true,
            departure_time: true,
            stop_sequence: true,
          },
          orderBy: [{ departure_time: "asc" }],
        });

        // 接続情報をマップに整理
        const connectionMap = new Map();
        for (const conn of transferConnections) {
          if (!conn.departure_time) continue;
          if (!connectionMap.has(conn.trip_id)) {
            connectionMap.set(conn.trip_id, conn);
          }
        }

        // 各出発便について乗り換え経路を検索
        for (const originST of originStopTimes) {
          if (!originST.departure_time) continue;

          const originTrip = tripMap.get(originST.trip_id);
          if (!originTrip) continue;

          // この出発便から乗り換え地点への到着を取得
          const transferArrival = originToTransferMap.get(originST.trip_id);
          if (!transferArrival || !transferArrival.arrival_time) continue;

          // この出発便のシーケンスが乗り換えのシーケンスより前かチェック
          if (originST.stop_sequence >= transferArrival.stop_sequence) continue;

          // 有効な乗り換え接続を探す
          let validConnections = [];
          for (const [connTripId, conn] of connectionMap.entries()) {
            // 乗り換え時間を計算
            const transferWaitMinutes = this.calculateTimeDiffMinutes(
              transferArrival.arrival_time,
              conn.departure_time
            );

            // 待ち時間が妥当な範囲内か確認
            if (
              transferWaitMinutes < MIN_TRANSFER_WAIT_MINUTES ||
              transferWaitMinutes > MAX_TRANSFER_WAIT_MINUTES
            )
              continue;

            // 同じ路線での乗り換えを避ける
            const secondLegTrip = tripMap.get(conn.trip_id);
            if (!secondLegTrip) continue;
            if (originTrip.route_id === secondLegTrip.route_id) continue;

            // この乗り換えで目的地に到着できるか確認
            const destArrival = transferToDestMap.get(conn.trip_id);
            if (!destArrival || !destArrival.arrival_time) continue;

            // 乗り換え地点のシーケンスと目的地のシーケンスを確認
            if (conn.stop_sequence >= destArrival.stop_sequence) continue;

            // 総所要時間を計算
            const totalDurationMinutes = this.calculateTimeDiffMinutes(
              originST.departure_time,
              destArrival.arrival_time
            );

            validConnections.push({
              secondLegTrip,
              departure: conn.departure_time,
              arrival: destArrival.arrival_time,
              waitTime: transferWaitMinutes,
              totalDuration: totalDurationMinutes,
            });

            // 十分な接続が見つかったら早期終了
            if (validConnections.length >= MAX_RESULTS) break;
          }

          // 有効な接続それぞれについて経路を構築
          for (const conn of validConnections) {
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
                  departure_time: this.formatTimeString(
                    originST.departure_time
                  ),
                  arrival_time: this.formatTimeString(conn.arrival),
                  trip_id: originST.trip_id,
                  route: {
                    id: originTrip.route.id,
                    name:
                      originTrip.route.short_name ||
                      originTrip.route.long_name ||
                      "名称不明",
                    short_name: originTrip.route.short_name,
                    long_name: originTrip.route.long_name,
                    color: originTrip.route.color
                      ? `#${originTrip.route.color}`
                      : "#000000",
                    text_color: originTrip.route.text_color
                      ? `#${originTrip.route.text_color}`
                      : "#FFFFFF",
                  },
                  headsign: originTrip.headsign || "不明",
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
                  departure_time: this.formatTimeString(conn.departure),
                  arrival_time: this.formatTimeString(conn.arrival),
                  trip_id: conn.secondLegTrip.id,
                  route: {
                    id: conn.secondLegTrip.route.id,
                    name:
                      conn.secondLegTrip.route.short_name ||
                      conn.secondLegTrip.route.long_name ||
                      "名称不明",
                    short_name: conn.secondLegTrip.route.short_name,
                    long_name: conn.secondLegTrip.route.long_name,
                    color: conn.secondLegTrip.route.color
                      ? `#${conn.secondLegTrip.route.color}`
                      : "#000000",
                    text_color: conn.secondLegTrip.route.text_color
                      ? `#${conn.secondLegTrip.route.text_color}`
                      : "#FFFFFF",
                  },
                  headsign: conn.secondLegTrip.headsign || "不明",
                },
              ],
              departure_time: this.formatTimeString(originST.departure_time),
              arrival_time: this.formatTimeString(conn.arrival),
              duration: conn.totalDuration,
              transfer_time: conn.waitTime,
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
              // formatRouteResults で使用されるフィールドを追加
              origin_stop_id: originStop.id,
              origin_stop_name: originStop.name || "名称不明",
              origin_stop_lat: originStop.lat,
              origin_stop_lon: originStop.lon,
              origin_distance: 0,
              destination_stop_id: destStop.id,
              destination_stop_name: destStop.name || "名称不明",
              destination_stop_lat: destStop.lat,
              destination_stop_lon: destStop.lon,
              destination_distance: 0,
            });

            // 最大結果数に達したら早期終了
            if (journeys.length >= MAX_RESULTS) break;
          }

          if (journeys.length >= MAX_RESULTS) break;
        }
      } else {
        // 到着時刻指定の場合の処理（仕組みは同様だが逆順）
        // 実装は省略
      }
    } catch (error) {
      logger.error(
        "[TransitService] 最適化された乗り換え経路検索でエラー:",
        error
      );
    }

    // 時間順にソート
    journeys.sort((a, b) => {
      if (isDeparture) {
        return (
          new Date(
            `2000-01-01T${this.formatTimeString(a.departure_time)}`
          ).getTime() -
          new Date(
            `2000-01-01T${this.formatTimeString(b.departure_time)}`
          ).getTime()
        );
      } else {
        return (
          new Date(
            `2000-01-01T${this.formatTimeString(b.arrival_time)}`
          ).getTime() -
          new Date(
            `2000-01-01T${this.formatTimeString(a.arrival_time)}`
          ).getTime()
        );
      }
    });

    return journeys;
  }

  /**
   * 時刻文字列間の差分を分単位で計算
   */
  private calculateTimeDiffMinutes(start: string, end: string): number {
    if (!start || !end) return 0;

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
        orderBy: [{ departure_time: "asc" }],
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
   * 経路検索結果をフォーマット
   */
  private formatRouteResults(
    journeys: any[],
    hasTransfer: boolean
  ): TransitResponse {
    if (journeys.length === 0) {
      return {
        success: true,
        data: { journeys: [], stops: [] },
      };
    }

    logger.log(
      `[TransitService] 経路検索結果のフォーマット: ${
        journeys.length
      }件の経路、${hasTransfer ? "乗換あり" : "直行便"}`
    );

    try {
      // 出発地と目的地の情報を取得
      const originStop = {
        id: journeys[0].origin_stop_id,
        name: journeys[0].origin_stop_name,
        distance: journeys[0].origin_distance || 0,
        lat: parseFloat(journeys[0].origin_stop_lat),
        lng: parseFloat(journeys[0].origin_stop_lon),
      };

      const destStop = {
        id: journeys[0].destination_stop_id,
        name: journeys[0].destination_stop_name,
        distance: journeys[0].destination_distance || 0,
        lat: parseFloat(journeys[0].destination_stop_lat),
        lng: parseFloat(journeys[0].destination_stop_lon),
      };

      // 停留所リスト
      let stops = [originStop, destStop];

      // 乗り換え停留所を追加
      const transferStops = journeys
        .filter((j) => j.transfer_stop_id)
        .map((j) => ({
          id: j.transfer_stop_id,
          name: j.transfer_stop_name,
          distance: j.transfer_distance || 0,
          lat: parseFloat(j.transfer_stop_lat),
          lng: parseFloat(j.transfer_stop_lon),
        }));

      if (transferStops.length > 0) {
        stops = stops.concat(transferStops);
      }

      // 重複停留所を削除
      const uniqueStops = stops.filter(
        (stop, index, self) => index === self.findIndex((s) => s.id === stop.id)
      );

      // 経路情報をフォーマット
      const formattedJourneys = journeys.map((journey) => {
        // 直行便の場合
        if (!hasTransfer || !journey.transfer_stop_id) {
          const formatted = {
            type: "direct",
            // クライアント側で使用される属性
            from: journey.origin_stop_name,
            to: journey.destination_stop_name,
            route: journey.route_name,
            color: journey.route_color || "808080",
            textColor: journey.route_text_color || "FFFFFF",
            departure: this.formatTimeString(journey.departure_time),
            arrival: this.formatTimeString(journey.arrival_time),
            duration: journey.duration,
            transfers: 0,
            // レンダリングに必要な詳細情報
            legs: [
              {
                origin: {
                  id: journey.origin_stop_id,
                  name: journey.origin_stop_name,
                  lat: parseFloat(journey.origin_stop_lat),
                  lng: parseFloat(journey.origin_stop_lon),
                },
                destination: {
                  id: journey.destination_stop_id,
                  name: journey.destination_stop_name,
                  lat: parseFloat(journey.destination_stop_lat),
                  lng: parseFloat(journey.destination_stop_lon),
                },
                departureTime: this.formatTimeString(journey.departure_time),
                arrivalTime: this.formatTimeString(journey.arrival_time),
                duration: journey.duration,
                routeId: journey.route_id,
                routeName: journey.route_name,
                routeShortName: journey.route_short_name || journey.route_name,
                routeLongName: journey.route_long_name || "",
                routeColor: journey.route_color || "808080",
                routeTextColor: journey.route_text_color || "FFFFFF",
                tripHeadsign: journey.trip_headsign || "",
              },
            ],
          };
          logger.log(
            `[TransitService] 直行便経路フォーマット: ${JSON.stringify(
              formatted
            )}`
          );
          return formatted;
        }

        // 乗り換え経路の場合
        const transferInfo = {
          stop: journey.transfer_stop_name,
          waitTime: journey.transfer_wait_time || 0,
          location: {
            lat: parseFloat(journey.transfer_stop_lat),
            lng: parseFloat(journey.transfer_stop_lon),
          },
        };

        const segments = [
          {
            from: journey.origin_stop_name,
            to: journey.transfer_stop_name,
            departure: this.formatTimeString(journey.first_leg_departure_time),
            arrival: this.formatTimeString(journey.first_leg_arrival_time),
            duration: journey.first_leg_duration,
            route: journey.first_leg_route_name,
            color: journey.first_leg_route_color || "808080",
            textColor: journey.first_leg_route_text_color || "FFFFFF",
          },
          {
            from: journey.transfer_stop_name,
            to: journey.destination_stop_name,
            departure: this.formatTimeString(journey.second_leg_departure_time),
            arrival: this.formatTimeString(journey.second_leg_arrival_time),
            duration: journey.second_leg_duration,
            route: journey.second_leg_route_name,
            color: journey.second_leg_route_color || "808080",
            textColor: journey.second_leg_route_text_color || "FFFFFF",
          },
        ];

        const formatted = {
          type: "transfer",
          // クライアント側で使用される属性
          from: journey.origin_stop_name,
          to: journey.destination_stop_name,
          departure: this.formatTimeString(journey.first_leg_departure_time),
          arrival: this.formatTimeString(journey.second_leg_arrival_time),
          duration: journey.total_duration,
          transfers: 1,
          segments,
          transferInfo,
          // レンダリングに必要な詳細情報
          legs: [
            {
              origin: {
                id: journey.origin_stop_id,
                name: journey.origin_stop_name,
                lat: parseFloat(journey.origin_stop_lat),
                lng: parseFloat(journey.origin_stop_lon),
              },
              destination: {
                id: journey.transfer_stop_id,
                name: journey.transfer_stop_name,
                lat: parseFloat(journey.transfer_stop_lat),
                lng: parseFloat(journey.transfer_stop_lon),
              },
              departureTime: this.formatTimeString(
                journey.first_leg_departure_time
              ),
              arrivalTime: this.formatTimeString(
                journey.first_leg_arrival_time
              ),
              duration: journey.first_leg_duration,
              routeId: journey.first_leg_route_id,
              routeName: journey.first_leg_route_name,
              routeShortName: journey.first_leg_route_short_name,
              routeLongName: journey.first_leg_route_long_name,
              routeColor: journey.first_leg_route_color || "808080",
              routeTextColor: journey.first_leg_route_text_color || "FFFFFF",
              tripHeadsign: journey.first_leg_trip_headsign || "",
            },
            {
              origin: {
                id: journey.transfer_stop_id,
                name: journey.transfer_stop_name,
                lat: parseFloat(journey.transfer_stop_lat),
                lng: parseFloat(journey.transfer_stop_lon),
              },
              destination: {
                id: journey.destination_stop_id,
                name: journey.destination_stop_name,
                lat: parseFloat(journey.destination_stop_lat),
                lng: parseFloat(journey.destination_stop_lon),
              },
              departureTime: this.formatTimeString(
                journey.second_leg_departure_time
              ),
              arrivalTime: this.formatTimeString(
                journey.second_leg_arrival_time
              ),
              duration: journey.second_leg_duration,
              routeId: journey.second_leg_route_id,
              routeName: journey.second_leg_route_name,
              routeShortName: journey.second_leg_route_short_name,
              routeLongName: journey.second_leg_route_long_name,
              routeColor: journey.second_leg_route_color || "808080",
              routeTextColor: journey.second_leg_route_text_color || "FFFFFF",
              tripHeadsign: journey.second_leg_trip_headsign || "",
            },
          ],
        };

        logger.log(
          `[TransitService] 乗換経路フォーマット: ${JSON.stringify(formatted)}`
        );
        return formatted;
      });

      logger.log(
        `[TransitService] ${formattedJourneys.length}件の経路をフォーマットしました`
      );
      for (let i = 0; i < formattedJourneys.length; i++) {
        const j = formattedJourneys[i];
        logger.log(
          `[TransitService] 経路${i + 1}: タイプ=${j.type}, 出発=${
            j.departure
          }, 到着=${j.arrival}, 所要時間=${j.duration}分`
        );
      }

      return {
        success: true,
        data: {
          journeys: formattedJourneys,
          stops: uniqueStops,
        },
      };
    } catch (error) {
      logger.error("[TransitService] 経路結果フォーマットエラー:", error);
      return {
        success: false,
        error: "経路結果のフォーマット中にエラーが発生しました",
        data: { journeys: [], stops: [] },
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

  /**
   * 直行便の経路を検索
   */
  private async findDirectRoute(
    origin: any,
    destination: any,
    time?: string,
    isDeparture: boolean = true
  ): Promise<TransitResponse> {
    try {
      logger.log(
        `[TransitService] 直行便検索を開始: ${origin.stop_id} → ${destination.stop_id}`
      );

      const timeStr = this.formatTime(time ? new Date(time) : new Date());
      const dateStr = time
        ? new Date(time).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const requestedDate = new Date(dateStr);
      const dayOfWeek = requestedDate.getDay();
      const formattedDate = requestedDate
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

      // 有効なサービスを取得
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

      if (serviceIds.length === 0) {
        logger.log("[TransitService] 本日の有効なサービスが見つかりません");
        return {
          success: true,
          data: { journeys: [], stops: [] },
        };
      }

      // ルート情報を取得
      const validRoutes = await prisma.route.findMany({
        select: {
          id: true,
          short_name: true,
          long_name: true,
          color: true,
          text_color: true,
        },
      });

      // ルート情報のマップを作成
      const routeMap = new Map();
      validRoutes.forEach((route) => {
        routeMap.set(route.id, {
          id: route.id,
          short_name: route.short_name || "",
          long_name: route.long_name || "",
          color: route.color,
          text_color: route.text_color,
        });
      });

      try {
        const results = await this.findDirectRouteBetweenStops(
          origin.stop_id,
          destination.stop_id,
          timeStr,
          serviceIds,
          routeMap,
          isDeparture
        );

        // 検索結果を整形
        if (results.length === 0) {
          return {
            success: true,
            data: {
              journeys: [],
              stops: [
                {
                  id: origin.stop_id,
                  name: origin.stop_name,
                  distance: 0,
                  lat: parseFloat(origin.lat),
                  lng: parseFloat(origin.lng),
                },
                {
                  id: destination.stop_id,
                  name: destination.stop_name,
                  distance: 0,
                  lat: parseFloat(destination.lat),
                  lng: parseFloat(destination.lng),
                },
              ],
            },
          };
        }

        // 経路情報を追加
        const journeys = results.map((result) => ({
          ...result,
          origin_stop_id: origin.stop_id,
          origin_stop_name: origin.stop_name,
          origin_stop_lat: origin.lat,
          origin_stop_lon: origin.lng,
          origin_distance: 0,
          destination_stop_id: destination.stop_id,
          destination_stop_name: destination.stop_name,
          destination_stop_lat: destination.lat,
          destination_stop_lon: destination.lng,
          destination_distance: 0,
        }));

        // 結果をフォーマットして返す
        return this.formatRouteResults(journeys, false);
      } catch (queryError) {
        logger.error("[TransitService] 直行便検索クエリエラー:", queryError);
        return {
          success: false,
          error: "経路検索中にエラーが発生しました",
          data: { journeys: [], stops: [] },
        };
      }
    } catch (error) {
      logger.error("[TransitService] 経路検索エラー:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "経路検索中にエラーが発生しました",
        data: { journeys: [], stops: [] },
      };
    }
  }

  /**
   * 乗り換え候補を使用して経路を検索
   * @param origin 出発地
   * @param destination 目的地
   * @param transferCandidates 乗り換え候補バス停
   * @param timeStr 時刻文字列
   * @param serviceIds 有効なサービスID
   * @param routeMap ルート情報のマップ
   * @param isDeparture 出発時刻指定かどうか
   */
  private async findTransferJourneysWithCandidates(
    origin: any,
    destination: any,
    transferCandidates: any[],
    timeStr: string,
    serviceIds: string[],
    routeMap: Map<string, any>,
    isDeparture: boolean = true
  ): Promise<any[]> {
    const journeys: any[] = [];
    const MAX_TRANSFER_CANDIDATES = 3;
    const MAX_RESULTS_PER_CANDIDATE = 2;

    try {
      // 乗り換え候補数を制限
      const limitedCandidates = transferCandidates.slice(
        0,
        MAX_TRANSFER_CANDIDATES
      );

      for (const transferStop of limitedCandidates) {
        // 1. 最初の区間: 出発地→乗り換え地点のルートを検索
        const firstLegResults = await this.findDirectRouteBetweenStops(
          origin.stop_id,
          transferStop.stop_id,
          timeStr,
          serviceIds,
          routeMap,
          isDeparture
        );

        if (firstLegResults.length === 0) continue;

        for (const firstLeg of firstLegResults.slice(
          0,
          MAX_RESULTS_PER_CANDIDATE
        )) {
          // 2. 乗り換え待ち時間を考慮した次の出発時刻
          const transferDepartureTime = this.calculateTransferDepartureTime(
            firstLeg.arrival_time,
            3 // 最低乗り換え時間（分）
          );

          // 3. 二区間目: 乗り換え地点→目的地のルートを検索
          const secondLegResults = await this.findDirectRouteBetweenStops(
            transferStop.stop_id,
            destination.stop_id,
            transferDepartureTime,
            serviceIds,
            routeMap,
            true // 乗り換え後は必ず出発時刻指定
          );

          if (secondLegResults.length === 0) continue;

          for (const secondLeg of secondLegResults.slice(
            0,
            MAX_RESULTS_PER_CANDIDATE
          )) {
            // 同じ路線での乗り換えを避ける
            if (firstLeg.route_id === secondLeg.route_id) continue;

            // 乗り換え待ち時間を計算（分）
            const transferWaitMinutes = this.calculateTimeDiffMinutes(
              firstLeg.arrival_time,
              secondLeg.departure_time
            );

            // 乗り換え待ち時間が長すぎる場合はスキップ
            if (transferWaitMinutes > 45) continue;

            // 総所要時間を計算
            const totalDurationMinutes = this.calculateTimeDiffMinutes(
              firstLeg.departure_time,
              secondLeg.arrival_time
            );

            // 結果を追加
            journeys.push({
              // formatRouteResults で使用されるフィールド
              origin_stop_id: origin.stop_id,
              origin_stop_name: origin.stop_name,
              origin_stop_lat: origin.lat,
              origin_stop_lon: origin.lng,
              origin_distance: 0,

              transfer_stop_id: transferStop.id,
              transfer_stop_name: transferStop.name,
              transfer_stop_lat: transferStop.lat,
              transfer_stop_lon: transferStop.lon,
              transfer_distance: 0,
              transfer_wait_time: transferWaitMinutes,

              destination_stop_id: destination.stop_id,
              destination_stop_name: destination.stop_name,
              destination_stop_lat: destination.lat,
              destination_stop_lon: destination.lng,
              destination_distance: 0,

              // 最初の区間の情報
              first_leg_departure_time: firstLeg.departure_time,
              first_leg_arrival_time: firstLeg.arrival_time,
              first_leg_duration: this.calculateTimeDiffMinutes(
                firstLeg.departure_time,
                firstLeg.arrival_time
              ),
              first_leg_route_id: firstLeg.route_id,
              first_leg_route_name: firstLeg.route_name,
              first_leg_route_short_name: firstLeg.route_short_name,
              first_leg_route_long_name: firstLeg.route_long_name,
              first_leg_route_color: firstLeg.route_color,
              first_leg_route_text_color: firstLeg.route_text_color,
              first_leg_trip_headsign: firstLeg.trip_headsign,

              // 二区間目の情報
              second_leg_departure_time: secondLeg.departure_time,
              second_leg_arrival_time: secondLeg.arrival_time,
              second_leg_duration: this.calculateTimeDiffMinutes(
                secondLeg.departure_time,
                secondLeg.arrival_time
              ),
              second_leg_route_id: secondLeg.route_id,
              second_leg_route_name: secondLeg.route_name,
              second_leg_route_short_name: secondLeg.route_short_name,
              second_leg_route_long_name: secondLeg.route_long_name,
              second_leg_route_color: secondLeg.route_color,
              second_leg_route_text_color: secondLeg.route_text_color,
              second_leg_trip_headsign: secondLeg.trip_headsign,

              // 合計時間
              total_duration: totalDurationMinutes,

              // 以下は後方互換性のために残します
              legs: [
                {
                  origin: {
                    id: origin.stop_id,
                    name: origin.stop_name,
                    lat: origin.lat,
                    lng: origin.lng,
                  },
                  destination: {
                    id: transferStop.id,
                    name: transferStop.name,
                    lat: transferStop.lat,
                    lng: transferStop.lon,
                  },
                  departure_time: this.formatTimeString(
                    firstLeg.departure_time
                  ),
                  arrival_time: this.formatTimeString(firstLeg.arrival_time),
                  trip_id: firstLeg.trip_id,
                  route: {
                    id: firstLeg.route_id,
                    name: firstLeg.route_name,
                    short_name: firstLeg.route_short_name,
                    long_name: firstLeg.route_long_name,
                    color: firstLeg.route_color
                      ? `#${firstLeg.route_color}`
                      : "#000000",
                    text_color: firstLeg.route_text_color
                      ? `#${firstLeg.route_text_color}`
                      : "#FFFFFF",
                  },
                  headsign: firstLeg.trip_headsign || "不明",
                },
                {
                  origin: {
                    id: transferStop.id,
                    name: transferStop.name,
                    lat: transferStop.lat,
                    lng: transferStop.lon,
                  },
                  destination: {
                    id: destination.stop_id,
                    name: destination.stop_name,
                    lat: destination.lat,
                    lng: destination.lng,
                  },
                  departure_time: this.formatTimeString(
                    secondLeg.departure_time
                  ),
                  arrival_time: this.formatTimeString(secondLeg.arrival_time),
                  trip_id: secondLeg.trip_id,
                  route: {
                    id: secondLeg.route_id,
                    name: secondLeg.route_name,
                    short_name: secondLeg.route_short_name,
                    long_name: secondLeg.route_long_name,
                    color: secondLeg.route_color
                      ? `#${secondLeg.route_color}`
                      : "#000000",
                    text_color: secondLeg.route_text_color
                      ? `#${secondLeg.route_text_color}`
                      : "#FFFFFF",
                  },
                  headsign: secondLeg.trip_headsign || "不明",
                },
              ],
              duration: totalDurationMinutes,
              transfer_time: transferWaitMinutes,
              stops: [
                {
                  id: origin.stop_id,
                  name: origin.stop_name,
                  lat: origin.lat,
                  lng: origin.lng,
                },
                {
                  id: transferStop.id,
                  name: transferStop.name,
                  lat: transferStop.lat,
                  lng: transferStop.lon,
                },
                {
                  id: destination.stop_id,
                  name: destination.stop_name,
                  lat: destination.lat,
                  lng: destination.lng,
                },
              ],
            });
          }
        }
      }

      // 時間順にソート
      journeys.sort((a, b) => {
        if (isDeparture) {
          return (
            new Date(
              `2000-01-01T${this.formatTimeString(
                a.first_leg_departure_time || a.departure_time
              )}`
            ).getTime() -
            new Date(
              `2000-01-01T${this.formatTimeString(
                b.first_leg_departure_time || b.departure_time
              )}`
            ).getTime()
          );
        } else {
          return (
            new Date(
              `2000-01-01T${this.formatTimeString(
                b.second_leg_arrival_time || b.arrival_time
              )}`
            ).getTime() -
            new Date(
              `2000-01-01T${this.formatTimeString(
                a.second_leg_arrival_time || a.arrival_time
              )}`
            ).getTime()
          );
        }
      });
    } catch (error) {
      logger.error("[TransitService] 乗り換え経路検索でエラー:", error);
    }

    logger.log(
      `[TransitService] 乗換経路フォーマット: ${JSON.stringify(journeys)}`
    );
    return journeys;
  }

  /**
   * 最寄りのバス停を検索する
   */
  private async findNearestStop(lat: number, lng: number): Promise<any> {
    try {
      // DBを初期化
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

  /**
   * 距離を計算
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // 地球の半径（キロメートル）
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  /**
   * 乗り換え後の出発時刻を計算
   * @param arrivalTime 到着時刻
   * @param minTransferMinutes 最小乗り換え時間（分）
   */
  private calculateTransferDepartureTime(
    arrivalTime: string,
    minTransferMinutes: number
  ): string {
    if (!arrivalTime) return "";

    const [hours, minutes, seconds] = arrivalTime.split(":").map(Number);

    // 分を加算
    let newMinutes = minutes + minTransferMinutes;
    let newHours = hours;

    // 繰り上げ処理
    if (newMinutes >= 60) {
      newHours += Math.floor(newMinutes / 60);
      newMinutes %= 60;
    }

    return `${newHours.toString().padStart(2, "0")}:${newMinutes
      .toString()
      .padStart(2, "0")}:${
      seconds ? seconds.toString().padStart(2, "0") : "00"
    }`;
  }

  /**
   * 2つのバス停間の直行便を検索
   */
  private async findDirectRouteBetweenStops(
    fromStopId: string,
    toStopId: string,
    timeStr: string,
    serviceIds: string[],
    routeMap: Map<string, any>,
    isDeparture: boolean = true
  ): Promise<any[]> {
    const results: any[] = [];

    try {
      if (isDeparture) {
        // 出発地の時刻表を取得
        const originStopTimes = await prisma.stopTime.findMany({
          where: {
            stop_id: fromStopId,
            departure_time: {
              gte: timeStr,
            },
            trip: {
              service_id: {
                in: serviceIds,
              },
            },
          },
          include: {
            trip: {
              select: {
                id: true,
                route_id: true,
                headsign: true,
              },
            },
          },
          orderBy: [{ departure_time: "asc" }],
          take: 20,
        });

        // 有効なトリップIDのリスト
        const validTripIds = originStopTimes
          .filter((st) => st.trip !== null)
          .map((st) => st.trip_id);

        if (validTripIds.length === 0) return [];

        // 目的地のストップタイムを取得
        const destinationStopTimes = await prisma.stopTime.findMany({
          where: {
            stop_id: toStopId,
            trip_id: {
              in: validTripIds,
            },
          },
          orderBy: [{ trip_id: "asc" }, { stop_sequence: "asc" }],
        });

        // 目的地のストップタイムをトリップIDでマッピング
        const destStopTimeMap = new Map();
        for (const dst of destinationStopTimes) {
          if (!dst.arrival_time) continue;
          destStopTimeMap.set(dst.trip_id, dst);
        }

        // 出発便と目的地への到着を結合して結果を構築
        for (const originST of originStopTimes) {
          if (!originST.departure_time || !originST.trip) continue;

          const destST = destStopTimeMap.get(originST.trip_id);
          if (!destST || !destST.arrival_time) continue;

          // 出発地のシーケンスが目的地より小さい場合のみ有効
          if (originST.stop_sequence >= destST.stop_sequence) continue;

          const route = routeMap.get(originST.trip.route_id);
          if (!route) continue;

          // 所要時間を計算
          const durationMinutes = this.calculateTimeDiffMinutes(
            originST.departure_time,
            destST.arrival_time
          );

          // 結果に追加
          results.push({
            trip_id: originST.trip_id,
            trip_headsign: originST.trip.headsign || "",
            route_id: originST.trip.route_id,
            route_name: route.short_name || route.long_name || "名称不明",
            route_short_name: route.short_name || "",
            route_long_name: route.long_name || "",
            route_color: route.color || "808080",
            route_text_color: route.text_color || "FFFFFF",
            departure_time: this.formatTimeString(originST.departure_time),
            arrival_time: this.formatTimeString(destST.arrival_time),
            duration: durationMinutes,
          });

          logger.log(
            `[TransitService] 直行便発見: ${
              route.short_name || route.long_name
            } - 出発=${this.formatTimeString(
              originST.departure_time
            )}, 到着=${this.formatTimeString(
              destST.arrival_time
            )}, シーケンス=${originST.stop_sequence}->${
              destST.stop_sequence
            }, route_name=${route.short_name || route.long_name || "名称不明"}`
          );

          // 十分な結果が見つかったら終了
          if (results.length >= 3) break;
        }
      } else {
        // 到着時刻指定の場合
        const destinationStopTimes = await prisma.stopTime.findMany({
          where: {
            stop_id: toStopId,
            arrival_time: {
              lte: timeStr,
            },
            trip: {
              service_id: {
                in: serviceIds,
              },
            },
          },
          include: {
            trip: {
              select: {
                id: true,
                route_id: true,
                headsign: true,
              },
            },
          },
          orderBy: [{ arrival_time: "desc" }],
          take: 20,
        });

        // 有効なトリップIDのリスト
        const validTripIds = destinationStopTimes
          .filter((st) => st.trip !== null)
          .map((st) => st.trip_id);

        if (validTripIds.length === 0) return [];

        // 出発地のストップタイムを取得
        const originStopTimes = await prisma.stopTime.findMany({
          where: {
            stop_id: fromStopId,
            trip_id: {
              in: validTripIds,
            },
          },
          orderBy: [{ trip_id: "asc" }, { stop_sequence: "asc" }],
        });

        // 出発地のストップタイムをトリップIDでマッピング
        const originStopTimeMap = new Map();
        for (const ost of originStopTimes) {
          if (!ost.departure_time) continue;
          originStopTimeMap.set(ost.trip_id, ost);
        }

        // 目的地への便と出発地からの出発を結合して結果を構築
        for (const destST of destinationStopTimes) {
          if (!destST.arrival_time || !destST.trip) continue;

          const originST = originStopTimeMap.get(destST.trip_id);
          if (!originST || !originST.departure_time) continue;

          // 出発地のシーケンスが目的地より小さい場合のみ有効
          if (originST.stop_sequence >= destST.stop_sequence) {
            logger.log(
              `[TransitService] シーケンスチェック失敗: 出発(${originST.stop_sequence}) >= 目的地(${destST.stop_sequence}), trip_id=${destST.trip_id}`
            );
            continue;
          }

          const route = routeMap.get(destST.trip.route_id);
          if (!route) continue;

          // 所要時間を計算
          const durationMinutes = this.calculateTimeDiffMinutes(
            originST.departure_time,
            destST.arrival_time
          );

          // 結果に追加
          results.push({
            trip_id: destST.trip_id,
            trip_headsign: destST.trip.headsign || "",
            route_id: destST.trip.route_id,
            route_name: route.short_name || route.long_name || "名称不明",
            route_short_name: route.short_name || "",
            route_long_name: route.long_name || "",
            route_color: route.color || "808080",
            route_text_color: route.text_color || "FFFFFF",
            departure_time: this.formatTimeString(originST.departure_time),
            arrival_time: this.formatTimeString(destST.arrival_time),
            duration: durationMinutes,
          });

          logger.log(
            `[TransitService] 直行便発見: ${
              route.short_name || route.long_name
            } - 出発=${this.formatTimeString(
              originST.departure_time
            )}, 到着=${this.formatTimeString(
              destST.arrival_time
            )}, シーケンス=${originST.stop_sequence}->${
              destST.stop_sequence
            }, route_name=${route.short_name || route.long_name || "名称不明"}`
          );

          // 十分な結果が見つかったら終了
          if (results.length >= 3) break;
        }
      }

      return results;
    } catch (error) {
      logger.error("[TransitService] 直行便検索エラー:", error);
      return [];
    }
  }

  /**
   * 時刻文字列をHH:MM形式に標準化する
   */
  private formatTimeString(timeStr: string | null | undefined): string {
    if (!timeStr) return "時刻不明";

    // HH:MM:SS形式から秒を削除
    const match = timeStr.match(/^(\d{2}:\d{2}):\d{2}$/);
    if (match) return match[1];

    // すでにHH:MM形式の場合はそのまま返す
    if (timeStr.match(/^\d{2}:\d{2}$/)) return timeStr;

    // その他の形式は元の値を返す
    return timeStr;
  }
}
