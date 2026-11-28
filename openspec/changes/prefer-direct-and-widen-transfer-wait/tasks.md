# Tasks

## 1. 乗換待ちの上限を60分へ広げる

- [x] 1.1 `src/lib/transit/__tests__/route-algorithm.test.ts` に、待ち16分以上・60分以内の乗り継ぎを候補にし、61分の乗り継ぎを候補にしないテストを先に書く。待ち上限の期待値を60分とする既存の「乗換1回のコストを10分として探索パラメータに置く」を置き換え、`npm run test:unit -- route-algorithm` が失敗することを確認する
- [x] 1.2 `ROUTE_PARAMS.MAX_TRANSFER_WAIT` を15から60へ変え、`npm run test:unit -- route-algorithm` が通ることを確認する

## 2. 徒歩優先の比較を直通優先と30分の閾値へ変える

- [x] 2.1 `src/lib/transit/__tests__/route-result-ranking.test.ts` を新しい規則へ書き換える。直通と乗換の差が5分なら直通、35分なら乗換、ちょうど30分なら乗換、直通がないときは乗換、はやさ優先では到着の早い乗換、到着時刻指定で差15分なら直通、差45分なら乗換、同値時の順序をそれぞれ固定し、`npm run test:unit -- route-result-ranking` が失敗することを確認する
- [x] 2.2 `src/lib/transit/route-result-ranking.ts` から `TRANSFER_PENALTY_MINUTES` と加算の比較を消し、直通優先と`TRANSFER_AVOIDANCE_THRESHOLD_MINUTES`（30分）の比較へ変える。`route-algorithm.ts` の再輸出と `ROUTE_PARAMS.TRANSFER_PENALTY_MINUTES` も消し、`npm run test:unit -- route-result-ranking route-algorithm` が通ることを確認する
- [x] 2.3 `grep -rn "TRANSFER_PENALTY_MINUTES" src` が0件であることを確認し、`npx tsc --noEmit --incremental false` と `npm run lint` を通す

## 3. 実経路で確かめる

- [x] 3.1 平日10時、アーツ千代田3331（35.704001,139.771727）から神田錦町（35.693314,139.76099）の結果ページが「ルートが見つかりません」ではなく乗換経路を表示することを確認する（それまでは8時だけ経路が出ていた）
- [x] 3.2 平日10時、神保町交差点北（35.697049,139.757749）から九段下（35.695417,139.752405）で、徒歩優先が直通を、はやさ優先が10時14分発の乗換を選ぶことを確認する
- [x] 3.3 `npm test` を通し、変更が他の経路・表示・PDFのテストを壊していないことを確認する

## Workflow follow-up

- `.agents/skills` などリポジトリ外の資料には触れない。検証係のレビュー後にアーカイブする。
