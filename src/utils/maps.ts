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

/**
 * Google Maps Static APIで徒歩経路を表示するURLを生成する
 * @param startLat 開始地点の緯度
 * @param startLng 開始地点の経度
 * @param endLat 終了地点の緯度
 * @param endLng 終了地点の経度
 * @param width 画像の幅
 * @param height 画像の高さ
 * @returns 静的地図URL
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
    // サーバーサイドAPIを呼び出して地図URLを取得
    const response = await fetch(
      `/api/maps/static-map?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}&width=${width}&height=${height}&style=monochrome`
    );

    if (!response.ok) {
      throw new Error("Static map API request failed");
    }

    const data = await response.json();
    return data.url || "";
  } catch (error) {
    console.error("Error fetching static map URL:", error);
    // フォールバック: 空のプレースホルダー画像を返す
    return `/images/map_placeholder.png`;
  }
}

/**
 * サーバーサイドAPIを介してGoogle Maps Directions APIのポリラインデータを取得する関数
 * 注: この実装ではAPIキーの露出を防ぐため、サーバーサイドAPIエンドポイント(/api/directions)を使用しています
 */
export async function getDirectionsPolyline(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/directions?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}`
    );

    if (!response.ok) {
      throw new Error("Directions API request failed");
    }

    const data = await response.json();
    return data.encodedPolyline || null;
  } catch (error) {
    console.error("Error fetching directions:", error);
    return null;
  }
}

/**
 * ポリラインデータを含むStatic Map APIのURLを生成する
 * @param startLat 開始地点の緯度
 * @param startLng 開始地点の経度
 * @param endLat 終了地点の緯度
 * @param endLng 終了地点の経度
 * @param encodedPolyline エンコードされたポリライン文字列
 * @param width 画像の幅
 * @param height 画像の高さ
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
    // サーバーサイドAPIを呼び出して地図URLを取得
    const response = await fetch(
      `/api/maps/static-map?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}&polyline=${encodeURIComponent(
        encodedPolyline
      )}&width=${width}&height=${height}&style=monochrome`
    );

    if (!response.ok) {
      throw new Error("Static map API request failed");
    }

    const data = await response.json();
    return data.url || "";
  } catch (error) {
    console.error("Error fetching static map URL:", error);
    // フォールバック: 絶対URLのプレースホルダー画像を返す
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${baseUrl}/images/map_placeholder.png`;
  }
}
