import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "../../../../lib/auth/session";
import { logger } from "../../../../utils/logger";
import puppeteer from "puppeteer";
import type { Browser, PDFOptions } from "puppeteer";
import {
  Client,
  TravelMode,
  Language,
} from "@googlemaps/google-maps-services-js";

interface GeneratePdfRequest {
  originStop: {
    stopId: string;
    stopName: string;
    distance: number;
    stop_lat?: number;
    stop_lon?: number;
    lat?: number;
    lng?: number;
  };
  destinationStop: {
    stopId: string;
    stopName: string;
    distance: number;
    stop_lat?: number;
    stop_lon?: number;
    lat?: number;
    lng?: number;
  };
  routes: Array<{
    routeId: string;
    routeName: string;
    routeShortName: string;
    routeLongName: string;
    routeColor: string;
    routeTextColor: string;
    departureTime?: string;
    arrivalTime?: string;
    stopCount?: number;
    transfers?: Array<{
      transferStop: {
        stopId: string;
        stopName: string;
        stopLat: number;
        stopLon: number;
      };
      nextRoute: any;
    }>;
  }>;
  type: "direct" | "transfer" | "none";
  transfers: number;
  departures?: Array<any>;
  message?: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  selectedDateTime?: string;
}

interface PdfGenerationError {
  message: string;
  code?: string;
}

