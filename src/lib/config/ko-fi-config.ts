/**
 * Ko-fiユーザー名から公式ウィジェットの埋め込みURLを作る。
 */
export function buildKoFiWidgetUrl(username: string): string {
  return `https://ko-fi.com/${encodeURIComponent(username)}/?hidefeed=true&widget=true&embed=true&preview=true`;
}

/**
 * Ko-fiユーザー名から支援ページのURLを作る。
 */
export function buildKoFiPageUrl(username: string): string {
  return `https://ko-fi.com/${encodeURIComponent(username)}/`;
}
