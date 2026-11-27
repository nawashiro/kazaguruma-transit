# Proposal

## Why

経路検索の徒歩評価は、直線距離に碁盤目街路の最悪補正係数√2を掛けた値で行っている。千代田区のOSM抽出から作った徒歩ネットワーク（28,105ノード・34,650エッジ）で測ると、実際の徒歩距離は直線距離の1.24倍（中央値）、1.64倍（90パーセンタイル）、2.72倍（99パーセンタイル）になる。√2は中央値より大きく、右裾より小さい。つまり過大評価と過小評価が同時に起きていて、最寄り停留所は約30%の地点で変わり、上位5候補の顔ぶれは約51%の地点で変わる。

あわせて、印刷用PDFの地図は出発地と停留所を結ぶ直線の破線を描いている。PDF生成の要求には徒歩区間の折れ線を受け取る項目があるが、渡す経路が存在しないため使われていない。Issue [#159](https://github.com/nawashiro/kazaguruma-transit/issues/159)。

## What Changes

- OSM抽出から歩行ネットワークをビルド時に生成し、`data/walk-network.json` としてリポジトリに置く。更新は `npm run update-walk-network` で行い、OSM抽出のキャッシュは地点索引と共用する。
- 徒歩距離を、点からネットワークへの接続区間とネットワーク上の最短距離の和に置き換える。√2補正を廃止する。
- **BREAKING**（検索結果）: 500メートル判定、最寄り停留所、徒歩時間、経路の順位が変わる。目的地目録の候補も同じ判定を使うため、`data/destinations.json` を作り直す。
- 経路検索の結果に徒歩区間の折れ線を持たせ、PDF生成へ渡す。折れ線があるときは地図に実線を引き、破線は折れ線がないときだけ使う。
- ネットワークを読み込めないときは経路検索をエラーにする。直線距離へ黙って落とすフォールバックは作らない。
- 段差・勾配の警告、結果画面の外部地図リンクは変更しない。

## Capabilities

### New Capabilities

- `walk-network`: 徒歩ネットワークartifactの形式・出典・更新、徒歩距離の定義（接続区間を含む）、ネットワークの対象範囲、読み込み失敗時の挙動、経路結果とPDFへの折れ線の受け渡し。

### Modified Capabilities

- `stop-candidate-selection`: 乗降候補の徒歩距離上限を、√2補正の直線距離からネットワーク距離へ改める。
- `stop-radius-listing`: 最寄り停留所の選択を、直線距離からネットワーク距離へ改める。半径一覧は直線距離のまま残し、差を明記する。
- `destination-catalog`: 目録の徒歩圏判定を、√2補正からネットワーク距離へ改める。
- `printed-route-map`: 折れ線を実線で描き、破線は折れ線がないときの代替に限る。

## Impact

- `scripts/update-walk-network.ts`、`scripts/lib/walk-network-build.ts`、`scripts/lib/osm-walk-extract.ts`（新規）、`data/walk-network.json`（新規。約2MB、1行1要素で差分を読める形にする）。
- `src/lib/transit/walk-network.ts`（新規）: artifactの読み込み、隣接リストの構築、探索、折れ線の復元。プロセス内に1度だけ構築する。
- `src/lib/transit/stop-selection.ts`、`src/lib/transit/walking.ts`、`src/lib/transit/transit-service.ts`、`src/lib/transit/route-result-model.ts`: 距離の取得元を差し替える。`calculateGridWalkingDistanceKm` を削除する。
- `scripts/update-destinations.ts`、`data/destinations.json`: 徒歩圏判定を追随させ、目録を作り直す。
- `src/components/features/RoutePdfExport.tsx`、`src/lib/pdf/route-html.ts`: 経路結果の折れ線を `walkPaths` へ渡す。描画側の型は既存のままでよい。
- `package.json`: `update-walk-network` を追加する。依存の追加はない（`osm-pbf-parser` は既存）。
- ドキュメント: 徒歩ネットワークの更新手順を `docs/how-to/` に置く。ライセンスページのOSM説明に、ネットワークの出典と加工を追記する。
- テスト: 徒歩距離の算出、接続区間、境界値、探索の結果、artifactの検証、PDFの折れ線契約を追加する。既存の√2を前提にしたテストを書き換える。
