import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../../lib/auth/auth-service";
import { logger } from "../../../../../utils/logger";
import { setSessionData } from "../../../../../lib/auth/session";
import { rateLimiter } from "../../../../../lib/auth/rate-limiter";

/**
 * 支援者認証API - 確認コードを検証してログイン処理を行う
 * このエンドポイントは実質的なログイン処理を担当します
 */
export async function POST(req: NextRequest) {
  try {
    // レート制限を実装することでブルートフォース攻撃を防ぐ
    const clientIp =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const actionType = "verify_attempt";

    // 同一IPからの過剰なリクエストを制限する
    if (await rateLimiter.isRateLimited(clientIp, actionType)) {
      logger.warn(
        `[API] レート制限超過: ${clientIp}, アクション: ${actionType}`
      );
      return NextResponse.json(
        {
          success: false,
          message: "試行回数が多すぎます。しばらく時間をおいてお試しください",
        },
        { status: 429 }
      );
    }

    // CSRFトークン検証を追加するとより安全になります
    // const { email, code, csrfToken } = await req.json();
    // if (!validateCsrfToken(csrfToken)) {
    //   return NextResponse.json({
    //     success: false,
    //     message: "不正なリクエストです",
    //   }, { status: 403 });
    // }

    const body = await req.json();
    const { email, code } = body;

    // レート制限のカウントを増やす（成功・失敗に関わらず）
    await rateLimiter.incrementRateLimit(clientIp, actionType);

    if (!email || !code) {
      return NextResponse.json(
        {
          success: false,
          message: "メールアドレスと確認コードが必要です",
        },
        { status: 400 }
      );
    }

    // 認証コードを検証
    const result = await authService.verifySupporterCode(email, code);

    if (result.success) {
      // 認証成功時にセッションを作成
      const response = NextResponse.json(result);

      // セッションデータを設定
      const sessionResponse = await setSessionData(response, {
        isLoggedIn: true,
        email,
        isSupporter: true,
      });

      // セキュリティヘッダーを追加
      sessionResponse.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      sessionResponse.headers.set("Pragma", "no-cache");
      sessionResponse.headers.set("Expires", "0");
      sessionResponse.headers.set("X-Session-Update", "true");

      // Content Security Policyを追加（オプション）
      // sessionResponse.headers.set('Content-Security-Policy', "default-src 'self'");

      // 成功した場合はレート制限カウンターをリセットする
      // （正当なユーザーが間違えた場合のペナルティを減らす）
      try {
        // カウンター削除はエラーを無視（非クリティカル）
        await rateLimiter.resetRateLimit(clientIp, actionType);
      } catch {
        // 無視
      }

      return sessionResponse;
    } else {
      // 失敗したログイン試行をログに記録
      logger.warn(`[API] 認証失敗: ${email}, IP: ${clientIp}`);

      return NextResponse.json(result);
    }
  } catch (error) {
    logger.error("[API] 支援者認証エラー:", error);
    return NextResponse.json(
      {
        success: false,
        message: "認証処理中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
