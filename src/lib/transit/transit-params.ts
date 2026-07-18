/**
 * トランジットサービス共通パラメータ
 * 検索に関するパラメータを一元管理する
 */
export const TRANSIT_PARAMS = {
  // デフォルトの検索半径（メートル）
  DEFAULT_SEARCH_RADIUS: 500,

  // 歩行速度（時速キロメートル）
  // 高齢者の移動を想定して3km/hとする
  WALKING_SPEED_KM_H: 3,

  // 歩行時間計算のために分速に変換（km/分）
  get WALKING_SPEED_KM_MIN(): number {
    return this.WALKING_SPEED_KM_H / 60;
  },

  // 経路検索時のパラメータ
  ROUTE_SEARCH: {
    // 検索対象とするバス停の最大数
    MAX_ORIGIN_STOPS: 5,
    MAX_DEST_STOPS: 5,
  },
};
