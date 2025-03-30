import fs from "fs";
import path from "path";
import { openDb, closeDb, getStops, getRoutes } from "gtfs";

// configファイルのパス
const CONFIG_PATH = path.join(process.cwd(), "transit-config.json");

/**
 * データベース接続とトランザクションを管理するシングルトンクラス
 */
export class Database {
  private static instance: Database;
  private isDbOpen: boolean = false;
  private config: any = null;
  private connectionId: string;
  private dbHandle: any = null; // SQLiteデータベースハンドル

  /**
   * プライベートコンストラクタでシングルトンパターンを実現
   */
  private constructor() {
    this.connectionId = `db_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log(`[DB:${this.connectionId}] データベースインスタンスを作成`);

    try {
      this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
      console.log(
        `[DB:${this.connectionId}] 設定ファイルを読み込みました: ${this.config.sqlitePath}`
      );
    } catch (error) {
      console.error(
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
   * まだ接続が開かれていない場合は新しく接続を開く
   */
  public async ensureConnection(): Promise<void> {
    if (!this.isDbOpen) {
      try {
        console.log(
          `[DB:${this.connectionId}] データベース接続を開始します: ${this.config.sqlitePath}`
        );
        // openDbはデータベース接続を返すので保存する
        this.dbHandle = await openDb(this.config);
        this.isDbOpen = true;
        console.log(`[DB:${this.connectionId}] データベース接続が開かれました`);
      } catch (error) {
        console.error(
          `[DB:${this.connectionId}] データベース接続を開くことに失敗しました:`,
          error
        );
        throw new Error("データベース接続に失敗しました");
      }
    }
  }

  /**
   * データベース接続を閉じる
   * 接続が開かれている場合のみ実行される
   */
  public async closeConnection(): Promise<void> {
    if (this.isDbOpen) {
      try {
        console.log(`[DB:${this.connectionId}] データベース接続を閉じます`);
        await closeDb();
        this.isDbOpen = false;
        this.dbHandle = null;
        console.log(
          `[DB:${this.connectionId}] データベース接続が閉じられました`
        );
      } catch (error) {
        console.warn(
          `[DB:${this.connectionId}] データベース接続を閉じる際にエラーが発生しました:`,
          error
        );
      }
    }
  }

  /**
   * バックエンドのSQLiteデータベースハンドルを取得する
   * このメソッドはカスタムSQLクエリの実行など低レベルなデータベース操作に使用されます
   */
  public async getDbHandle(): Promise<any> {
    await this.ensureConnection();

    if (!this.dbHandle) {
      throw new Error("有効なデータベース接続がありません");
    }

    return this.dbHandle;
  }

  /**
   * データベースの整合性を確認する
   */
  public async checkIntegrity(): Promise<boolean> {
    try {
      const dbFilePath = path.join(process.cwd(), this.config.sqlitePath);
      console.log(
        `[DB:${this.connectionId}] データベース整合性チェック開始: ${dbFilePath}`
      );

      // ファイルが存在しない場合は整合性がない
      if (!fs.existsSync(dbFilePath)) {
        console.log(
          `[DB:${this.connectionId}] データベースファイルが存在しません。`
        );
        return false;
      }

      // データベース接続を確保
      await this.ensureConnection();

      try {
        // 最も基本的なテーブルに対してクエリを実行してみる
        console.log(
          `[DB:${this.connectionId}] stopsテーブルにクエリを実行します`
        );
        const stops = await getStops();
        console.log(
          `[DB:${this.connectionId}] stopsテーブルのクエリ結果: ${
            stops?.length || 0
          }件`
        );

        console.log(
          `[DB:${this.connectionId}] routesテーブルにクエリを実行します`
        );
        const routes = await getRoutes();
        console.log(
          `[DB:${this.connectionId}] routesテーブルのクエリ結果: ${
            routes?.length || 0
          }件`
        );

        // 結果の確認
        if (!stops || stops.length === 0 || !routes || routes.length === 0) {
          console.log(
            `[DB:${this.connectionId}] データベースにデータが不足しています。`
          );
          return false;
        }

        console.log(`[DB:${this.connectionId}] データベース整合性チェック成功`);
        return true;
      } catch (error) {
        console.error(
          `[DB:${this.connectionId}] データベースのクエリ実行中にエラーが発生しました:`,
          error
        );
        return false;
      }
    } catch (error) {
      console.error(
        `[DB:${this.connectionId}] データベースの整合性チェックに失敗しました:`,
        error
      );
      return false;
    }
  }

  /**
   * 接続を確保してからコールバック関数を実行し、実行後に接続を閉じる（オプション）
   * このメソッドを使うことで、データベース接続の開閉を自動的に管理できる
   *
   * @param callback 実行したいデータベース操作を含むコールバック関数
   * @param closeAfter 実行後に接続を閉じるかどうか（デフォルトはfalse）
   * @returns コールバック関数の実行結果
   */
  public async withConnection<T>(
    callback: () => Promise<T>,
    closeAfter: boolean = false
  ): Promise<T> {
    try {
      // 接続を確保
      await this.ensureConnection();
      console.log(`[DB:${this.connectionId}] コールバック関数を実行します`);

      // コールバックを実行
      const result = await callback();
      console.log(`[DB:${this.connectionId}] コールバック関数が完了しました`);

      // 指定されていれば接続を閉じる
      if (closeAfter) {
        await this.closeConnection();
      }

      return result;
    } catch (error) {
      console.error(
        `[DB:${this.connectionId}] コールバック実行中にエラーが発生:`,
        error
      );
      // エラーが発生した場合も、closeAfterが指定されていれば接続を閉じる
      if (closeAfter) {
        await this.closeConnection();
      }
      throw error;
    }
  }
}
