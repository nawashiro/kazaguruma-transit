# Tasks

## 1. 距離の正本と定数

- [ ] 1.1 `src/lib/transit/transit-params.ts`で`DEFAULT_SEARCH_RADIUS`を`MAX_WALK_TO_STOP_METERS: 750`と`WARN_WALK_TO_STOP_METERS: 500`へ置き換える。`npx tsc --noEmit`が通ることを確認する。
- [ ] 1.2 `src/lib/transit/stop-access.ts`へ`measureWalkAccess`と`walkAccessLevel`を追加する。停留所の座標を種にした多点ダイクストラを1回だけ回し、候補の座標の最寄りノードから徒歩距離を引く。両端が同じノードのときは直線距離にする。
- [ ] 1.3 `src/lib/transit/__tests__/stop-access.test.ts`を追加する。距離が`walkLeg`の結果と一致する、同じノードのとき直線距離になる、750mちょうどは「遠い」、750mを1m超えると「遠すぎる」、`measureWalkAccess`が距離場を1回しか作らないことを確認する。
- [ ] 1.4 `src/lib/transit/stop-selection.ts`の既定半径を`MAX_WALK_TO_STOP_METERS / 1000`へ切り替え、`src/lib/transit/__tests__/stop-selection.test.ts`の500m前提の期待値を750mへ直す。あわせて、既存の`src/lib/transit/__tests__/stop-candidate-selection.test.ts`を確認し、`npm run test:unit -- stop-selection`が通ることを確かめる。

## 2. 経路検索

- [ ] 2.1 `src/lib/transit/transit-service.ts`の`findConventionalRoute`と`findRouteWithNearbyStops`を`MAX_WALK_TO_STOP_METERS`へ切り替える。`src/lib/transit/__tests__/transit-service-stops.test.ts`に、745mの停留所を採用し759mの停留所を除外するテストを追加し、通ることを確認する。
- [ ] 2.2 出発地または目的地の最寄り停留所が上限を超えたとき、その地点の徒歩距離を結果へ渡す。`searchRoute`の戻り値に`blockedBy`を加え、`src/lib/transit/__tests__/transit-service-stops.test.ts`で目的地939mのとき`blockedBy`が返ることを確認する。
- [ ] 2.3 `src/lib/transit/route-result-model.ts`の`RouteResultViewModel`へ`originWalkMeters`、`destinationWalkMeters`、`blockedBy`を加える。徒歩区間のメートルは停留所ごとの徒歩時間から逆算せず、経路検索が求めた値をそのまま渡す。`src/lib/transit/__tests__/route-result-model.test.ts`を追加し、区間ごとの徒歩メートルと`blockedBy`が引き継がれることを確認する。

## 3. 目的地目録

- [ ] 3.1 `src/lib/location/destination-catalog.ts`の`DestinationCatalogEntry`へ`walkToStopMeters`を足し、検証で0以上の整数であることを要求する。`src/lib/location/__tests__/destination-catalog.test.ts`を追加し、欄の欠落と負値を拒否するテストを通す。
- [ ] 3.2 `scripts/update-destinations.ts`で停留所を1回読み、`measureWalkAccess`の距離場を1度作って全recordを測る。候補の判定を750mへ広げ、測った距離をentryへ書く。`scripts/__tests__/update-destinations.test.ts`の500m前提の期待値を750mへ直し、535mのrecordが`walkToStopMeters: 535`で入ることを確認する。
- [ ] 3.3 `npm run update-destinations`を実行し、`data/destinations.json`を再生成する。科学技術館、北の丸公園、国立国会図書館、千鳥ヶ淵公園、千鳥ヶ淵戦没者墓苑の5件が増え、`walkToStopMeters`がそれぞれ535、573、554、590、621であることを確認する。
- [ ] 3.4 `scripts/generate-location-artifact.ts`で`routeDestinations`の各地点へ`walkMeters`を写す。`src/lib/location/location-artifact.ts`の検証に`walkMeters`を加え、`src/lib/location/__tests__/location-artifact.test.ts`で欄の欠落を拒否することを確認する。
- [ ] 3.5 `src/types/route-destinations.ts`の`RouteDestinationLocation`へ`walkMeters?: number`を加え、`src/app/page.tsx`の`isRouteDestinations`で省略可能な数値として受け入れる。`src/app/__tests__/page.test.tsx`が通ることを確認する。
- [ ] 3.6 `docs/how-to/update-destinations.md`の500mの記述を750mへ直し、`walkToStopMeters`が入ることを書く。徒歩ネットワークを更新したら目録も更新する手順を加え、記載どおりにコマンドを実行できることを確認する。
- [ ] 3.7 `npm run build`を実行し、場所artifactを再生成する。`routeDestinations`の各地点に`walkMeters`が入り、増える5件はどれも750m以下であり、`walkMeters`が科学技術館535、北の丸公園573、国立国会図書館554、千鳥ヶ淵公園590、千鳥ヶ淵戦没者墓苑621になることを確認する（公開グラフの座標で測った値）。5件は写真を持つため、`写真を取得できませんでした`の警告件数を記録する。
- [ ] 3.8 3.7の後に`npm run update-geocode-index`を実行する。索引は場所artifactを読むため、この順序を守る。5件はOSM名として既に索引にあるが、artifactの座標が加わり、名前と街区が同じなので座標が2点の平均へ変わる（科学技術館 35.691584,139.753084 → 35.691573,139.753082 など）。差分が座標の平均と種別の変化だけであり、名前の増減がないことを確認する。座標の変化で徒歩距離の帯が変わる名前を記録する（現在の索引座標で千鳥ヶ淵戦没者墓苑は478m、再生成後は654m）。OSM抽出（133MB）が24時間より古いと再取得に時間がかかる。徒歩ネットワークは停留所と町字ポリゴンから作り目録に依存しないため、再生成しない。
- [ ] 3.9 新しく候補になった5件のうち、ルートページの施設一覧に載せるものを選び、`includeInRouteForm`を`true`にする。新しい候補の初期値は仕様どおり`false`である。この選択は編集判断であり、選ばない限り施設一覧は36件のまま増えない。一方、場所一覧（`/locations`）は`includeInRouteForm`に関係なく候補を使うため、3.7の時点で86件から91件へ増える。載せるものを決めたら`npm run build`を再実行し、`routeDestinations`の件数が選んだ数だけ増えることを確認する。
- [ ] 3.10 5.2で作る施設一覧の警告表示を、実データで確かめる。3.9で1件も載せないと、施設一覧に500m超の項目が現れず警告を実画面で確認できない。載せない判断をした場合は、その理由と、警告の確認をテスト用のfixtureだけに頼ることをタスクの記録へ残す。
- [ ] 3.11 `docs/how-to/update-location-data.md`の件数（場所86件、経路フォームに掲載する目的地35件など）を再生成後の値へ直し、`routeDestinations`の地点が`walkMeters`を持つことを書く。3.7と3.9の後に数え直した値と一致することを確認する。

