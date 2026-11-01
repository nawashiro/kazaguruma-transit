/**
 * トランジットサービス共通パラメータ
 * 検索に関するパラメータを一元管理する
 */
export const TRANSIT_PARAMS = {
  // 出発地・目的地から最悪の経路で歩ける距離の上限（メートル）。碁盤目補正後の徒歩距離で判定する。
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
