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
