import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "../../../../lib/auth/session";
import { logger } from "../../../../utils/logger";

export async function GET(req: NextRequest) {
  try {
    // セッションデータを取得
    const session = await getSessionData(req);

    return NextResponse.json({
      success: true,
      data: {
        isLoggedIn: session.isLoggedIn,
        email: session.email,
        isSupporter: session.isSupporter,
      },
    });
  } catch (error) {
    logger.error("[API] セッション取得エラー:", error);
    return NextResponse.json(
      {
        success: false,
        message: "セッション情報の取得中にエラーが発生しました",
        data: { isLoggedIn: false },
      },
      { status: 500 }
    );
  }
}