export async function POST(req: NextRequest) {
  let browser: Browser | null = null;

  try {
    logger.log("PDF生成API開始");

    // セッションから認証・支援者情報を取得
    const session = await getSessionData(req);
    const isLoggedIn = session.isLoggedIn;
    const isSupporter = session.isSupporter || false;

    logger.log(`認証情報: ログイン=${isLoggedIn}, サポーター=${isSupporter}`);

    // 権限チェック
    if (!isLoggedIn || !isSupporter) {
      logger.log("権限エラー: サポーター権限なし");
      return NextResponse.json(
        { success: false, error: "この機能を使用する権限がありません" },
        { status: 403 }
      );
    }

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
        waitUntil: "networkidle0",
        timeout: 60000,
      });
      logger.log("HTMLコンテンツ設定完了");

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
      return new NextResponse(pdfBuffer, {
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

// PDFレンダリング用のHTMLを生成する関数
async function generateRouteHTML(data: GeneratePdfRequest): Promise<string> {
  // 現在の日付を取得
  const today = new Date();

  // 選択された日時から日付を取得、選択がなければ現在の日付を使用
  const dateToUse = data.selectedDateTime
    ? new Date(data.selectedDateTime)
    : today;

  // 曜日の配列（日本語）
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const weekday = weekdays[dateToUse.getDay()];

  // 日付のフォーマット（曜日付き）
  const formattedDate = `${dateToUse.getFullYear()}年${
    dateToUse.getMonth() + 1
  }月${dateToUse.getDate()}日(${weekday})`;

  // 出発時刻を取得する関数
  const getDepartureTime = (stopId: string, routeId?: string) => {
    return (
      data.routes.find((r) => r.routeId === routeId)?.departureTime ||
      "時刻不明"
    );
  };

  // 到着時刻を計算する関数
  const getArrivalTime = (
    departureTime: string | undefined,
    durationMinutes: number = 30
  ) => {
    if (!departureTime || departureTime === "時刻不明") return "時刻不明";

    try {
      const [hours, minutes] = departureTime.split(":").map(Number);
      let arrivalMinutes = minutes + durationMinutes;
      let arrivalHours = hours + Math.floor(arrivalMinutes / 60);
      arrivalMinutes = arrivalMinutes % 60;

      // 24時間表記に調整
      arrivalHours = arrivalHours % 24;

      return `${arrivalHours.toString().padStart(2, "0")}:${arrivalMinutes
        .toString()
        .padStart(2, "0")}`;
    } catch {
      return "時刻不明";
    }
  };

  // 時刻表示用のフォーマッター
  const formatTimeDisplay = (time: string) => {
    if (time === "時刻不明") return time;
    const match = time.match(/^(\d{2}:\d{2}):\d{2}$/);
    return match ? match[1] : time;
  };

  // ベースURLの設定 - PDFレンダリング時に使用される公開URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const qrCodeUrl = `${baseUrl}/images/chiyoda_line_qr.png`;
  const mapPlaceholderUrl = `${baseUrl}/images/map_placeholder.png`;

  // 画像の存在確認関数
  const checkImageExists = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  };

  // 画像URLを取得する関数
  const getImageUrl = async (
    url: string,
    fallbackUrl: string
  ): Promise<string> => {
    const exists = await checkImageExists(url);
    return exists ? url : fallbackUrl;
  };

  // 画像URLを取得
  const finalQrCodeUrl = await getImageUrl(qrCodeUrl, mapPlaceholderUrl);

  // ルートがない場合の表示
  if (data.type === "none") {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>乗換案内</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Noto Sans JP', sans-serif; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            .text-center { text-align: center; }
            .space-y-4 > * + * { margin-top: 1rem; }
            .text-lg { font-size: 1.125rem; }
            .text-xl { font-size: 1.25rem; }
            .font-bold { font-weight: bold; }
            .text-xs { font-size: 0.75rem; }
            .mx-auto { margin-left: auto; margin-right: auto; }
            .w-24 { width: 6rem; height: 6rem; }
          </style>
        </head>
        <body>
          <div class="container space-y-4">
            <div class="text-center">
              <p class="text-lg">${formattedDate}</p>
            </div>
            <div class="text-center space-y-4">
              <h3 class="text-xl font-bold">ルートが見つかりません</h3>
              <p>この2つの地点を結ぶルートが見つかりませんでした</p>
              <p>別の交通手段をご検討ください</p>
            </div>
            <div class="text-center text-xs space-y-2">
              <img src="${finalQrCodeUrl}" alt="千代田区公式LINE" class="w-24 mx-auto"
                onerror="this.onerror=null; this.src='${mapPlaceholderUrl}';">
              <p>千代田区公式LINEで最新の運行情報を確認できます</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // メインのルート情報表示HTML
  let routesHtml = "";

  // DirectionsAPI用のポリラインを取得する関数を追加
  const fetchDirectionsPolyline = async (
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number
  ) => {
    try {
      // サーバーサイドでの直接APIコール
      const client = new Client({});
      const response = await client.directions({
        params: {
          origin: `${startLat},${startLng}`,
          destination: `${endLat},${endLng}`,
          mode: TravelMode.walking,
          key:
            process.env.GOOGLE_MAPS_API_KEY ||
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
            "",
          language: Language.ja,
          region: "jp",
        },
        timeout: 5000, // 5秒タイムアウト
      });

      if (response.data.status === "OK" && response.data.routes.length > 0) {
        return response.data.routes[0].overview_polyline.points;
      }
      return null;
    } catch (error) {
      logger.error("経路ポリライン取得エラー:", error);
      return null;
    }
  };

  // 地図URLをポリラインを使って生成する関数
  const getDirectionsMapUrlWithPolyline = async (
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    width: number,
    height: number
  ) => {
    const polyline = await fetchDirectionsPolyline(
      startLat,
      startLng,
      endLat,
      endLng
    );
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

    // 基本的なURL構築
    let url = `https://maps.googleapis.com/maps/api/staticmap?size=${width}x${height}`;
    url += `&markers=color:gray|label:S|${startLat},${startLng}`;
    url += `&markers=color:black|label:E|${endLat},${endLng}`;

    // ポリラインがある場合は使用、なければ直線を使用
    if (polyline) {
      url += `&path=weight:5|color:0x000000|enc:${encodeURIComponent(
        polyline
      )}`;
    } else {
      url += `&path=weight:5|color:0x000000|${startLat},${startLng}|${endLat},${endLng}`;
    }

    // モノクロスタイルを適用
    url += `&style=feature:all|element:geometry|saturation:-100|lightness:20`;
    url += `&style=feature:all|element:labels|visibility:on|saturation:-100`;
    url += `&style=feature:road|element:all|saturation:-100|lightness:40`;
    url += `&style=feature:water|element:all|saturation:-100|lightness:-10`;

    url += `&key=${apiKey}`;
    url += `&scale=2`; // 高解像度画像のためのスケール
    return url;
  };

  data.routes.forEach((route) => {
    // 各ルートの時刻を計算
    const departureTime =
      route.departureTime ||
      getDepartureTime(data.originStop.stopId, route.routeId || "");
    const firstSegmentDuration = data.type === "direct" ? 45 : 30;
    const arrivalTime =
      route.arrivalTime || getArrivalTime(departureTime, firstSegmentDuration);

    const hasTransfers = route.transfers && route.transfers.length > 0;
    const destinationName =
      hasTransfers && route.transfers?.[0]
        ? route.transfers[0].transferStop.stopName
        : data.destinationStop.stopName;

    // 最初のセグメント
    routesHtml += `
      <div class="card bg-white p-4 border-left-4 my-4" style="border-left: 4px solid #ccc;">
        <div class="flex justify-between items-center mb-2">
          <div class="text-lg font-bold">${data.originStop.stopName}</div>
          <div class="badge" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
            ${formatTimeDisplay(departureTime)}
          </div>
        </div>
        
        <div class="flex items-center my-3">
          <div class="badge mr-2" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
            ${route.routeName}
          </div>
        </div>
        
        <div class="flex justify-between items-center">
          <div class="text-lg font-bold">${destinationName}</div>
          <div class="badge" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
            ${formatTimeDisplay(arrivalTime)}
          </div>
        </div>
      </div>
    `;

    // 乗換情報（ある場合）
    if (hasTransfers && route.transfers) {
      routesHtml += `
        <div class="text-center my-4">
          <div style="display: inline-block; background-color: #f3f4f6; padding: 0.5rem 1rem; border-radius: 9999px; font-weight: bold; color: #4b5563; border: 1px solid #d1d5db; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
            ここで乗り換え
          </div>
        </div>
      `;

      route.transfers.forEach((transfer) => {
        // 乗換後の時刻を計算
        const transferWaitTime = 15;
        const transferDepartureTime = getArrivalTime(
          arrivalTime,
          transferWaitTime
        );
        const finalArrivalTime = getArrivalTime(transferDepartureTime, 30);

        routesHtml += `
          <div class="card bg-white p-4 border-left-4 my-4" style="border-left: 4px solid #ccc;">
            <div class="flex justify-between items-center mb-2">
              <div class="text-lg font-bold">${
                transfer.transferStop.stopName
              }</div>
              <div class="badge" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
                ${formatTimeDisplay(
                  transfer.nextRoute.departureTime || transferDepartureTime
                )}
              </div>
            </div>
            
            <div class="flex items-center my-3">
              <div class="badge mr-2" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
                ${transfer.nextRoute.routeName}
              </div>
            </div>
            
            <div class="flex justify-between items-center">
              <div class="text-lg font-bold">${
                data.destinationStop.stopName
              }</div>
              <div class="badge" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
                ${formatTimeDisplay(
                  transfer.nextRoute.arrivalTime || finalArrivalTime
                )}
              </div>
            </div>
          </div>
        `;
      });
    }
  });

  // 出発地から停留所への地図
  let originToStopMapHtml = "";
  if (
    data.originLat &&
    data.originLng &&
    (data.originStop.stop_lat !== undefined ||
      data.originStop.lat !== undefined) &&
    (data.originStop.stop_lon !== undefined ||
      data.originStop.lng !== undefined)
  ) {
    // ポリラインを使用する関数を使用（awaitで待機）
    const mapUrl = await getDirectionsMapUrlWithPolyline(
      data.originLat,
      data.originLng,
      Number(data.originStop.stop_lat ?? data.originStop.lat ?? 0),
      Number(data.originStop.stop_lon ?? data.originStop.lng ?? 0),
      600,
      200
    );
    originToStopMapHtml = `
      <div class="map-container" style="max-width: 600px; margin: 0 auto; margin-bottom: 1rem;">
        <img
          src="${mapUrl}"
          alt="出発地から${data.originStop.stopName}までの経路"
          style="width: 100%; height: 200px; object-fit: cover; border-radius: 0.25rem; border: 1px solid #e5e7eb;"
        />
      </div>
    `;
  }

  // 停留所から目的地への地図
  let stopToDestMapHtml = "";
  if (
    data.destLat &&
    data.destLng &&
    (data.destinationStop.stop_lat !== undefined ||
      data.destinationStop.lat !== undefined) &&
    (data.destinationStop.stop_lon !== undefined ||
      data.destinationStop.lng !== undefined)
  ) {
    // ポリラインを使用する関数を使用（awaitで待機）
    const mapUrl = await getDirectionsMapUrlWithPolyline(
      Number(data.destinationStop.stop_lat ?? data.destinationStop.lat ?? 0),
      Number(data.destinationStop.stop_lon ?? data.destinationStop.lng ?? 0),
      data.destLat,
      data.destLng,
      600,
      200
    );
    stopToDestMapHtml = `
      <div class="map-container" style="max-width: 600px; margin: 0 auto; margin-top: 1rem;">
        <img
          src="${mapUrl}"
          alt="${data.destinationStop.stopName}から目的地までの経路"
          style="width: 100%; height: 200px; object-fit: cover; border-radius: 0.25rem; border: 1px solid #e5e7eb;"
        />
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>乗換案内</title>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Noto Sans JP', sans-serif; padding: 0; margin: 0; }
          .container { max-width: 800px; margin: 0 auto; padding: 0 24px; }
          .text-center { text-align: center; }
          .space-y-4 > * + * { margin-top: 1rem; }
          .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
          .text-lg { font-size: 1.125rem; }
          .text-xl { font-size: 1.25rem; }
          .font-bold { font-weight: bold; }
          .text-xs { font-size: 0.75rem; }
          .mx-auto { margin-left: auto; margin-right: auto; }
          .w-24 { width: 6rem; height: 6rem; }
          .flex { display: flex; }
          .items-center { align-items: center; }
          .justify-between { justify-content: space-between; }
          .mr-2 { margin-right: 0.5rem; }
          .mb-2 { margin-bottom: 0.5rem; }
          .ml-2 { margin-left: 0.5rem; }
          .my-3 { margin-top: 0.75rem; margin-bottom: 0.75rem; }
          .p-4 { padding: 1rem; }
          .card { background-color: #fff; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
          .badge { display: inline-block; }
          .p-3 { padding: 0.75rem; }
          .text-gray-500 { color: #6b7280; }
          .bg-white { background-color: white; }
        </style>
      </head>
      <body>
        <div class="container space-y-4 bg-white">
          <div class="text-center">
            <p class="text-lg">${formattedDate}</p>
          </div>
          
          ${originToStopMapHtml}
          
          ${routesHtml}
          
          ${stopToDestMapHtml}
          
        </div>
      </body>
    </html>
  `;
}
