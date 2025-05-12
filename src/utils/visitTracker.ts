/**
 * 訪問管理機能
 * ユーザーの訪問回数を記録し、初回訪問かどうかを判定するためのユーティリティ関数
 */

/**
 * 初回訪問かどうかを判定する
 * ローカルストレージに訪問回数を記録し、訪問回数をインクリメントする
 * @returns {boolean} 初回訪問の場合はtrue、そうでない場合はfalse
 */
export const isFirstVisit = (): boolean => {
  // SSRの場合は常にfalseを返す
  if (typeof window === "undefined") return false;

  const visitCount = localStorage.getItem("visitCount");
  if (!visitCount) {
    localStorage.setItem("visitCount", "1");
    return true;
  }

  const count = parseInt(visitCount, 10);
  localStorage.setItem("visitCount", (count + 1).toString());
  return false;
};

/**
 * 初回訪問をリセットする（テスト用）
 */
export const resetVisitCount = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("visitCount");
};

/**
 * 訪問回数を取得する
 * @returns {number} 訪問回数
 */
export const getVisitCount = (): number => {
  if (typeof window === "undefined") return 0;

  const visitCount = localStorage.getItem("visitCount");
  return visitCount ? parseInt(visitCount, 10) : 0;
};
