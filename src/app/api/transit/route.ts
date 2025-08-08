import { NextResponse, NextRequest } from "next/server";
import { TransitService } from "@/lib/transit/transit-service";
import { TransitQuery, TransitResponse } from "@/types/core";
import { appRouterRateLimitMiddleware } from "../../../lib/api/rate-limit-middleware";
import { logger } from "../../../utils/logger";

/**
 * 統合トランジットAPIエンドポイント
 * POST: /api/transit
 * 単一のエンドポイントで複数の機能を提供
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // レート制限を適用
    const limitResponse = await appRouterRateLimitMiddleware(request);
    if (limitResponse) {
      return limitResponse;
    }

    const body: TransitQuery = await request.json();
    const transitService = TransitService.getInstance();

    const result: TransitResponse = await transitService.process(body);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("トランジットAPIエラー:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "サーバーエラーが発生しました",
      } as TransitResponse,
      { status: 500 }
    );
  }
}
