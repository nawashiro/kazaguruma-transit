import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../../lib/auth/auth-service";
import { logger } from "../../../../../utils/logger";
import { setSessionData } from "../../../../../lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code } = body;

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

      return sessionResponse;
    } else {
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
