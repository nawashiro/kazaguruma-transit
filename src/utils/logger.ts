/**
 * 環境に応じたログ出力ユーティリティ
 * 本番環境ではログを出力せず、開発環境のみログを出力します
 */

const isDevelopment = process.env.NODE_ENV === "development";

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  error: (...args: any[]) => {
    // エラーログは本番環境でも出力（重要な問題の追跡のため）
    console.error(...args);
  },
};
