import { prisma } from "./prisma";
import { logger } from "../../utils/logger";
import { Prisma } from "@prisma/client";

export interface RateLimitRecord {
  ip: string;
  count: number;
  lastAccess: number;
}

export interface SupporterRecord {
  email: string;
  verificationCode: string | null;
  codeExpires: number | null;
  verified: boolean;
  verifiedAt?: number | null;
}

// Prismaの型定義
type RateLimitSelect = Prisma.RateLimitGetPayload<{
  select: { ip: true; count: true; last_access: true };
}>;

type SupporterSelect = Prisma.SupporterGetPayload<{}>;

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
   * メールアドレスから支援者情報を取得
   */
  async getSupporterByEmail(email: string): Promise<SupporterRecord | null> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const query = {
        where: { email },
      } satisfies Prisma.SupporterFindUniqueArgs;

      const supporter = await prisma.supporter.findUnique(query);

      if (!supporter) return null;

      return {
        email: supporter.email,
        verificationCode: supporter.verification_code,
        codeExpires: supporter.code_expires
          ? Number(supporter.code_expires)
          : null,
        verified: supporter.verified,
        verifiedAt: supporter.verified_at
          ? Number(supporter.verified_at)
          : null,
      };
    } catch (error) {
      logger.error("[DataManager] 支援者情報取得エラー:", error);
      throw error;
    }
  }

  /**
   * 確認コードから支援者情報を取得
   */
  async getSupporterByVerificationCode(
    code: string
  ): Promise<SupporterRecord | null> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const query = {
        where: { verification_code: code },
      } satisfies Prisma.SupporterFindFirstArgs;

      const supporter = await prisma.supporter.findFirst(query);

      if (!supporter) return null;

      return {
        email: supporter.email,
        verificationCode: supporter.verification_code,
        codeExpires: supporter.code_expires
          ? Number(supporter.code_expires)
          : null,
        verified: supporter.verified,
        verifiedAt: supporter.verified_at
          ? Number(supporter.verified_at)
          : null,
      };
    } catch (error) {
      logger.error(
        "[DataManager] 確認コードによる支援者情報取得エラー:",
        error
      );
      throw error;
    }
  }

  /**
   * 支援者情報を作成または更新
   */
  async createOrUpdateSupporter(
    supporter: Partial<SupporterRecord> & { email: string }
  ): Promise<void> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const existingSupporter = await this.getSupporterByEmail(supporter.email);

      const data = {
        email: supporter.email,
        // 他のフィールドはオプショナルに設定
        ...(supporter.verificationCode !== undefined && {
          verification_code: supporter.verificationCode,
        }),
        ...(supporter.codeExpires !== undefined && {
          code_expires:
            supporter.codeExpires !== null
              ? BigInt(supporter.codeExpires)
              : null,
        }),
        ...(supporter.verified !== undefined && {
          verified: supporter.verified,
        }),
        ...(supporter.verifiedAt !== undefined && {
          verified_at:
            supporter.verifiedAt !== null ? BigInt(supporter.verifiedAt) : null,
        }),
      } satisfies Prisma.SupporterCreateInput;

      if (existingSupporter) {
        // 既存のレコードを更新
        const updateQuery = {
          where: { email: supporter.email },
          data: data,
        } satisfies Prisma.SupporterUpdateArgs;

        await prisma.supporter.update(updateQuery);
      } else {
        // 新しいレコードを作成
        const createQuery = {
          data: data,
        } satisfies Prisma.SupporterCreateArgs;

        await prisma.supporter.create(createQuery);
      }
    } catch (error) {
      logger.error("[DataManager] 支援者情報の作成/更新エラー:", error);
      throw error;
    }
  }

  /**
   * メールアドレスと確認コードを使って支援者を確認済みにする
   */
  async verifySupporter(email: string, code: string): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      // メールアドレスで支援者を検索
      const supporter = await this.getSupporterByEmail(email);
      if (!supporter) {
        logger.warn(
          `[DataManager] 確認しようとした支援者が存在しません: ${email}`
        );
        return false;
      }

      // 確認コードが一致し、有効期限内であることを確認
      const now = Date.now();
      if (
        supporter.verificationCode !== code ||
        !supporter.codeExpires ||
        supporter.codeExpires < now
      ) {
        logger.warn(
          `[DataManager] 確認コードが無効または期限切れです: ${email}, コード: ${code}`
        );
        return false;
      }

      // 支援者を確認済みに更新
      const updateQuery = {
        where: { email },
        data: {
          verified: true,
          verified_at: BigInt(now),
          // 確認後は確認コードをクリアする
          verification_code: null,
          code_expires: null,
        },
      } satisfies Prisma.SupporterUpdateArgs;

      await prisma.supporter.update(updateQuery);

      return true;
    } catch (error) {
      logger.error("[DataManager] 支援者確認エラー:", error);
      return false;
    }
  }

  /**
   * メールアドレスが確認済みの支援者かどうかを確認
   */
  async isVerifiedSupporter(email: string): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const query = {
        where: { email },
        select: { verified: true },
      } satisfies Prisma.SupporterFindUniqueArgs;

      const supporter = await prisma.supporter.findUnique(query);

      return supporter?.verified === true;
    } catch (error) {
      logger.error("[DataManager] 支援者確認ステータス取得エラー:", error);
      // エラーの場合は安全側に倒して false を返す
      return false;
    }
  }

  /**
   * 認証関連のレート制限を記録・更新する
   */
  async recordAuthAttempt(
    ip: string,
    actionType: string,
    maxAttempts: number = 5
  ): Promise<{ allowed: boolean; attemptsLeft: number }> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const now = Date.now();

      // 既存のレコードを検索
      const findQuery = {
        where: {
          ip_action_type: {
            ip,
            action_type: actionType,
          },
        },
      } satisfies Prisma.AuthRateLimitFindUniqueArgs;

      const record = await prisma.authRateLimit.findUnique(findQuery);

      if (record) {
        // 既存レコードを更新
        const updateQuery = {
          where: {
            ip_action_type: {
              ip,
              action_type: actionType,
            },
          },
          data: {
            count: record.count + 1,
            last_attempt: BigInt(now),
          },
        } satisfies Prisma.AuthRateLimitUpdateArgs;

        const updatedRecord = await prisma.authRateLimit.update(updateQuery);

        const attemptsLeft = Math.max(0, maxAttempts - updatedRecord.count);
        return {
          allowed: updatedRecord.count <= maxAttempts,
          attemptsLeft,
        };
      } else {
        // 新規レコードを作成
        const createQuery = {
          data: {
            ip,
            action_type: actionType,
            count: 1,
            first_attempt: BigInt(now),
            last_attempt: BigInt(now),
          },
        } satisfies Prisma.AuthRateLimitCreateArgs;

        await prisma.authRateLimit.create(createQuery);

        return {
          allowed: true,
          attemptsLeft: maxAttempts - 1,
        };
      }
    } catch (error) {
      logger.error("[DataManager] 認証試行記録エラー:", error);
      // エラーの場合は安全側に倒して許可しない
      return { allowed: false, attemptsLeft: 0 };
    }
  }

  /**
   * 接続を閉じる
   */
  async close(): Promise<void> {
    try {
      await prisma.$disconnect();
      logger.log("[DataManager] データベース接続を閉じました");
    } catch (error) {
      logger.error("[DataManager] データベース接続を閉じる際のエラー:", error);
    }
  }

  /**
   * Prismaクエリを実行（更新系）
   * Prismaネイティブメソッドのラッパー
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
   * Prismaクエリを実行（単一レコード取得）
   * Prismaネイティブメソッドのラッパー
   */
  async getQuery<T>(query: Prisma.PrismaPromise<T>): Promise<T | null> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      return await query;
    } catch (error) {
      logger.error("[DataManager] 単一レコード取得エラー:", error);
      throw error;
    }
  }

  /**
   * Prismaクエリを実行（複数レコード取得）
   * Prismaネイティブメソッドのラッパー
   */
  async allQuery<T>(query: Prisma.PrismaPromise<T[]>): Promise<T[]> {
    try {
      if (!this.initialized) {
        await this.init();
      }

      const results = await query;
      return Array.isArray(results) ? results : [];
    } catch (error) {
      logger.error("[DataManager] 複数レコード取得エラー:", error);
      throw error;
    }
  }

  /**
   * Prismaクライアントを取得
   */
  getPrismaClient(): typeof prisma {
    if (!this.initialized) {
      this.init().catch((e) => logger.error("[DataManager] 初期化エラー:", e));
    }
    return prisma;
  }
}

// シングルトンインスタンスをエクスポート
export const dataManager = new DataManager();
