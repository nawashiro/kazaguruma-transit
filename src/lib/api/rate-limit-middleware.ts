import { NextApiRequest, NextApiResponse } from "next";
import { NextRequest, NextResponse } from "next/server";
import { dataManager } from "../db/data-manager";
import { logger } from "../../utils/logger";

// 設定
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1時間
const RATE_LIMIT_MAX_REQUESTS = 60; // 1時間あたり60リクエスト

/**
 * IPアドレスを取得する関数
 */
function getClientIp(req: NextApiRequest | NextRequest): string {
  if ("headers" in req && req.headers && "x-forwarded-for" in req.headers) {
    // NextApiRequest の場合
    const forwardedFor = req.headers["x-forwarded-for"];
    if (forwardedFor) {
      return Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(",")[0].trim();
    }
    return (req as NextApiRequest).socket?.remoteAddress || "0.0.0.0";
  } else if ("headers" in req && req.headers instanceof Headers) {
    // NextRequest の場合
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0].trim();
    }
  }
  return "0.0.0.0";
}

/**
 * App Router用のレート制限ミドルウェア
 */
export async function appRouterRateLimitMiddleware(
  req: NextRequest
): Promise<NextResponse | undefined> {
  try {
    const ip = getClientIp(req);

    // レート制限を適用
    await dataManager.init(); // 初期化されていることを確認
    const rateLimitInfo = await dataManager.getRateLimitByIp(ip);

    const now = Date.now();
    if (rateLimitInfo) {
      // 前回のアクセスから一定時間経過していたらリセット
      if (now - rateLimitInfo.lastAccess > RATE_LIMIT_WINDOW_MS) {
        await dataManager.resetRateLimit(ip);
        await dataManager.incrementRateLimit(ip);
        return undefined;
      }

      // 制限回数を超えている場合
      if (rateLimitInfo.count >= RATE_LIMIT_MAX_REQUESTS) {
        return NextResponse.json(
          {
            success: false,
            error: "レート制限を超えました。1時間後に再度お試しください。",
            limitExceeded: true,
          },
          { status: 429 }
        );
      }

      // 制限内の場合はカウントを増やして続行
      await dataManager.incrementRateLimit(ip);
      return undefined;
    } else {
      // 初めてのアクセス
      await dataManager.incrementRateLimit(ip);
      return undefined;
    }
  } catch (error) {
    logger.error("[RateLimit] ミドルウェアエラー:", error);
    // エラー時は安全策として制限をかける
    return NextResponse.json(
      {
        success: false,
        error:
          "サーバーエラーが発生しました。しばらく経ってからお試しください。",
        limitExceeded: true,
      },
      { status: 429 }
    );
  }
}

/**
 * API Routes用のレート制限ミドルウェア
 * 注意: このミドルウェアは古い Pages Router 用なので、将来的に削除される可能性があります
 */
export async function apiRateLimitMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  try {
    const ip = getClientIp(req);

    // レート制限を適用
    await dataManager.init(); // 初期化されていることを確認
    const rateLimitInfo = await dataManager.getRateLimitByIp(ip);

    const now = Date.now();
    if (rateLimitInfo) {
      // 前回のアクセスから一定時間経過していたらリセット
      if (now - rateLimitInfo.lastAccess > RATE_LIMIT_WINDOW_MS) {
        await dataManager.resetRateLimit(ip);
        await dataManager.incrementRateLimit(ip);
        return next();
      }

      // 制限回数を超えている場合
      if (rateLimitInfo.count >= RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({
          success: false,
          error: "レート制限を超えました。1時間後に再度お試しください。",
          limitExceeded: true,
        });
      }

      // 制限内の場合はカウントを増やして続行
      await dataManager.incrementRateLimit(ip);
      return next();
    } else {
      // 初めてのアクセス
      await dataManager.incrementRateLimit(ip);
      return next();
    }
  } catch (error) {
    logger.error("[RateLimit] ミドルウェアエラー:", error);
    // エラー時は安全策として制限をかける
    return res.status(429).json({
      success: false,
      error: "サーバーエラーが発生しました。しばらく経ってからお試しください。",
      limitExceeded: true,
    });
  }
}

/**
 * API Routeのハンドラをラップしてレート制限を適用するユーティリティ
 */
export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    await apiRateLimitMiddleware(req, res, () => handler(req, res));
  };
}
