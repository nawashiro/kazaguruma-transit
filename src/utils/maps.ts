/**
 * Googleマップのリンクは、外部サービスを開くだけの遷移であり、
 * 地図データを取得・保存しない。
 */
export function generateGoogleMapDirectionLink(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${endLat},${endLng}&travelmode=walking`;
}

export function generateGoogleMapPointLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
