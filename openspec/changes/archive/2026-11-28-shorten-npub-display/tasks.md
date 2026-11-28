# Tasks

## 1. 表示文字列の上限

- [x] 1.1 `src/components/ui/__tests__/NpubDisplay.test.tsx` に、63文字のnpubを `npub1ef93…` の10文字で描画する、9文字のnpubに `…` を付けない、短縮の関数が10文字で切る、コピーには全体が入る、の4つのテストを先に書く。`npm run test:unit -- NpubDisplay` が失敗することを確認する
- [x] 1.2 `src/components/ui/NpubDisplay.tsx` に短縮の関数を置き、`code` 要素へ短縮した文字列を描画する。コピーはnpub全体を渡したまま、`truncate` と `min-w-0` も残す。`npm run test:unit -- NpubDisplay` が通ることを確認する

## 2. 読み上げ名からnpubを外す

- [x] 2.1 `src/app/discussions/create/page.tsx` の削除ボタンの読み上げ名を、`formatBip39JapaneseMnemonicPreviewFromPubkey` で作った日本語の呼び名に変える。`src/app/discussions/create/__tests__/page.test.tsx` に、`モデレーター とんかつ やたい うごかす を削除` で見つかり `モデレーター npub1restored を削除` では見つからないことを確かめるテストを足してから実装し、`npm run test:unit -- discussions/create` が通ることを確認する
- [x] 2.2 `src/app/discussions/[naddr]/edit/page.tsx` の削除ボタンにも同じ変更を入れる。この一覧は `hidden` と `aria-hidden` で画面から隠れているが、将来表示したときにnpubが読み上げへ戻らないよう揃える。`npm run test:unit -- "discussions/"` が通ることを確認する

## 3. 呼び出し側のテストを短縮表示へ合わせる

- [x] 3.1 `src/components/ui/__tests__/UserIdentity.test.tsx` と `src/components/discussion/__tests__/ModeratorManagementSection.test.tsx` の可視文字列の期待値を短縮後の文字列へ変える。`truncate` の確認と、コピーが全体を渡す確認は残す。`npm run test:unit -- UserIdentity ModeratorManagementSection` が通ることを確認する
- [x] 3.2 `src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx` の可視文字列の期待値を短縮後の文字列へ変える。`npm run test:unit -- "discussions/"` が通ることを確認する

## 4. 統合確認

- [x] 4.1 `npx tsc --noEmit --incremental false` と `npm run lint` を通し、`grep -rn 'を削除' src/app/discussions` の結果にnpubの変数が残っていないことを確認する
- [x] 4.2 `npm test` を通し、`src/app/__tests__/accessibility-source-contract.test.ts` のコピー操作の44 CSS pxと `text-base` の契約を含めて、ほかのテストを壊していないことを確認する

## Workflow follow-up

- `.agents/skills` などリポジトリ外の資料には触れない。検証係のレビュー後にアーカイブする。
