# Tasks

## 1. 周辺バス停の絞り込み

- [ ] 1.1 RED: `findNearbyStops` が補正後徒歩距離で絞り込むことを検査するテストを書く。直線350mのバス停は採用し、直線360mのバス停は除外する。
- [ ] 1.2 GREEN: `findNearbyStops` の候補判定を `calculateGridWalkingDistanceKm` を通した距離で行う。
- [ ] 1.3 対象テストを実行し、GREENを確認する。

## 2. 従来経路の上限

- [ ] 2.1 RED: 出発地の最寄りバス停の補正徒歩距離が上限を超えるとき、`searchRoute` の従来経路が経路を返さないことを検査するテストを書く。
- [ ] 2.2 GREEN: `searchRoute` で出発地と目的地の最寄りバス停の補正徒歩距離を計算し、上限を超えたら経路なしを返す。
- [ ] 2.3 上限以内の従来経路が従来どおり検索されることを、1.1と2.1のテストで確認する。

## 3. 定数と仕上げ

- [ ] 3.1 `TRANSIT_PARAMS.DEFAULT_SEARCH_RADIUS` のコメントを「最悪徒歩距離の上限（メートル）」に更新する。
- [ ] 3.2 対象テスト全体とlintを実行し、GREENを確認する。

## 対象外

`getStopsWithinRadius` が最初の10件だけを取得する問題の修正は、別のchangeで行う。
