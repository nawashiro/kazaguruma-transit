import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../../lib/auth/auth-service";
import { logger } from "../../../../../utils/logger";
import { rateLimiter } from "../../../../../lib/auth/rate-limiter";

/**
 * 支援者登録API - メールアドレス確認コードを送信
 */
export async function POST(req: NextRequest) {
  try {
    // レート制限を実装してスパム攻撃を防ぐ
    const clientIp =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const actionType = "email_send";

    // 同一IPからの過剰なメール送信リクエストを制限する
    if (await rateLimiter.isRateLimited(clientIp, actionType)) {
      logger.warn(`[API] メール送信レート制限超過: ${clientIp}`);
      return NextResponse.json(
        {
          success: false,
          message:
            "メール送信回数が多すぎます。しばらく時間をおいてお試しください",
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          message: "メールアドレスが必要です",
        },
        { status: 400 }
      );
    }

    // レート制限カウントを増やす
    await rateLimiter.incrementRateLimit(clientIp, actionType);

    // メールアドレスの形式を検証
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "有効なメールアドレスを入力してください",
        },
        { status: 400 }
      );
    }

    // 支援者登録プロセスを開始（確認コードの生成とメール送信）
    const result = await authService.startSupporterRegistration(email);

    // キャッシュ防止ヘッダーを設定
    const response = NextResponse.json(result);
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    logger.error("[API] 支援者登録エラー:", error);
    return NextResponse.json(
      {
        success: false,
        message: "登録処理中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
