import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../../lib/auth/auth-service";
import { logger } from "../../../../../utils/logger";

export async function POST(req: NextRequest) {
  try {
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

    return NextResponse.json(result);
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
