import fs from "fs";
import path from "path";
import { loadConfig, TransitConfig } from "../config/config";
import { prisma } from "./prisma";
import { logger } from "../../utils/logger";

/**
 * データベース接続を管理するシングルトンクラス
 * Prismaを使用してORMベースのアクセスを提供
 */
export class Database {
  private static instance: Database;
  private config: TransitConfig;
  private connectionId: string;

  /**
   * プライベートコンストラクタでシングルトンパターンを実現
   */
  private constructor() {
    this.connectionId = `db_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    logger.log(`[DB:${this.connectionId}] データベースインスタンスを作成`);

    try {
      this.config = loadConfig();
      logger.log(
        `[DB:${this.connectionId}] 設定ファイルを読み込みました: ${this.config.sqlitePath}`
      );
    } catch (error) {
      logger.error(
        `[DB:${this.connectionId}] 設定ファイルの読み込みに失敗しました:`,
        error
      );
      throw new Error("データベース設定の初期化に失敗しました");
    }
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * データベース接続が存在することを確認する
   * PrismaではDBクライアントは自動的に接続を管理するので、
   * このメソッドは主にディレクトリの確認と存在チェックを行う
   */
  public async ensureConnection(): Promise<void> {
    try {
      logger.log(
        `[DB:${this.connectionId}] データベース接続を確認します: ${this.config.sqlitePath}`
      );

      // データベースディレクトリが存在するか確認
      const dbDir = path.dirname(
        path.join(process.cwd(), this.config.sqlitePath)
      );
      if (!fs.existsSync(dbDir)) {
        logger.log(
          `[DB:${this.connectionId}] ディレクトリを作成します: ${dbDir}`
        );
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 簡単なクエリを実行してデータベース接続をテスト
      await prisma.$queryRaw`SELECT 1`;
      logger.log(`[DB:${this.connectionId}] データベース接続が確認できました`);
    } catch (error) {
      logger.error(
        `[DB:${this.connectionId}] データベース接続の確認に失敗しました:`,
        error
      );
      throw new Error("データベース接続に失敗しました");
    }
  }

  /**
   * データベース接続を閉じる
   * Prismaでは$disconnectで接続を閉じる
   */
  public async closeConnection(): Promise<void> {
    try {
      logger.log(`[DB:${this.connectionId}] データベース接続を閉じます`);
      await prisma.$disconnect();
      logger.log(`[DB:${this.connectionId}] データベース接続が閉じられました`);
    } catch (error) {
      logger.warn(
        `[DB:${this.connectionId}] データベース接続を閉じる際にエラーが発生しました:`,
        error
      );
    }
  }

  /**
   * Prismaクライアントを取得する
   */
  public getPrismaClient() {
    return prisma;
  }

  /**
   * データベースの整合性を確認する
   */
  public async checkIntegrity(): Promise<boolean> {
    try {
      const dbFilePath = path.join(process.cwd(), this.config.sqlitePath);
      logger.log(
        `[DB:${this.connectionId}] データベース整合性チェック開始: ${dbFilePath}`
      );

      // ファイルが存在しない場合は整合性がない
      if (!fs.existsSync(dbFilePath)) {
        logger.log(
          `[DB:${this.connectionId}] データベースファイルが存在しません。`
        );
        return false;
      }

      // データベース接続を確保
      await this.ensureConnection();

      try {
        // 基本的なテーブルのデータ件数を確認
        logger.log(
          `[DB:${this.connectionId}] stopsテーブルにクエリを実行します`
        );
        const stopsCount = await prisma.stop.count();
        logger.log(
          `[DB:${this.connectionId}] stopsテーブルのクエリ結果: ${stopsCount}件`
        );

        logger.log(
          `[DB:${this.connectionId}] routesテーブルにクエリを実行します`
        );
        const routesCount = await prisma.route.count();
        logger.log(
          `[DB:${this.connectionId}] routesテーブルのクエリ結果: ${routesCount}件`
        );

        // 結果の確認 - データが存在するかどうか
        if (stopsCount === 0 || routesCount === 0) {
          logger.log(
            `[DB:${this.connectionId}] データベースにデータが不足しています。`
          );
          return false;
        }

        logger.log(`[DB:${this.connectionId}] データベース整合性チェック成功`);
        return true;
      } catch (error) {
        logger.error(
          `[DB:${this.connectionId}] データベースのクエリ実行中にエラーが発生しました:`,
          error
        );
        return false;
      }
    } catch (error) {
      logger.error(
        `[DB:${this.connectionId}] データベースの整合性チェックに失敗しました:`,
        error
      );
      return false;
    }
  }

  /**
   * コールバック関数を実行する
   * Prismaではトランザクションを使用する場合は$transaction内で実行する
   *
   * @param callback 実行したいデータベース操作を含むコールバック関数
   * @returns コールバック関数の実行結果
   */
  public async withConnection<T>(callback: () => Promise<T>): Promise<T> {
    try {
      // 接続を確保
      await this.ensureConnection();
      logger.log(`[DB:${this.connectionId}] コールバック関数を実行します`);

      // コールバックを実行
      const result = await callback();
      logger.log(`[DB:${this.connectionId}] コールバック関数が完了しました`);

      return result;
    } catch (error) {
      logger.error(
        `[DB:${this.connectionId}] コールバック実行中にエラーが発生:`,
        error
      );
      throw error;
    }
  }

  /**
   * トランザクション内でコールバック関数を実行する
   *
   * @param callback トランザクション内で実行したいコールバック関数
   * @returns コールバック関数の実行結果
   */
  public async withTransaction<T>(
    callback: (tx: typeof prisma) => Promise<T>
  ): Promise<T> {
    try {
      // 接続を確保
      await this.ensureConnection();
      logger.log(`[DB:${this.connectionId}] トランザクションを開始します`);

      // Prismaのトランザクション内でコールバックを実行
      const result = await prisma.$transaction(async (tx: typeof prisma) => {
        return await callback(tx);
      });

      logger.log(`[DB:${this.connectionId}] トランザクションが完了しました`);
      return result;
    } catch (error) {
      logger.error(
        `[DB:${this.connectionId}] トランザクション実行中にエラーが発生:`,
        error
      );
      throw error;
    }
  }
}
