// import { ironSession } from 'iron-session/next';
import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../utils/logger";

// セッションの型定義
export interface SessionData {
  isLoggedIn: boolean;
  email?: string;
  isSupporter?: boolean;
  isVerified?: boolean;
  kofiStatus?: boolean;
  lastKofiCheck?: number; // Ko-fi状態の最終確認時刻
}

// セッション設定
export const sessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "complex_password_at_least_32_characters_long",
  ttl: 60 * 60 * 24 * 30, // 30日間
  cookieName: "chiyoda_transit_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30日間
    sameSite: "lax" as const,
    path: "/",
  },
  kofiCheckInterval: 24 * 60 * 60 * 1000, // Ko-fi状態確認の間隔（24時間）
};

// App Router用のセッションミドルウェア
export async function getSessionData(req: NextRequest): Promise<SessionData> {
  try {
    // Next.js App RouterでのCookieの取得
    const sessionCookie = req.cookies.get(sessionOptions.cookieName);

    if (!sessionCookie?.value) {
      return { isLoggedIn: false };
    }

    // iron-sessionを使用してcookieを復号
    const session = await unsealData<SessionData>(sessionCookie.value, {
      password: sessionOptions.password,
    });

    return session || { isLoggedIn: false };
  } catch (error) {
    logger.error("[Session] セッションデータ取得エラー:", error);
    return { isLoggedIn: false };
  }
}

// セッション作成・更新
export async function setSessionData(
  res: NextResponse,
  data: Partial<SessionData>
): Promise<NextResponse> {
  try {
    // 現在のセッションデータを取得（もしあれば）
    let currentSession: SessionData = { isLoggedIn: false };

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(sessionOptions.cookieName);

    if (sessionCookie?.value) {
      try {
        // 既存のセッションデータを復号
        currentSession = await unsealData<SessionData>(sessionCookie.value, {
          password: sessionOptions.password,
        });
      } catch (e) {
        // 既存のセッションが無効な場合は新しいセッションを作成
        logger.error("[Session] 既存セッション復号エラー:", e);
      }
    }

    // Ko-fi状態確認時刻更新
    if (data.kofiStatus !== undefined) {
      data.lastKofiCheck = Date.now();
    }

    // セッションデータを更新
    const updatedSession: SessionData = {
      ...currentSession,
      ...data,
      isLoggedIn:
        data.isLoggedIn !== undefined
          ? data.isLoggedIn
          : currentSession.isLoggedIn,
    };

    // セッションを暗号化
    const encryptedSession = await sealData(updatedSession, {
      password: sessionOptions.password,
      ttl: sessionOptions.ttl,
    });

    // レスポンスにCookieをセット
    res.cookies.set({
      name: sessionOptions.cookieName,
      value: encryptedSession,
      ...sessionOptions.cookieOptions,
    });

    return res;
  } catch (error) {
    logger.error("[Session] セッションデータ設定エラー:", error);
    return res;
  }
}

// セッションを削除（ログアウト）
export async function clearSession(res: NextResponse): Promise<NextResponse> {
  // クッキーを完全に削除するためのオプション
  res.cookies.set({
    name: sessionOptions.cookieName,
    value: "",
    expires: new Date(0), // 過去の日付で期限切れに
    path: "/",
    // Secure属性をプロダクション環境では常に設定
    secure: process.env.NODE_ENV === "production",
    // HttpOnly属性を設定してJavaScriptからのアクセスを防止
    httpOnly: true,
    // 同一サイトポリシーを設定
    sameSite: "lax",
  });
  return res;
}

/**
 * Ko-fi状態の再確認が必要かどうか
 */
export function shouldCheckKofiStatus(session: SessionData): boolean {
  if (!session.lastKofiCheck) return true;

  const now = Date.now();
  return now - session.lastKofiCheck > sessionOptions.kofiCheckInterval;
}
