# Tasks

## 1. 索引の整形

- [x] 1.1 `serializeGeocodeIndex` を、`boundary`・`blocks`・`names` の各要素を1行のJSONとして並べる出力に変え、`src/lib/location/__tests__/geocode-search.test.ts` の往復テスト（書き出し→読み戻し）が通ることを確認する
- [x] 1.2 整形後の出力が、要素ごとに改行で区切られていることを検証するテストを追加する（`names` の件数と行数の関係で確かめる）
- [x] 1.3 索引を再生成し、`node -e "JSON.parse(require('fs').readFileSync('data/geocode-index.json','utf8'))"` で読めることと、`npm run test:unit` で検索のテストが通ることを確認する

## 2. 無変更時の書き換え抑止

- [x] 2.1 `scripts/update-geocode-index.ts` に、書き込み前の既存索引の読み込みと `indexDigest` による比較を追加し、内容が同じときに `writeIndex` を呼ばないことを `scripts/__tests__/update-geocode-index.cli.test.ts` で検証する
- [x] 2.2 既存索引が無い、または壊れている場合は書き換えることを同じテストで検証する
- [x] 2.3 書き換えた場合と書き換えなかった場合で報告の文言を分け、それぞれの文言をテストで検証する

## 3. 追跡と文書

- [x] 3.1 `data/geocode-index.json` の整形後の内容で索引を再生成し、`git add` して追跡対象に加える。`.gitignore` に `data/geocode-index.json` の除外がないことを `git check-ignore` で確認する
- [x] 3.2 2回続けて `npm run update-geocode-index` を実行し、2回目で `git status` に差分が出ないことを確認する
- [x] 3.3 `docs/how-to/update-geocode-index.md` に、索引を追跡する理由、差分が出る条件（内容が変わったときだけ）、確認コマンドから `generatedAt` を外す変更を反映する

## 4. 統合確認

- [x] 4.1 `npm run test:unit`、`npm run test:server`、`npm run lint`、`npm run build` を実行し、すべて成功することを確認する
- [x] 4.2 `npm run start` で起動し、`/api/geocode?q=えみふる` と `/api/geocode?lat=35.6941626&lng=139.7535624` が索引から応答することを確認する

## Workflow follow-up

- 実装完了後、アーカイブ手順で `openspec/changes/track-geocode-index/` を `openspec/changes/archive/` へ移す。
