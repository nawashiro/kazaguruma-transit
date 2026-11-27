# Tasks

## 1. 徒歩距離の同ノード補正

- [ ] 1.1 `src/lib/transit/__tests__/walk-network.test.ts` の「同じノードに接続しても徒歩距離は両端の接続区間を含む」を、同じノードへ接続するときは2点間の直線距離になる期待へ書き換え、失敗を確認する
- [ ] 1.2 `src/lib/transit/walk-network.ts` の `walkLeg` で、`prepared.snap.node` と到着点の最寄りノードが同じときはハバーサイン距離を返すよう変え、`npm run test:unit -- walk-network` が通ることを確認する
- [ ] 1.3 停留所自身の座標から同じ停留所までの徒歩距離が0.1km未満になることを `src/lib/transit/__tests__/walk-network.test.ts` に足し、通過を確認する
- [ ] 1.4 `npm run test:unit -- stop-candidate-selection stop-radius-listing transit-service-stops` を実行し、既存の停留所選択の期待が通ることを確認する。落ちた場合は期待値の根拠を書き直す

## 2. 選択規則

- [ ] 2.1 `src/lib/transit/__tests__/route-result-ranking.test.ts` を、到着・出発時刻と乗換回数を受け取る新しい比較へ書き換える。徒歩優先10分のコストで直通が勝つ場合、乗換が勝つ場合、はやさ優先で乗換が勝つ場合、到着時刻指定で反転する場合、同値時の順序をそれぞれ固定し、失敗を確認する
- [ ] 2.2 `src/lib/transit/route-result-ranking.ts` の `selectBestRouteCandidate` を、`{ prioritizeSpeed, isDeparture }` と各候補の到着・出発時刻・乗換回数を受け取る形へ変え、`npm run test:unit -- route-result-ranking` が通ることを確認する
- [ ] 2.3 `src/lib/transit/route-algorithm.ts` の `ROUTE_PARAMS` に `TRANSFER_PENALTY_MINUTES: 10` を足し、ほかのパラメータと同じ場所から読めることを確認する

## 3. 経路検索への適用

- [ ] 3.1 `src/lib/transit/__tests__/transit-service-stops.test.ts` に、同日同条件で `prioritizeSpeed` を切り替えると選択が変わることを固定するテストを足し、失敗を確認する
- [ ] 3.2 `src/lib/transit/transit-service.ts` の `findConventionalRoute` を、`routes[0]` ではなく全候補を `selectBestRouteCandidate` へ渡す形へ変え、3.1 のテストが通ることを確認する
- [ ] 3.3 `src/lib/transit/transit-service.ts` の `findRouteWithNearbyStops` の選択呼び出しを新しい引数へ合わせ、`npm run test:unit -- stop-candidate-selection` が通ることを確認する
- [ ] 3.4 `src/lib/transit/transit-service.ts` の `convertTimeTableRouteToJourney` に残る `distanceMeters: 0` の「後で修正」を、同一停留所の乗り継ぎだけを生成する現在の性質の記述へ変える
- [ ] 3.5 実データで、東日本銀行神田支店（35.6937055, 139.7729635）から千代田区役所（35.694005, 139.7533119）へ 2026-11-27T10:25 の徒歩優先で検索し、内神田ルートの直通が返り、10:29 の入力でも直通が返ることを確認する

## 4. 出発地と目的地の表示時刻

- [ ] 4.1 `src/components/features/__tests__/IntegratedRouteDisplay.test.tsx` の出発地・目的地の時刻期待を、徒歩時間だけを加減した値へ書き換え、失敗を確認する
- [ ] 4.2 `src/components/features/IntegratedRouteDisplay.tsx` の `walkMinutes` から `+ 5` を削除し、`npm run test:unit -- IntegratedRouteDisplay` が通ることを確認する

## 5. 統合確認

- [ ] 5.1 `npm test`、`npm run lint`、`npx tsc --noEmit` を通し、優先条件を切り替えた実検索の結果を手元で記録する
- [ ] 5.2 `npm run update-destinations` を実行し、`data/destinations.json` に差分が出ないことを確認する。差分が出た場合は、500メートル判定の境界をまたいだ地点を特定してから作り直す

## Workflow follow-up

- レビュー要件を満たしたあと、この変更をアーカイブする。
- アーカイブ結果を確認する。
