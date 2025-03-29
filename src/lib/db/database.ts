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

  /**
   * プライベートコンストラクタでシングルトンパターンを実現
   */
  private constructor() {
    try {
      this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (error) {
      console.error("設定ファイルの読み込みに失敗しました:", error);
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
        await openDb(this.config);
        this.isDbOpen = true;
      } catch (error) {
        console.error("データベース接続を開くことに失敗しました:", error);
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
        await closeDb();
        this.isDbOpen = false;
      } catch (error) {
        console.warn(
          "データベース接続を閉じる際にエラーが発生しました:",
          error
        );
      }
    }
  }

  /**
   * データベースの整合性を確認する
   */
  public async checkIntegrity(): Promise<boolean> {
    try {
      const dbFilePath = path.join(process.cwd(), this.config.sqlitePath);

      // ファイルが存在しない場合は整合性がない
      if (!fs.existsSync(dbFilePath)) {
        console.log("データベースファイルが存在しません。");
        return false;
      }

      // データベース接続を確保
      await this.ensureConnection();

      try {
        // 最も基本的なテーブルに対してクエリを実行してみる
        const stops = await getStops();
        const routes = await getRoutes();

        // 結果の確認
        if (!stops || stops.length === 0 || !routes || routes.length === 0) {
          console.log("データベースにデータが不足しています。");
          return false;
        }

        return true;
      } catch (error) {
        console.error(
          "データベースのクエリ実行中にエラーが発生しました:",
          error
        );
        return false;
      }
    } catch (error) {
      console.error("データベースの整合性チェックに失敗しました:", error);
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

      // コールバックを実行
      const result = await callback();

      // 指定されていれば接続を閉じる
      if (closeAfter) {
        await this.closeConnection();
      }

      return result;
    } catch (error) {
      // エラーが発生した場合も、closeAfterが指定されていれば接続を閉じる
      if (closeAfter) {
        await this.closeConnection();
      }
      throw error;
    }
  }
}
