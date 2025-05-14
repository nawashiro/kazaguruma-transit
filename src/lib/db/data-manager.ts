import { prisma } from "./prisma";
import { logger } from "../../utils/logger";
import { Prisma } from "@prisma/client";

export interface RateLimitRecord {
  ip: string;
  count: number;
  lastAccess: number;
}

/**
 * Prismaを使用してデータベースアクセスを一元管理するクラス
 */
class DataManager {
  private initialized = false;
  private initializationFailed = false;
  private initializationError: Error | null = null;

  /**
   * データベース接続の初期化
   * Prismaクライアントは自動的に初期化されるため、
   * このメソッドは単純にデータベースが利用可能かチェックします
   */
  async init(): Promise<void> {
    // 既に初期化を試みて失敗している場合はエラーをスロー
    if (this.initializationFailed) {
      throw (
        this.initializationError ||
        new Error("データベース初期化に失敗しています")
      );
    }

    // 既に初期化されている場合は処理をスキップ
    if (this.initialized) {
      return;
    }

    try {
      logger.log("[DataManager] データベースを初期化しています...");

      // データベースが利用可能かテスト
      await prisma.$queryRaw`SELECT 1`;

      this.initialized = true;
      logger.log("[DataManager] データベース初期化が完了しました");
    } catch (error) {
      this.initializationFailed = true;
      this.initializationError =
        error instanceof Error ? error : new Error(String(error));
      logger.error("[DataManager] データベース初期化エラー:", error);
      throw error;
    }
  }

  /**
   * IPアドレスのレート制限情報を取得
   */
  async getRateLimitByIp(ip: string): Promise<RateLimitRecord | null> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      try {
        const query = {
          where: { ip },
          select: {
            ip: true,
            count: true,
            last_access: true,
          },
        } satisfies Prisma.RateLimitFindUniqueArgs;

        const result = await prisma.rateLimit.findUnique(query);

        if (!result) return null;

        return {
          ip: result.ip,
          count: result.count,
          lastAccess: Number(result.last_access),
        };
      } catch (error) {
        logger.error("[DataManager] レート制限情報取得エラー:", error);
        // DB操作エラー時は制限なしとせず、デフォルトの高い値を返す
        return {
          ip,
          count: 999, // 制限値を超える値を返す
          lastAccess: Date.now(),
        };
      }
    } catch (error) {
      logger.error(
        "[DataManager] DB初期化エラー時のレート制限情報取得:",
        error
      );
      // DB初期化に失敗した場合も制限なしとせず、デフォルトの高い値を返す
      return {
        ip,
        count: 999, // 制限値を超える値を返す
        lastAccess: Date.now(),
      };
    }
  }

  /**
   * IPアドレスのレート制限カウントを更新
   */
  async incrementRateLimit(ip: string): Promise<void> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const now = Date.now();
      const existing = await this.getRateLimitByIp(ip);

      if (existing) {
        const updateQuery = {
          where: { ip },
          data: {
            count: { increment: 1 },
            last_access: BigInt(now),
          },
        } satisfies Prisma.RateLimitUpdateArgs;

        await prisma.rateLimit.update(updateQuery);
      } else {
        const createQuery = {
          data: {
            ip,
            count: 1,
            last_access: BigInt(now),
          },
        } satisfies Prisma.RateLimitCreateArgs;

        await prisma.rateLimit.create(createQuery);
      }
    } catch (error) {
      logger.error("[DataManager] レート制限更新エラー:", error);
      throw error;
    }
  }

  /**
   * IPアドレスのレート制限をリセット
   */
  async resetRateLimit(ip: string): Promise<void> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const upsertQuery = {
        where: { ip },
        update: {
          count: 0,
          last_access: BigInt(Date.now()),
        },
        create: {
          ip,
          count: 0,
          last_access: BigInt(Date.now()),
        },
      } satisfies Prisma.RateLimitUpsertArgs;

      await prisma.rateLimit.upsert(upsertQuery);
    } catch (error) {
      logger.error("[DataManager] レート制限リセットエラー:", error);
      throw error;
    }
  }

  /**
   * 期限切れのレート制限レコードをクリーンアップ
   */
  async cleanupExpiredRateLimits(expiryMs: number): Promise<void> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const expiryTimestamp = Date.now() - expiryMs;

      const deleteQuery = {
        where: {
          last_access: {
            lt: BigInt(expiryTimestamp),
          },
        },
      } satisfies Prisma.RateLimitDeleteManyArgs;

      await prisma.rateLimit.deleteMany(deleteQuery);
    } catch (error) {
      logger.error("[DataManager] レート制限クリーンアップエラー:", error);
      throw error;
    }
  }

  /**
   * データベース接続のクローズ
   */
  async close(): Promise<void> {
    try {
      if (this.initialized) {
        await prisma.$disconnect();
        this.initialized = false;
      }
    } catch (error) {
      logger.error("[DataManager] データベース切断エラー:", error);
      throw error;
    }
  }

  /**
   * 汎用クエリ実行メソッド
   */
  async runQuery<T>(
    query: Prisma.PrismaPromise<T>
  ): Promise<{ success: boolean; result: T }> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const result = await query;
      return { success: true, result };
    } catch (error) {
      logger.error("[DataManager] クエリ実行エラー:", error);
      throw error;
    }
  }

  /**
   * 汎用の単一レコード取得クエリ
   */
  async getQuery<T>(query: Prisma.PrismaPromise<T>): Promise<T | null> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const result = await query;
      return result;
    } catch (error) {
      logger.error("[DataManager] 単一レコード取得エラー:", error);
      return null;
    }
  }

  /**
   * 汎用の複数レコード取得クエリ
   */
  async allQuery<T>(query: Prisma.PrismaPromise<T[]>): Promise<T[]> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const result = await query;
      return result;
    } catch (error) {
      logger.error("[DataManager] 複数レコード取得エラー:", error);
      return [];
    }
  }

  /**
   * Prismaクライアントの取得（ユニットテスト用）
   */
  getPrismaClient(): typeof prisma {
    return prisma;
  }
}

// シングルトンインスタンスをエクスポート
export const dataManager = new DataManager();
