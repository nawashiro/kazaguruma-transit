import path from "path";
import fs from "fs";

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
 * 設定ファイルを読み込む
 */
export function loadConfig(): TransitConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (error) {
    console.error("設定ファイルの読み込みに失敗しました:", error);
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
    console.error("設定ファイルの保存に失敗しました:", error);
    throw new Error("設定ファイルの保存に失敗しました");
  }
}
