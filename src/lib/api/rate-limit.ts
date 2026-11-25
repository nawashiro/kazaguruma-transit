import "server-only";
import { dataManager } from "../db/data-manager";
import { logger } from "@/utils/logger";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
/**
 * 1時間あたりの上限。地点検索は入力の確定ごとに呼ばれるため、経路検索と
 * 同じ共有バケツでも通常の操作で使い切らない値を選ぶ。
 */
const RATE_LIMIT_MAX_REQUESTS = 600;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; error: string };

export function getClientIp(headers: Pick<Headers, "get">): string {
  const forwardedFor = headers.get("x-forwarded-for");
  return forwardedFor ? forwardedFor.split(",")[0].trim() : "0.0.0.0";
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  try {
    await dataManager.init();
    const info = await dataManager.getRateLimitByIp(ip);
    if (info && Date.now() - info.lastAccess > RATE_LIMIT_WINDOW_MS) {
      await dataManager.resetRateLimit(ip);
    } else if (info && info.count >= RATE_LIMIT_MAX_REQUESTS) {
      return { allowed: false, error: "レート制限を超えました。1時間後に再度お試しください。" };
    }
    await dataManager.incrementRateLimit(ip);
    return { allowed: true };
  } catch (error) {
    logger.error("[RateLimit] 判定エラー:", error);
    return { allowed: false, error: "サーバーエラーが発生しました。しばらく経ってからお試しください。" };
  }
}
