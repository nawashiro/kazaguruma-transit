import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { logger } from "../../utils/logger";
import path from "path";
import fs from "fs";

// SQLiteデータベースのパス
const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.cwd(), process.env.SQLITE_DB_PATH)
  : path.join(process.cwd(), "kofi-data.db");

export interface RateLimitRecord {
  ip: string;
  count: number;
  lastAccess: number;
}

export interface SupporterRecord {
  email: string;
  verificationCode: string;
  codeExpires: number;
  verified: boolean;
  verifiedAt?: number;
}

/**
 * SQLiteデータベースを一元管理するクラス
 */
class SQLiteManager {
  private db: Database | null = null;
  private initialized = false;
  private initializationFailed = false;
  private initializationError: Error | null = null;

  /**
   * データベース接続の初期化
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
      logger.log("[SQLiteManager] データベースを初期化しています...");

      // データベースディレクトリが存在するか確認し、なければ作成
      const dbDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dbDir)) {
        logger.log(`[SQLiteManager] ディレクトリを作成します: ${dbDir}`);
        fs.mkdirSync(dbDir, { recursive: true });
      }

      logger.log(`[SQLiteManager] データベースパス: ${DB_PATH}`);

      // SQLiteデータベース接続を開く
      this.db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database,
      });

      // テーブルの作成
      await this.createTables();

      this.initialized = true;
      logger.log("[SQLiteManager] データベース初期化が完了しました");
    } catch (error) {
      this.initializationFailed = true;
      this.initializationError =
        error instanceof Error ? error : new Error(String(error));
      logger.error("[SQLiteManager] データベース初期化エラー:", error);
      throw error;
    }
  }

  /**
   * 汎用クエリ実行メソッド - 外部からのSQL実行を可能にする
   * @param sql 実行するSQLクエリ
   * @param params クエリパラメータ
   * @returns SQLiteの実行結果
   */
  async runQuery(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) {
      await this.init();
    }

