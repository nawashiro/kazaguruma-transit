/**
 * 2点間の経路を表示するGoogleマップリンクを生成する
 */
export function generateGoogleMapDirectionLink(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${endLat},${endLng}&travelmode=walking`;
}

/**
 * 単一地点を表示するGoogleマップリンクを生成する
 */
export function generateGoogleMapPointLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// サーバーコンポーネントをインポート
import { generateStaticMapUrl } from "../lib/maps/staticMap";
import { getDirectionsPolyline as getServerDirectionsPolyline } from "../lib/maps/directions";
import { logger } from "./logger";

/**
 * Google Maps Static APIで徒歩経路を表示するURLを生成する
 * サーバーコンポーネントを使用
 */
export async function generateStaticMapWithDirectionsUrl(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  width: number = 600,
  height: number = 200
): Promise<string> {
  try {
    // サーバーコンポーネントを使用して地図URLを取得
    const result = await generateStaticMapUrl(
      startLat,
      startLng,
      endLat,
      endLng,
      width,
      height,
      null,
      "monochrome"
    );

    if (!result.success || !result.url) {
      throw new Error(result.error || "Static map URL generation failed");
    }

    return result.url;
  } catch (error) {
    logger.error("Error fetching static map URL:", error);
    // フォールバック: 絶対URLのプレースホルダー画像を返す
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${baseUrl}/images/map_placeholder.png`;
  }
}

/**
 * サーバーコンポーネントを介してDirections APIのポリラインデータを取得する関数
 */
export async function getDirectionsPolyline(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<string | null> {
  try {
    // サーバーコンポーネントを使用してポリラインを取得
    const result = await getServerDirectionsPolyline(
      startLat,
      startLng,
      endLat,
      endLng
    );

    if (!result.success || !result.encodedPolyline) {
      throw new Error(result.error || "Directions API request failed");
    }

    return result.encodedPolyline;
  } catch (error) {
    logger.error("Error fetching directions:", error);
    return null;
  }
}

/**
 * ポリラインデータを含むStatic Map APIのURLを生成する
 * サーバーコンポーネントを使用
 */
export async function generateStaticMapWithPolylineUrl(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  encodedPolyline: string,
  width: number = 600,
  height: number = 200
): Promise<string> {
  try {
    // サーバーコンポーネントを使用して地図URLを取得
    const result = await generateStaticMapUrl(
      startLat,
      startLng,
      endLat,
      endLng,
      width,
      height,
      encodedPolyline,
      "monochrome"
    );

    if (!result.success || !result.url) {
      throw new Error(result.error || "Static map URL generation failed");
    }

    return result.url;
  } catch (error) {
    logger.error("Error fetching static map URL:", error);
    // フォールバック: 絶対URLのプレースホルダー画像を返す
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${baseUrl}/images/map_placeholder.png`;
  }
}
