import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "../../../../lib/auth/session";
import { logger } from "../../../../utils/logger";

/**
 * ログアウトAPI - セッションを破棄してユーザーをログアウトさせる
 */
export async function POST(req: NextRequest) {
  try {
    // CSRFトークン検証を追加するとより安全になります
    // const { csrfToken } = await req.json();
    // if (!validateCsrfToken(csrfToken)) {
    //   return NextResponse.json({
    //     success: false,
    //     message: "不正なリクエストです",
    //   }, { status: 403 });
    // }

    let response = NextResponse.json({
      success: true,
      message: "ログアウトしました",
    });

    // セッションをクリア
    response = (await clearSession(response)) as NextResponse<{
      success: boolean;
      message: string;
    }>;

    // キャッシュ制御ヘッダーを追加
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

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
