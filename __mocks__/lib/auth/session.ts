import { NextRequest, NextResponse } from "next/server";

// セッションの型定義
export interface SessionData {
  isLoggedIn: boolean;
  email?: string;
  isSupporter?: boolean;
  isVerified?: boolean;
  kofiStatus?: boolean;
  lastKofiCheck?: number;
}

// セッション設定
export const sessionOptions = {
  password: "test_password",
  ttl: 60 * 60 * 24 * 30,
  cookieName: "chiyoda_transit_session",
  cookieOptions: {
    secure: false,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax" as const,
    path: "/",
  },
  kofiCheckInterval: 24 * 60 * 60 * 1000,
};

// App Router用のセッションミドルウェア
export async function getSessionData(req: NextRequest): Promise<SessionData> {
  return { isLoggedIn: false };
}

// セッション作成・更新
export async function setSessionData(
  res: NextResponse,
  data: Partial<SessionData>
): Promise<NextResponse> {
  return res;
}

// セッションを削除（ログアウト）
export async function clearSession(res: NextResponse): Promise<NextResponse> {
  return res;
}

/**
 * Ko-fi状態の再確認が必要かどうか
 */
export function shouldCheckKofiStatus(session: SessionData): boolean {
  return true;
}
