import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "../../../../lib/auth/session";
import { logger } from "../../../../utils/logger";

export interface PdfPermissionResponse {
  success: boolean;
  canPrint: boolean;
  isLoggedIn: boolean;
  isSupporter: boolean;
  error?: string;
}

export async function GET(req: NextRequest) {
  try {
    // セッションから認証・支援者情報を取得
    const session = await getSessionData(req);
    const isLoggedIn = session.isLoggedIn;
    const isSupporter = session.isSupporter || false;

    // 結果を返す
    return NextResponse.json({
      success: true,
      canPrint: isLoggedIn && isSupporter,
      isLoggedIn,
      isSupporter,
    } as PdfPermissionResponse);
  } catch (error) {
    logger.error("PDF permission check error:", error);
    return NextResponse.json(
      {
        success: false,
        canPrint: false,
        isLoggedIn: false,
        isSupporter: false,
        error: "権限確認中にエラーが発生しました",
      } as PdfPermissionResponse,
      { status: 500 }
    );
  }
}
