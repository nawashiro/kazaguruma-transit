# Tasks

## 1. 折れ線を道の上のノード列にする

- [x] 1.1 `src/lib/transit/__tests__/walk-network.test.ts` に、折れ線の先頭と末尾がノードの座標になり地点そのものを含まないことを確かめるテストを足し、失敗することを確認する
- [x] 1.2 2地点が同じノードに接続するときは折れ線が1点になること、徒歩距離が変わらないことを確かめるテストを足し、失敗することを確認する
- [x] 1.3 `walkLeg` の折れ線から起点と到着点の座標を落とし、1.1 と 1.2 のテストが通ることを確認する
- [x] 1.4 `src/lib/transit/__tests__/walk-network.test.ts` の既存の折れ線の期待値を新しい並びへ直し、`npm run test:unit -- walk-network` が通ることを確認する

## 2. 地図の線と表示範囲

- [x] 2.1 `src/lib/pdf/__tests__/print-map.test.ts` に、折れ線が2点未満なら線を引かないこと、表示範囲が折れ線と両方の地点を含むこと、範囲が最小の広がり200メートルを下回らないことを確かめるテストを足し、失敗することを確認する
- [x] 2.2 `printMapBounds` を折れ線と両端の地点の合成から範囲を求め、中心を保って最低200メートル四方へ広げる形に変え、2.1 のテストが通ることを確認する
- [x] 2.3 `src/lib/pdf/print-map.ts` から `PRINT_MAP_FALLBACK_LINE_PAINT` と `followsWalkNetwork` を削除し、折れ線が2点未満のときは source と line レイヤーを足さない描画に変え、破線の指定が残っていないことを確かめるテストが通ることを確認する
- [x] 2.4 `src/lib/pdf/print-map.ts` と `src/lib/pdf/route-html.ts` の、削除した指定や破線に触れるコメントを実装に合わせて整理し、`npx tsc --noEmit` が通ることを確認する

## 3. PDFの契約

- [x] 3.1 `src/app/api/__tests__/pdf-route-contract.test.ts` を、折れ線を渡さない場合に線を描かない期待へ直し、テストが通ることを確認する
- [x] 3.2 `src/app/api/__tests__/pdf-print-map-html.test.ts` を、折れ線が1点だけのときも地図とマーカーが残る期待へ直し、テストが通ることを確認する
- [x] 3.3 麹町出張所を目的地、麹町出張所停留所を乗車停留所にした要求で `collectPrintMapLegs` から地図の折れ線を取り、降車側の折れ線が1点で往復しないことをテストで固定する

## 4. 地点マーカーのアイコン

- [x] 4.1 `src/lib/pdf/__tests__/print-map.test.ts` に、停留所のマーカーがバスの図形、出発地と目的地のマーカーが地図ピンの図形を含み、地名の文字を含まないことを確かめるテストを足し、失敗することを確認する
- [x] 4.2 `lucide` を依存へ加え、`src/lib/pdf/print-map.ts` に図形データからSVGを組む関数を足して `Bus` / `MapPin` を描き、4.1 のテストが通ることを確認する
- [x] 4.3 停留所と地点でアイコンと塗りを切り替え、マーカーの文字を外し、`anchor` を `center` に変え、地図の要素の読み上げ名に両端の地名を含める。4.1 のテストと `pdf-print-map-html.test.ts` の読み上げ名の期待が通ることを確認する
- [x] 4.4 `npx tsc --noEmit` と `npm run lint` を通し、`icon-library-contract.test.ts` が手書きSVGを検出しないことを確認する

## 5. 全体の確認

- [x] 5.1 `npm test` を通し、失敗が残っていないことを確認する
- [x] 5.2 麹町出張所を目的地にしたPDFを実際に生成し、地図に往復の線がなく、バスとピンのマーカーが置かれていることを目で確かめる

## Workflow follow-up

- 必要な確認が済んだあと、変更をアーカイブする。
- アーカイブ後に `openspec/specs/printed-route-map/spec.md` と `openspec/specs/walk-network/spec.md` が新しい要求を反映していることを確かめる。
