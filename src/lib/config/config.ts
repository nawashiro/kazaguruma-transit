import path from "path";
import fs from "fs";
import { logger } from "@/utils/logger";

/**
 * 設定ファイルのパス
 */
export const CONFIG_PATH = path.join(process.cwd(), "transit-config.json");

/**
 * 設定情報の型定義
 */
export interface TransitConfig {
  sqlitePath: string;
  agencies: Array<{
    agency_key: string;
    path?: string;
    url?: string;
  }>;
  verbose: boolean;
  skipImport?: boolean;
}

/**
 * 設定ファイルのSQLiteパスを実行時の絶対パスへ解決する
 */
export function resolveSqlitePath(sqlitePath: string): string {
  if (
    sqlitePath === ":memory:" ||
    sqlitePath.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(sqlitePath)
  ) {
    return sqlitePath;
  }

  return path.join(process.cwd(), sqlitePath);
}

/**
 * Prismaへ渡すSQLite datasource URLを生成する
 */
export function getPrismaDatasourceUrl(sqlitePath: string): string {
  return `file:${sqlitePath}`;
}

/**
 * 設定ファイルを読み込む
 */
export function loadConfig(): TransitConfig {
  try {
    const config = JSON.parse(
      fs.readFileSync(CONFIG_PATH, "utf8")
    ) as TransitConfig;

    return {
      ...config,
      sqlitePath: resolveSqlitePath(config.sqlitePath),
    };
  } catch (error) {
    logger.error("設定ファイルの読み込みに失敗しました:", error);
    throw new Error("設定ファイルの読み込みに失敗しました");
  }
}

/**
 * 設定を保存する
 */
export function saveConfig(config: TransitConfig): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    logger.error("設定ファイルの保存に失敗しました:", error);
    throw new Error("設定ファイルの保存に失敗しました");
  }
}