## 4. 地点検索

- [ ] 4.1 `src/app/api/geocode/route.ts`で、検索候補と逆引きの応答に`walkMeters`を加える。距離は`measureWalkAccess`で求め、徒歩ネットワークを読めないときは`walkMeters`を付けずに成功を返す。
- [ ] 4.2 `src/lib/location/geocoding-search.ts`の`GeocodeCandidate`へ`walkMeters?: number`を加え、`src/lib/location/__tests__/geocoding-search.test.ts`で欄の有無の両方を受け取れることを確認する。
- [ ] 4.3 `src/app/api/__tests__/geocode-route.test.ts`に、`科学技術館`の候補が`walkMeters`を持ち537mであること、徒歩ネットワークを読めないときに`walkMeters`なしで200を返すことを追加して通す。
- [ ] 4.4 `docs/how-to/update-geocode-index.md`に、地点検索の徒歩距離が実行時に徒歩ネットワークから求まることと、徒歩ネットワークが読めないときの応答を書く。

## 5. 入力画面

- [ ] 5.1 `src/components/features/LocationCandidates.tsx`で、各候補に徒歩距離と警告を表示する。500m超は「バス停から遠い」、750m超は「バス停から遠すぎ」を文字で示し、750m超の項目はbuttonにせず文章として残す。`src/components/features/__tests__/LocationCandidates.test.tsx`に、3段階の表示と750m超が操作対象にならないことを追加して通す。
- [ ] 5.2 `src/components/features/LocationSuggestions.tsx`で、施設一覧の各項目に`walkMeters`を表示し、500mを超えるときに「バス停から遠い」を付ける。目録の候補は750m以内に限られるため、選択を止める分岐は置かない。`src/components/features/__tests__/LocationSuggestions.test.tsx`に、535mの施設が警告付きで選べ、450mの施設が警告なしで選べることを追加して通す。
- [ ] 5.3 `src/components/features/LocationFieldset.tsx`で、確定済みの地点に徒歩距離と警告を示す。`src/components/features/__tests__/LocationFieldset.test.tsx`または既存の`DestinationSelector.test.tsx`に、URLで渡された963mの目的地が「バス停から遠すぎ」を示すことを追加して通す。
- [ ] 5.4 `src/components/features/HomeRouteForm.tsx`で、施設詳細から渡された目的地の距離を確定済みの表示へ渡す。`src/components/features/__tests__/HomeRouteForm.test.tsx`が通ることを確認する。

## 6. 結果画面

- [ ] 6.1 `src/components/features/IntegratedRouteDisplay.tsx`で、各「徒歩で移動(Googleマップ)」の直下に徒歩距離を表示し、500mを超える区間に「バス停から遠い」を付ける。`src/components/features/__tests__/IntegratedRouteDisplay.test.tsx`に、537mの区間が`(バス停から遠い) 537m`になり、120mの区間が警告なしの`120m`になることを追加して通す。
- [ ] 6.2 同じ画面で、`blockedBy`があるときに経路なしの固定文の代わりに、地点と徒歩距離を示す。`src/components/features/__tests__/IntegratedRouteDisplay.test.tsx`に、目的地939mのとき939mと地点名が出て「ルートが見つかりません」が出ないことを追加して通す。
- [ ] 6.3 `src/components/features/RouteSearchResults.tsx`から`blockedBy`を渡す。`src/components/features/__tests__/RouteSearchResults.test.tsx`が通ることを確認する。

## 7. 統合確認

- [ ] 7.1 `npm run test`で単体とサーバーの全テストが通ることを確認する。
- [ ] 7.2 `npx tsc --noEmit --incremental false`と`npm run lint`で、新しいエラーと警告が出ないことを確認する。
- [ ] 7.3 3.7・3.8・3.9の再生成を通した後に`npm run build`を実行し、`public/generated/location-data.json`の`routeDestinations`に`walkMeters`が残り、`data/destinations.json`の内容と件数が一致することを確認する。
- [ ] 7.4 開発サーバーで、科学技術館537mが「バス停から遠い」で選べ、皇居三の丸尚蔵館963mが「バス停から遠すぎ」で選べないことを確認する。ライトとダークの両方で、警告が色だけでなく文字でも読めることを確認する。

## Workflow follow-up

- プロジェクトのレビュー要件を満たした後、変更をアーカイブする。
- `docs/reference/releases/`に、750mへの拡大と選択不能になった地点の例（東京駅939m、帝国劇場1,776m）を記録する。