    try {
      return await this.db!.run(sql, params);
    } catch (error) {
      logger.error("[SQLiteManager] クエリ実行エラー:", error);
      throw error;
    }
  }

  /**
   * 汎用クエリ取得メソッド（単一行）- 外部からのSQL実行を可能にする
   * @param sql 実行するSQLクエリ
   * @param params クエリパラメータ
   * @returns 単一の結果行
   */
  async getQuery(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) {
      await this.init();
    }

    try {
      return await this.db!.get(sql, params);
    } catch (error) {
      logger.error("[SQLiteManager] クエリ取得エラー:", error);
      throw error;
    }
  }

  /**
   * 汎用クエリ取得メソッド（複数行）- 外部からのSQL実行を可能にする
   * @param sql 実行するSQLクエリ
   * @param params クエリパラメータ
   * @returns 結果行の配列
   */
  async allQuery(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) {
      await this.init();
    }

    try {
      return await this.db!.all(sql, params);
    } catch (error) {
      logger.error("[SQLiteManager] クエリ一覧取得エラー:", error);
      throw error;
    }
  }

  /**
   * 必要なテーブルを作成
   */
  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error("データベース接続が初期化されていません");
    }

    try {
      // レート制限テーブル
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          ip TEXT PRIMARY KEY,
          count INTEGER NOT NULL,
          last_access INTEGER NOT NULL
        )
      `);

      // 支援者テーブル
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS supporters (
          email TEXT PRIMARY KEY,
          verification_code TEXT,
          code_expires INTEGER,
          verified INTEGER DEFAULT 0,
          verified_at INTEGER
        )
      `);

      // 認証用レート制限テーブル（ブルートフォース攻撃対策）
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS auth_rate_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ip TEXT NOT NULL,
          action_type TEXT NOT NULL,
          count INTEGER DEFAULT 1,
          first_attempt BIGINT NOT NULL,
          last_attempt BIGINT NOT NULL,
          UNIQUE(ip, action_type)
        )
      `);

      logger.log("[SQLiteManager] テーブルの作成が完了しました");
    } catch (error) {
      logger.error("[SQLiteManager] テーブル作成エラー:", error);
      throw error;
    }
  }

  /**
   * IPアドレスのレート制限情報を取得
   */
  async getRateLimitByIp(ip: string): Promise<RateLimitRecord | null> {
    try {
      if (!this.db) {
        await this.init();
      }

      try {
        const result = await this.db!.get(
          "SELECT ip, count, last_access as lastAccess FROM rate_limits WHERE ip = ?",
          [ip]
        );

        return result || null;
      } catch (error) {
        logger.error("[SQLiteManager] レート制限情報取得エラー:", error);
        // DB操作エラー時は制限なしとせず、デフォルトの高い値を返す
        return {
          ip,
          count: 999, // 制限値を超える値を返す
          lastAccess: Date.now(),
        };
      }
    } catch (error) {
      logger.error(
        "[SQLiteManager] DB初期化エラー時のレート制限情報取得:",
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
      if (!this.db) {
        await this.init();
      }

      const now = Date.now();
      const existing = await this.getRateLimitByIp(ip);

      if (existing) {
        await this.db!.run(
          "UPDATE rate_limits SET count = count + 1, last_access = ? WHERE ip = ?",
          [now, ip]
        );
      } else {
        await this.db!.run(
          "INSERT INTO rate_limits (ip, count, last_access) VALUES (?, ?, ?)",
          [ip, 1, now]
        );
      }
    } catch (error) {
      logger.error("[SQLiteManager] レート制限更新エラー:", error);
      // エラーは外部に伝播させない（ログに記録するだけ）
    }
  }

  /**
   * IPアドレスのレート制限をリセット
   */
  async resetRateLimit(ip: string): Promise<void> {
    try {
      if (!this.db) {
        await this.init();
      }

      const now = Date.now();
      await this.db!.run(
        "UPDATE rate_limits SET count = 0, last_access = ? WHERE ip = ?",
        [now, ip]
      );
    } catch (error) {
      logger.error("[SQLiteManager] レート制限リセットエラー:", error);
      // エラーは外部に伝播させない（ログに記録するだけ）
    }
  }

  /**
   * レート制限の期限切れレコードを削除（定期的なクリーンアップ用）
   */
  async cleanupExpiredRateLimits(expiryMs: number): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    try {
      const threshold = Date.now() - expiryMs;
      await this.db!.run("DELETE FROM rate_limits WHERE last_access < ?", [
        threshold,
      ]);
    } catch (error) {
      logger.error("[SQLiteManager] レート制限クリーンアップエラー:", error);
      throw error;
    }
  }

  /**
   * メールアドレスによる支援者の検索
   */
  async getSupporterByEmail(email: string): Promise<SupporterRecord | null> {
    if (!this.db) {
      await this.init();
    }

    try {
      const result = await this.db!.get(
        `SELECT 
          email, 
          verification_code as verificationCode, 
          code_expires as codeExpires, 
          verified, 
          verified_at as verifiedAt 
        FROM supporters WHERE email = ?`,
        [email]
      );

      return result || null;
    } catch (error) {
      logger.error("[SQLiteManager] 支援者情報取得エラー:", error);
      throw error;
    }
  }

  /**
   * 確認コードによる支援者の検索
   */
  async getSupporterByVerificationCode(
    code: string
  ): Promise<SupporterRecord | null> {
    if (!this.db) {
      await this.init();
    }

    try {
      const result = await this.db!.get(
        `SELECT 
          email, 
          verification_code as verificationCode, 
          code_expires as codeExpires, 
          verified, 
          verified_at as verifiedAt 
        FROM supporters WHERE verification_code = ?`,
        [code]
      );

      return result || null;
    } catch (error) {
      logger.error("[SQLiteManager] 確認コードによる支援者検索エラー:", error);
      throw error;
    }
  }

  /**
   * 新規支援者の登録または更新
   */
  async createOrUpdateSupporter(
    supporter: Partial<SupporterRecord> & { email: string }
  ): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    try {
      const existing = await this.getSupporterByEmail(supporter.email);

      if (existing) {
        // 既存の支援者を更新
        const updates: string[] = [];
        const values: any[] = [];

        if (supporter.verificationCode !== undefined) {
          updates.push("verification_code = ?");
          values.push(supporter.verificationCode);
        }

        if (supporter.codeExpires !== undefined) {
          updates.push("code_expires = ?");
          values.push(supporter.codeExpires);
        }

        if (supporter.verified !== undefined) {
          updates.push("verified = ?");
          values.push(supporter.verified ? 1 : 0);
        }

        if (supporter.verifiedAt !== undefined) {
          updates.push("verified_at = ?");
          values.push(supporter.verifiedAt);
        }

        if (updates.length > 0) {
          values.push(supporter.email);
          await this.db!.run(
            `UPDATE supporters SET ${updates.join(", ")} WHERE email = ?`,
            values
          );
        }
      } else {
        // 新規支援者を作成
        await this.db!.run(
          "INSERT INTO supporters (email, verification_code, code_expires, verified, verified_at) VALUES (?, ?, ?, ?, ?)",
          [
            supporter.email,
            supporter.verificationCode || null,
            supporter.codeExpires || null,
            supporter.verified ? 1 : 0,
            supporter.verifiedAt || null,
          ]
        );
      }
    } catch (error) {
      logger.error("[SQLiteManager] 支援者登録/更新エラー:", error);
      throw error;
    }
  }

  /**
   * 支援者認証の確認
   */
  async verifySupporter(email: string, code: string): Promise<boolean> {
    try {
      if (!this.db) {
        await this.init();
      }

      try {
        const supporter = await this.getSupporterByEmail(email);

        if (!supporter) {
          return false;
        }

        // コードが正しく期限内であれば検証成功
        if (
          supporter.verificationCode === code &&
          supporter.codeExpires > Date.now()
        ) {
          // 認証成功時に支援者情報を更新
          // 既に認証済みの場合はverified=trueを保持し、最新の認証時刻を設定
          await this.createOrUpdateSupporter({
            email,
            verified: true, // 既に認証済みでも、再度trueに設定
            verifiedAt: Date.now(), // 認証時刻を更新
          });
          return true;
        }

        return false;
      } catch (error) {
        logger.error("[SQLiteManager] 支援者認証確認エラー:", error);
        // DB操作エラー時は認証失敗として処理
        return false;
      }
    } catch (error) {
      logger.error("[SQLiteManager] DB初期化エラー時の支援者認証確認:", error);
      // DB初期化エラー時も認証失敗として処理
      return false;
    }
  }

  /**
   * メールアドレスが認証済みかどうかを確認
   */
  async isVerifiedSupporter(email: string): Promise<boolean> {
    try {
      if (!this.db) {
        await this.init();
      }

      try {
        const supporter = await this.getSupporterByEmail(email);
        return supporter ? !!supporter.verified : false;
      } catch (error) {
        logger.error("[SQLiteManager] 支援者認証状態確認エラー:", error);
        // DB操作エラー時は制限を適用するため、falseを返す
        return false;
      }
    } catch (error) {
      logger.error("[SQLiteManager] DB初期化エラー時の支援者認証確認:", error);
      // DB初期化エラー時も制限を適用するため、falseを返す
      return false;
    }
  }

  /**
   * データベース接続のクローズ
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
        this.initialized = false;
        logger.log("[SQLiteManager] データベース接続をクローズしました");
      } catch (error) {
        logger.error("[SQLiteManager] データベースクローズエラー:", error);
        throw error;
      }
    }
  }
}

// シングルトンインスタンスを作成
export const sqliteManager = new SQLiteManager();
