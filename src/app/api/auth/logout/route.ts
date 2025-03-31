import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "../../../../lib/auth/session";
import { logger } from "../../../../utils/logger";

export async function POST(req: NextRequest) {
  try {
    let response = NextResponse.json({
      success: true,
      message: "ログアウトしました",
    });

    // セッションをクリア
    response = (await clearSession(response)) as NextResponse<{
      success: boolean;
      message: string;
    }>;

    return response;
  } catch (error) {
    logger.error("[API] ログアウトエラー:", error);
    return NextResponse.json(
      {
        success: false,
        message: "ログアウト処理中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
