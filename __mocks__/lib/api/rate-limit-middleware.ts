import { NextRequest, NextResponse } from "next/server";
import { NextApiRequest, NextApiResponse } from "next";

/**
 * App Router用のレート制限ミドルウェア（モック版）
 */
export async function appRouterRateLimitMiddleware(
  req: NextRequest
): Promise<NextResponse | undefined> {
  // テスト用に常にundefinedを返す（レート制限なし）
  return undefined;
}

/**
 * API Routes用のレート制限ミドルウェア（モック版）
 */
export async function apiRateLimitMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  // テスト用に常に次のミドルウェアを呼び出す
  return next();
}

/**
 * API Routeのハンドラをラップしてレート制限を適用するユーティリティ（モック版）
 */
export function withRateLimit(handler: any) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    return handler(req, res);
  };
}
