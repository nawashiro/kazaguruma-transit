/**
 * 環境に応じたログ出力ユーティリティ
 * 本番環境ではログを出力せず、開発環境のみログを出力します
 */

import fs from "fs";
import path from "path";

const isDevelopment = process.env.NODE_ENV === "development";
const logToFile = process.env.LOG_TO_FILE === "true";
const logFilePath =
  process.env.LOG_FILE_PATH || path.join(process.cwd(), "app.log");

function writeLogToFile(...args: unknown[]) {
  if (!logToFile) return;
  const msg = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFilePath, line, { encoding: "utf8" });
  } catch (e) {
    // ファイル出力失敗時は何もしない
  }
}

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
    writeLogToFile(...args);
  },

  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
    writeLogToFile(...args);
  },

  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
    writeLogToFile(...args);
  },

  error: (...args: unknown[]) => {
    // エラーログは本番環境でも出力（重要な問題の追跡のため）
    console.error(...args);
    writeLogToFile(...args);
  },
};
