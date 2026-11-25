# Tasks

## 1. 徒歩ネットワークartifact

- [x] 1.1 `scripts/lib/osm-walk-extract.ts` に、PBFの走査、歩行対象のwayの選別（`footway`・`pedestrian`・`path`・`steps`・`living_street`・`residential`・`service`・`unclassified`・`tertiary`・`secondary`・`primary`・`track`・`corridor`・`crossing`。`foot=no`・`access=no`・`access=private`・`construction`・`area=yes` は除外）、町字ポリゴンと停留所300mによる対象範囲、最大連結成分の抽出、エッジの重複除去を実装し、`scripts/__tests__/osm-walk-extract.test.ts` で対象範囲と連結成分の選別を固定する
- [x] 1.2 `scripts/lib/walk-network-build.ts` に、ノードとエッジの整列、`[osmNodeId, lat×10^6, lng×10^6]` と `[a, b]` への変換、1行1要素の直列化、内容が同じときの書き換え抑止を実装し、`scripts/__tests__/walk-network-build.test.ts` で同じ入力から同じ出力になることを固定する
- [x] 1.3 `scripts/update-walk-network.ts` と `npm run update-walk-network` を追加し、地点索引と同じ `data/.cache/JP-13-latest.osm.pbf` と `GEOCODE_OSM_PBF` を使う。`scripts/__tests__/update-walk-network.cli.test.ts` で書き換えの有無と報告を固定する
- [x] 1.4 `data/walk-network.json` を生成し、`node -e` でノード数・エッジ数・最大成分の割合を確認する。停留所79件すべてが最大成分に乗り、artifactが約2MBに収まることを確かめる

## 2. 徒歩距離の算出

- [x] 2.1 `src/lib/transit/walk-network.ts` に、artifactの読み込み、CSRへの構築、グリッド索引によるスナップ、ダイクストラ、折れ線の復元を実装し、`src/lib/transit/__tests__/walk-network.test.ts` で距離と折れ線を固定する
- [x] 2.2 `src/lib/transit/walk-network.ts` に、読み込み失敗と形式不正を失敗として返す経路を実装し、`src/lib/transit/__tests__/walk-network.test.ts` でファイル不在・JSON不正・必須配列の欠落を固定する
- [x] 2.3 徒歩距離を「起点からノードまで＋ネットワーク上＋ノードから到着点まで」で返す関数を `src/lib/transit/walk-network.ts` に実装し、向きを入れ替えても同じ値になること、500mちょうどの扱い、接続区間の加算を `src/lib/transit/__tests__/walk-network.test.ts` で固定する
- [x] 2.4 `src/lib/transit/walking.ts` から `calculateGridWalkingDistanceKm` を削除し、`calculateWalkingTimeMinutes` を距離をそのまま速度で割る形へ変える。`src/lib/transit/__tests__/walking.test.ts` を新しい定義へ書き換える

## 3. 経路検索への適用

- [x] 3.1 `src/lib/transit/stop-selection.ts` の `selectNearbyStops` を徒歩ネットワークの距離で絞り込む形へ変え、`src/lib/transit/__tests__/stop-selection.test.ts` と `src/lib/transit/__tests__/stop-radius-listing.test.ts` で、候補の採否と半径一覧が直線距離のままであることを固定する
- [x] 3.2 `src/lib/transit/transit-service.ts` の最寄り停留所の選択、従来経路の上限判定、周辺バス停経路の徒歩距離を新しい関数へ差し替え、`src/lib/transit/__tests__/stop-candidate-selection.test.ts` と `src/lib/transit/__tests__/transit-service-stops.test.ts` を新しい定義へ書き換える
- [x] 3.3 `NearbyStop.distance` を直線距離のまま残し、経路結果の停留所に `walkingTimeMinutes` を足す。`src/types/core.ts` と `src/lib/transit/route-result-model.ts` を変え、`src/components/features/__tests__/RouteSearchResults.test.tsx` で徒歩時間が停留所の距離と一致することを固定する
- [x] 3.4 `src/components/features/IntegratedRouteDisplay.tsx` の徒歩時間を `walkingTimeMinutes` から取る形へ変え、`src/components/features/__tests__/IntegratedRouteDisplay.test.tsx` で表示時刻の契約を固定する

## 4. 折れ線とPDF

- [x] 4.1 `src/types/core.ts` の `Journey` に `originWalkPath` と `destinationWalkPath` を足し、`src/lib/transit/transit-service.ts` が探索結果から折れ線を載せる。`src/lib/transit/__tests__/route-algorithm.test.ts` か新設の契約テストで、折れ線の始点と終点が経路の端点と一致することを固定する
- [x] 4.2 `src/lib/transit/route-result-model.ts` と `src/components/features/RouteResultActions.tsx`、`src/components/features/RoutePdfExport.tsx` で折れ線をPDF生成の要求まで運び、`src/app/api/__tests__/pdf-route-contract.test.ts` で `walkPaths` が要求に含まれることを固定する
- [x] 4.3 `src/lib/pdf/print-map.ts` の線種を、折れ線があるとき実線、ないとき破線へ変え、`src/app/api/__tests__/pdf-print-map-html.test.ts` で線種の分岐を固定する

## 5. 目的地目録と出典

- [x] 5.1 `scripts/update-destinations.ts` の徒歩圏判定を新しい関数へ差し替え、`scripts/__tests__/update-destinations.test.ts` を新しい定義へ書き換える
- [x] 5.2 `npm run update-destinations` を実行して `data/destinations.json` を作り直し、差分に現れた入れ替わりを確認する
- [x] 5.3 `docs/how-to/update-walk-network.md` を追加し、手順どおりにコマンドを実行して artifact が再生成されることを確かめる。`README.md` のhow-to一覧と `docs/how-to/update-geocode-index.md` のキャッシュの記述を追随させる
- [x] 5.4 `src/lib/license/openDataLicenses.json` のOSM説明へ徒歩ネットワークの出典と加工を追記し、`/license` の表示を目視で確認する

## 6. 統合確認

- [x] 6.1 `npm run update-walk-network`、`npm test`、`npm run lint`、`npm run build` を通し、徒歩ネットワークを読めない状態で経路検索がエラーを返すことを手元で確かめる
- [x] 6.2 代表的な地点（区役所、神保町、新日本橋駅周辺）で経路検索を行い、徒歩時間・使用停留所・PDFの地図の線が新しい定義で表示されることを確かめる

## Workflow follow-up

- レビュー要件を満たしたあと、この変更をアーカイブする。
- アーカイブ結果を確認する。
