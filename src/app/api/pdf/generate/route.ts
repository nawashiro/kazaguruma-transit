import { NextRequest, NextResponse } from "next/server";
import { appRouterRateLimitMiddleware } from "../../../../lib/api/rate-limit-middleware";
import { logger } from "../../../../utils/logger";
import puppeteer from "puppeteer";
import type { Browser, PDFOptions } from "puppeteer";
import { drawPrintMaps } from "../../../../lib/pdf/print-map";
import {
  collectPrintMapLegs,
  generateRouteHTML,
  type GeneratePdfRequest,
} from "../../../../lib/pdf/route-html";

interface PdfGenerationError {
  message: string;
  code?: string;
}

export async function POST(req: NextRequest) {
  let browser: Browser | null = null;

  try {
    // レート制限を適用
    const limitResponse = await appRouterRateLimitMiddleware(req);
    if (limitResponse) {
      return limitResponse;
    }

    logger.log("PDF生成API開始");

    // リクエストボディを取得
    let requestData: GeneratePdfRequest;
    try {
      requestData = await req.json();
      logger.log("リクエストJSONパース成功");
    } catch (error) {
      logger.error("リクエストJSONのパースエラー:", error);
      return NextResponse.json(
        { success: false, error: "無効なリクエスト形式です" },
        { status: 400 }
      );
    }

    // PDFレンダリングに必要なすべてのデータがあるか確認
    if (
      !requestData.originStop ||
      !requestData.destinationStop ||
      !requestData.routes
    ) {
      logger.log("必須データ不足:", {
        hasOriginStop: !!requestData.originStop,
        hasDestinationStop: !!requestData.destinationStop,
        hasRoutes: !!requestData.routes,
      });
      return NextResponse.json(
        { success: false, error: "必要なデータが不足しています" },
        { status: 400 }
      );
    }

    // PDFをレンダリングするHTMLを構築
    logger.log("HTML生成開始");
    const html = await generateRouteHTML(requestData);
    logger.log("HTML生成完了");

    // Puppeteerを使用してHTMLからPDFを生成
    logger.log("Puppeteer起動開始");
    try {
      // ブラウザを起動
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        timeout: 120000, // 2分のタイムアウト
      });
      logger.log("Puppeteer起動成功");

      // 新しいページを作成
      logger.log("ページ作成開始");
      const page = await browser.newPage();
      logger.log("ページ作成成功");

      // ページのタイムアウト設定
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(60000);

      // HTMLコンテンツを設定
      logger.log("HTMLコンテンツ設定開始");
      await page.setContent(html, {
        waitUntil: "load",
        timeout: 60000,
      });
      // 本文のWebフォントを読み終えてから地図を描く。地図のタイル取得は
      // この待機に含めない（含めると地図の有無で待ち時間が変わる）。
      await page.waitForNetworkIdle({
        concurrency: 0,
        idleTime: 500,
        timeout: 60000,
      });
      logger.log("HTMLコンテンツ設定完了");

      // 地図を描く。1枚でも描けなければPDFは返さない。
      const mapResult = await drawPrintMaps(
        page,
        collectPrintMapLegs(requestData)
      );
      if (!mapResult.ok) {
        logger.error("地図の描画に失敗:", mapResult);
        await page.close();
        if (browser) {
          await browser.close();
          browser = null;
        }
        return NextResponse.json(
          {
            success: false,
            error:
              "地図を描画できなかったため、PDFを生成できませんでした。時間をおいて再度お試しください。",
          },
          { status: 500 }
        );
      }
      logger.log("地図の描画完了");

      // PDFオプションを設定
      logger.log("PDF生成開始");
      const pdfOptions: PDFOptions = {
        format: "a4",
        printBackground: true,
        margin: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm",
        },
      };

      // PDFを生成
      const pdfBuffer = await page.pdf(pdfOptions);
      logger.log(`PDF生成完了: バッファサイズ=${pdfBuffer.length}バイト`);

      // ブラウザとページをクローズ
      await page.close();
      if (browser) {
        logger.log("ブラウザ終了開始");
        await browser.close();
        browser = null;
        logger.log("ブラウザ終了完了");
      }

      // PDFバッファをクライアントに返す
      logger.log("PDF送信開始");
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(
            `route_${requestData.originStop.stopName}_to_${requestData.destinationStop.stopName}.pdf`
          )}"`,
          "Cache-Control": "no-cache",
        },
      });
    } catch (error: unknown) {
      const pdfError = error as PdfGenerationError;
      logger.error("PDF生成エラー:", pdfError.message);
      // 詳細エラー情報は送信せず、一般的なエラーメッセージのみ返す
      return NextResponse.json(
        {
          success: false,
          error: "PDF生成に失敗しました。時間をおいて再度お試しください。",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("PDF生成エラー:", error);

    // エラー情報はログにのみ記録し、クライアントには送信しない
    if (error instanceof Error) {
      logger.error("エラースタック:", error.stack);
    }

    // クライアントには詳細情報を送信しない
    return NextResponse.json(
      {
        success: false,
        error:
          "PDF生成中にエラーが発生しました。時間をおいて再度お試しください。",
      },
      { status: 500 }
    );
  } finally {
    // ブラウザのクリーンアップを確実に行う
    if (browser) {
      try {
        logger.log("finallyブロックでのブラウザ終了開始");
        await browser.close();
        logger.log("finallyブロックでのブラウザ終了完了");
      } catch (closeError) {
        logger.error("finallyブロックでのブラウザ終了エラー:", closeError);
      }
    }
  }
}
