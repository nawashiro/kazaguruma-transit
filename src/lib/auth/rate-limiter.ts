import { sqliteManager } from "../db/sqlite-manager";
import { logger } from "../../utils/logger";

// レート制限の種類と設定
const RATE_LIMIT_SETTINGS = {
  verify_attempt: {
    windowMs: 15 * 60 * 1000, // 15分間のウィンドウ
    maxRequests: 5, // 最大5回の試行
  },
  email_send: {
    windowMs: 60 * 60 * 1000, // 1時間のウィンドウ
    maxRequests: 3, // 最大3回のメール送信
  },
  // 必要に応じて他のタイプを追加
};

// レート制限に必要なテーブル作成のためのSchema定義
export const RATE_LIMIT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS auth_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    action_type TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    first_attempt BIGINT NOT NULL,
    last_attempt BIGINT NOT NULL,
    UNIQUE(ip, action_type)
  )
`;

// メモリ内キャッシュ型定義
interface RateLimitCacheEntry {
  ip: string;
  actionType: string;
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  expiresAt: number;
}

/**
 * レート制限ユーティリティクラス
 * ブルートフォース攻撃などを防ぐためのレート制限機能を提供
 */
export class RateLimiter {
  // メモリ内キャッシュ - データベース障害時のバックアップとして
  private memoryCache: Map<string, RateLimitCacheEntry> = new Map();

  // エラーカウント - 続けてエラーが発生した場合に追跡
  private consecutiveErrors = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 3;

  // キャッシュキーの生成
  private getCacheKey(ip: string, actionType: string): string {
    return `${ip}:${actionType}`;
  }

  /**
   * 指定されたIPアドレスとアクションタイプに対してレート制限を超えているかチェック
   *
   * @param ip IPアドレス
   * @param actionType アクションの種類（'verify_attempt'や'email_send'など）
   * @returns レート制限を超えているかどうか
   */
  async isRateLimited(
    ip: string,
    actionType: keyof typeof RATE_LIMIT_SETTINGS
  ): Promise<boolean> {
    try {
      // 連続エラーが閾値を超えた場合、緊急モードとして制限を常に有効に
      if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
        logger.warn(
          `[RateLimiter] 連続エラーが閾値を超えました。緊急制限モード: ${ip}, ${actionType}`
        );
        return true; // 緊急時は常に制限
      }

      const settings = RATE_LIMIT_SETTINGS[actionType];
      const now = Date.now();

      // 1. まずメモリキャッシュをチェック
      const cacheKey = this.getCacheKey(ip, actionType);
      const cachedEntry = this.memoryCache.get(cacheKey);

      if (cachedEntry && now < cachedEntry.expiresAt) {
        // キャッシュが有効期限内の場合、キャッシュから判断
        if (now - cachedEntry.firstAttempt < settings.windowMs) {
          return cachedEntry.count >= settings.maxRequests;
        } else {
          // 時間枠を超過している場合はキャッシュから削除
          this.memoryCache.delete(cacheKey);
        }
      }

      // 2. データベースから制限情報を取得
      const rateLimit = await this.getRateLimitInfo(ip, actionType);

      if (!rateLimit) {
        // 制限レコードがなければ制限なし
        this.consecutiveErrors = 0; // エラーカウントリセット
        return false;
      }

      // 3. データベースの情報からレート制限判定
      if (now - rateLimit.first_attempt < settings.windowMs) {
        // 時間枠内で、最大リクエスト数を超えていたら制限する
        const isLimited = rateLimit.count >= settings.maxRequests;

        // 判定結果をメモリキャッシュに保存 (5分間有効)
        this.updateMemoryCache(
          ip,
          actionType,
          rateLimit.count,
          rateLimit.first_attempt,
          rateLimit.last_attempt,
          now + 5 * 60 * 1000
        );

        this.consecutiveErrors = 0; // エラーカウントリセット
        return isLimited;
      } else {
        // 時間枠を超えていたらリセット
        await this.resetRateLimit(ip, actionType);
        this.consecutiveErrors = 0; // エラーカウントリセット
        return false;
      }
    } catch (error) {
      // エラーカウントを増加
      this.consecutiveErrors++;

      logger.error(
        `[RateLimiter] レート制限チェックエラー (${this.consecutiveErrors}回目): ${ip}, ${actionType}`,
        error
      );

      // エラーの場合、安全側に倒して制限を適用する
      // データベースエラーによってレート制限が回避されるリスクを防止
      return this.consecutiveErrors > 1; // 2回目以降のエラーでは制限を適用
    }
  }

  /**
   * 指定されたIPアドレスとアクションタイプのリクエストカウントを増やす
   *
   * @param ip IPアドレス
   * @param actionType アクションの種類
   */
  async incrementRateLimit(
    ip: string,
    actionType: keyof typeof RATE_LIMIT_SETTINGS
  ): Promise<void> {
    const now = Date.now();
    let retryCount = 0;
    const maxRetries = 3;

    // メモリキャッシュ内のエントリも更新
    this.updateMemoryCacheCount(ip, actionType, now);

    while (retryCount < maxRetries) {
      try {
        // まず現在のレコードを取得
        const rateLimit = await this.getRateLimitInfo(ip, actionType);

        if (rateLimit) {
          // 既存のレコードを更新
          await sqliteManager.runQuery(
            `UPDATE auth_rate_limits 
             SET count = count + 1, last_attempt = ? 
             WHERE ip = ? AND action_type = ?`,
            [now, ip, actionType]
          );
        } else {
          // 新しいレコードを作成
          await sqliteManager.runQuery(
            `INSERT INTO auth_rate_limits (ip, action_type, count, first_attempt, last_attempt) 
             VALUES (?, ?, 1, ?, ?)`,
            [ip, actionType, now, now]
          );
        }

        this.consecutiveErrors = 0; // エラーカウントリセット
        return; // 成功したら終了
      } catch (error) {
        retryCount++;
        logger.error(
          `[RateLimiter] レート制限インクリメントエラー (試行 ${retryCount}/${maxRetries}): ${ip}, ${actionType}`,
          error
        );

        if (retryCount < maxRetries) {
          // 短い待機時間を設けて再試行
          await new Promise((resolve) => setTimeout(resolve, 100 * retryCount)); // 徐々に遅延を増加
        }
      }
    }

    // すべての再試行が失敗した場合、重大なエラーとして記録し、エラーカウントを増加
    this.consecutiveErrors++;
    logger.error(
      `[RateLimiter] レート制限インクリメント - すべての再試行が失敗: ${ip}, ${actionType} (${this.consecutiveErrors}回目)`
    );
  }

  /**
   * メモリキャッシュを更新する
   */
  private updateMemoryCache(
    ip: string,
    actionType: string,
    count: number,
    firstAttempt: number,
    lastAttempt: number,
    expiresAt: number
  ): void {
    const cacheKey = this.getCacheKey(ip, actionType);
    this.memoryCache.set(cacheKey, {
      ip,
      actionType,
      count,
      firstAttempt,
      lastAttempt,
      expiresAt,
    });
  }

  /**
   * メモリキャッシュ内のカウントを増加させる
   */
  private updateMemoryCacheCount(
    ip: string,
    actionType: string,
    now: number
  ): void {
    const cacheKey = this.getCacheKey(ip, actionType);
    const cachedEntry = this.memoryCache.get(cacheKey);

    if (cachedEntry) {
      // 既存エントリを更新
      cachedEntry.count++;
      cachedEntry.lastAttempt = now;
      this.memoryCache.set(cacheKey, cachedEntry);
    } else {
      // 新規エントリを作成
      this.updateMemoryCache(ip, actionType, 1, now, now, now + 5 * 60 * 1000);
    }
  }

  /**
   * 指定されたIPアドレスとアクションタイプのレート制限情報を取得
   */
  private async getRateLimitInfo(
    ip: string,
    actionType: string
  ): Promise<{
    ip: string;
    action_type: string;
    count: number;
    first_attempt: number;
    last_attempt: number;
  } | null> {
    try {
      return await sqliteManager.getQuery(
        `SELECT * FROM auth_rate_limits WHERE ip = ? AND action_type = ?`,
        [ip, actionType]
      );
    } catch (error) {
      logger.error(
        `[RateLimiter] レート情報取得エラー: ${ip}, ${actionType}`,
        error
      );

      // エラー発生時はキャッシュを確認
      const cacheKey = this.getCacheKey(ip, actionType);
      const cachedEntry = this.memoryCache.get(cacheKey);

      // キャッシュがあればそれを返す、なければnull
      return cachedEntry
        ? {
            ip: cachedEntry.ip,
            action_type: cachedEntry.actionType,
            count: cachedEntry.count,
            first_attempt: cachedEntry.firstAttempt,
            last_attempt: cachedEntry.lastAttempt,
          }
        : null;
    }
  }

  /**
   * 指定されたIPアドレスとアクションタイプのレート制限をリセット
   */
  public async resetRateLimit(ip: string, actionType: string): Promise<void> {
    const now = Date.now();
    let retryCount = 0;
    const maxRetries = 2;

    // メモリキャッシュをリセット
    const cacheKey = this.getCacheKey(ip, actionType);
    this.memoryCache.delete(cacheKey);

    while (retryCount < maxRetries) {
      try {
        await sqliteManager.runQuery(
          `UPDATE auth_rate_limits 
           SET count = 1, first_attempt = ?, last_attempt = ? 
           WHERE ip = ? AND action_type = ?`,
          [now, now, ip, actionType]
        );
        return; // 成功したら終了
      } catch (error) {
        retryCount++;
        logger.error(
          `[RateLimiter] レート制限リセットエラー (試行 ${retryCount}/${maxRetries}): ${ip}, ${actionType}`,
          error
        );

        if (retryCount < maxRetries) {
          // 短い待機時間を設けて再試行
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    }

    // すべての再試行が失敗した場合はログに記録
    logger.error(
      `[RateLimiter] レート制限リセット - すべての再試行が失敗: ${ip}, ${actionType}`
    );
  }

  /**
   * 期限切れのレート制限レコードを削除（定期的なクリーンアップ用）
   */
  async cleanupExpiredRateLimits(): Promise<void> {
    try {
      const now = Date.now();

      // すべてのアクションタイプの最大ウィンドウ時間を計算
      const maxWindowMs = Math.max(
        ...Object.values(RATE_LIMIT_SETTINGS).map((setting) => setting.windowMs)
      );

      // 最大ウィンドウ時間より古いレコードを削除
      await sqliteManager.runQuery(
        `DELETE FROM auth_rate_limits WHERE last_attempt < ?`,
        [now - maxWindowMs]
      );

      // メモリキャッシュもクリーンアップ
      this.cleanupMemoryCache(now);
    } catch (error) {
      logger.error("[RateLimiter] 期限切れレコード削除エラー", error);
    }
  }

  /**
   * 期限切れのメモリキャッシュエントリをクリーンアップ
   */
  private cleanupMemoryCache(now: number): void {
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key);
      }
    }
  }
}

// シングルトンインスタンス
export const rateLimiter = new RateLimiter();
