import { NextResponse, NextRequest } from "next/server";
import { TransitService } from "@/lib/transit/transit-service";
import { TransitQuery, TransitResponse } from "@/types/core";
import { appRouterRateLimitMiddleware } from "../../../lib/api/rate-limit-middleware";
import { logger } from "../../../utils/logger";
import { parseRouteSearchParams } from "@/lib/transit/route-search-query";

async function processTransitQuery(
  query: TransitQuery,
): Promise<NextResponse> {
  const transitService = TransitService.getInstance();
  const result: TransitResponse = await transitService.process(query);
  return NextResponse.json(result);
}

function createErrorResponse(error: unknown, status = 500): NextResponse {
  logger.error("トランジットAPIエラー:", error);
  return NextResponse.json(
    {
      success: false,
      error:
        error instanceof Error ? error.message : "サーバーエラーが発生しました",
    } as TransitResponse,
    { status },
  );
}

/** URIパラメータで表現された経路条件を検索する。 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const limitResponse = await appRouterRateLimitMiddleware(request);
    if (limitResponse) return limitResponse;

    if (request.nextUrl.searchParams.get("type") !== "route") {
      return createErrorResponse(new Error("検索条件が正しくありません。"), 400);
    }

    const parsed = parseRouteSearchParams(request.nextUrl.searchParams);
    if (!parsed.isValid) {
      return createErrorResponse(new Error(parsed.error), 400);
    }

    return processTransitQuery({ type: "route", ...parsed.query });
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * 統合トランジットAPIエンドポイント
 * POST: /api/transit
 * 単一のエンドポイントで複数の機能を提供
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const limitResponse = await appRouterRateLimitMiddleware(request);
    if (limitResponse) return limitResponse;

    const body: TransitQuery = await request.json();
    return processTransitQuery(body);
  } catch (error) {
    return createErrorResponse(error);
  }
}
