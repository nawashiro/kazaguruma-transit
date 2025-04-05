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
export function generateStaticMapWithDirectionsUrl(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  width: number = 600,
  height: number = 200
): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // 出発地と目的地
  const origin = `${startLat},${startLng}`;
  const destination = `${endLat},${endLng}`;

  // マーカーパラメータ (始点と終点にマーカーを表示、グレースケールに合わせた色)
  const markers = [
    `color:gray|label:S|${startLat},${startLng}`,
    `color:black|label:E|${endLat},${endLng}`,
  ];

  // URLを構築
  let urlString = "https://maps.googleapis.com/maps/api/staticmap";
  urlString += `?size=${width}x${height}`;

  // 経路を描画するパス（黒い線で表示）
  urlString += `&path=weight:5|color:0x000000|${origin}|${destination}`;

  // マーカーを追加
  markers.forEach((marker) => {
    urlString += `&markers=${encodeURIComponent(marker)}`;
  });

  // 徒歩モードを設定
  urlString += `&mode=walking`;

  // 地図をグレースケールにする
  urlString += `&style=feature:all|element:all|saturation:-100`;

  // APIキーとスケールを追加
  urlString += `&key=${apiKey || ""}`;
  urlString += `&scale=2`; // 高解像度画像のためのスケール

  return urlString;
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
export function generateStaticMapWithPolylineUrl(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  encodedPolyline: string,
  width: number = 600,
  height: number = 200
): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // マーカーパラメータ (始点と終点にマーカーを表示、グレースケールに合わせた色)
  const markers = [
    `color:gray|label:S|${startLat},${startLng}`,
    `color:black|label:E|${endLat},${endLng}`,
  ];

  // URLを構築
  let urlString = "https://maps.googleapis.com/maps/api/staticmap";
  urlString += `?size=${width}x${height}`;

  // ポリラインでパスを描画（黒い線で表示）
  urlString += `&path=weight:5|color:0x000000|enc:${encodeURIComponent(
    encodedPolyline
  )}`;

  // マーカーを追加
  markers.forEach((marker) => {
    urlString += `&markers=${encodeURIComponent(marker)}`;
  });

  // 地図をグレースケールにする
  urlString += `&style=feature:all|element:all|saturation:-100`;

  // APIキーとスケールを追加
  urlString += `&key=${apiKey || ""}`;
  urlString += `&scale=2`; // 高解像度画像のためのスケール

  return urlString;
}
