import { NextApiRequest, NextApiResponse } from "next";
import { NextRequest, NextResponse } from "next/server";
import { sqliteManager } from "../db/sqlite-manager";
import { logger } from "../../utils/logger";
import { authService } from "../auth/auth-service";
import { getSessionData } from "../auth/session";
import { IncomingMessage } from "http";

// 設定
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1時間
const RATE_LIMIT_MAX_REQUESTS = 10; // 1時間あたり10リクエスト

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
 * クライアントリクエストからメールアドレスを取得する
 */
function getEmailFromRequest(req: NextApiRequest | NextRequest): string | null {
  // APIリクエストからメールアドレスを取得
  if ("body" in req && req.body) {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (body && typeof body === "object" && "email" in body) {
      return body.email;
    }
  }

  // クエリパラメータからメールアドレスを取得
  if (
    "query" in req &&
    req.query &&
    typeof req.query === "object" &&
    "email" in req.query
  ) {
    return req.query.email as string;
  }

  // NextRequest の場合
  if ("nextUrl" in req && req.nextUrl) {
    const email = req.nextUrl.searchParams.get("email");
    if (email) {
      return email;
    }
  }

  // Cookieからメールアドレスを取得
  if ("cookies" in req && req.cookies) {
    if (typeof req.cookies.get === "function") {
      const cookie = req.cookies.get("supporter_email");
      if (cookie && typeof cookie === "object" && "value" in cookie) {
        return cookie.value;
      }
    }
  }

  return null;
}

/**
 * App Router用のレート制限ミドルウェア
 */
export async function appRouterRateLimitMiddleware(
  req: NextRequest
): Promise<NextResponse | undefined> {
  try {
    const ip = getClientIp(req);

    // セッションから支援者情報を取得
    const session = await getSessionData(req);

    // セッションから支援者であるかを確認
    if (session.isLoggedIn && session.isSupporter) {
      // 認証済み支援者は制限なし
      return undefined;
    }

    // レート制限を適用
    await sqliteManager.init(); // 初期化されていることを確認
    const rateLimitInfo = await sqliteManager.getRateLimitByIp(ip);

    const now = Date.now();
    if (rateLimitInfo) {
      // 前回のアクセスから一定時間経過していたらリセット
      if (now - rateLimitInfo.lastAccess > RATE_LIMIT_WINDOW_MS) {
        await sqliteManager.resetRateLimit(ip);
        await sqliteManager.incrementRateLimit(ip);
        return undefined;
      }

      // 制限回数を超えている場合
      if (rateLimitInfo.count >= RATE_LIMIT_MAX_REQUESTS) {
        return NextResponse.json(
          {
            success: false,
            error: "レート制限を超えました。支援者登録をご検討ください。",
            limitExceeded: true,
          },
          { status: 429 }
        );
      }

      // 制限内の場合はカウントを増やして続行
      await sqliteManager.incrementRateLimit(ip);
      return undefined;
    } else {
      // 初めてのアクセス
      await sqliteManager.incrementRateLimit(ip);
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

    // Cookieからセッション情報を取得（Pages Router用の単純化したバージョン）
    // 本格的な実装では iron-session の withIronSessionApiRoute を使用すること
    const sessionCookie = req.cookies[sessionOptions.cookieName];

    if (sessionCookie) {
      try {
        // 認証済み支援者は制限なし
        // 注意: 実際のプロダクションコードではsealedからデータを取得するためのユーティリティを使用すべき
        const sessionData = JSON.parse(
          Buffer.from(sessionCookie, "base64").toString()
        );
        if (sessionData.isLoggedIn && sessionData.isSupporter) {
          return next();
        }
      } catch (e) {
        logger.error("[RateLimit] セッションCookie解析エラー:", e);
        // セッション解析エラー時は通常通り制限を適用
      }
    }

    // レート制限を適用
    await sqliteManager.init(); // 初期化されていることを確認
    const rateLimitInfo = await sqliteManager.getRateLimitByIp(ip);

    const now = Date.now();
    if (rateLimitInfo) {
      // 前回のアクセスから一定時間経過していたらリセット
      if (now - rateLimitInfo.lastAccess > RATE_LIMIT_WINDOW_MS) {
        await sqliteManager.resetRateLimit(ip);
        await sqliteManager.incrementRateLimit(ip);
        return next();
      }

      // 制限回数を超えている場合
      if (rateLimitInfo.count >= RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({
          success: false,
          error: "レート制限を超えました。支援者登録をご検討ください。",
          limitExceeded: true,
        });
      }

      // 制限内の場合はカウントを増やして続行
      await sqliteManager.incrementRateLimit(ip);
      return next();
    } else {
      // 初めてのアクセス
      await sqliteManager.incrementRateLimit(ip);
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
export function withRateLimit(handler: any) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    await apiRateLimitMiddleware(req, res, () => handler(req, res));
  };
}

// セッション関連の設定（簡易版）
const sessionOptions = {
  cookieName: "chiyoda_transit_session",
};
