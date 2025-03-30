import { NextResponse, NextRequest } from "next/server";
import { TransitService } from "@/lib/transit/transit-service";
import { TransitQuery, TransitResponse } from "@/types/transit-api";

/**
 * 統合トランジットAPIエンドポイント
 * POST: /api/transit
 * 単一のエンドポイントで複数の機能を提供
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: TransitQuery = await request.json();
    const transitService = TransitService.getInstance();

    const result: TransitResponse = await transitService.process(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("トランジットAPIエラー:", error);
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

/**
 * GET: /api/transit
 * 後方互換性のために残しておくが、将来的には廃止
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: "GET APIは非推奨です。POST /api/transitを使用してください。",
    } as TransitResponse,
    { status: 400 }
  );
}
