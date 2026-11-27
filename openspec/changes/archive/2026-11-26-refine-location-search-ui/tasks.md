# Tasks

## 1. 候補一覧の見出しと件数

- [x] 1.1 `DestinationSelector.test.tsx` と `OriginSelector.test.tsx`、`src/app/__tests__/page.test.tsx` の一覧の検索を `目的地の候補` / `出発地の候補` へ変え、見出し行（`目的地の候補から選ぶ`）が存在しないことを確かめるテストと、件数の文言が画面に表示されないことを確かめるテストを足し、`npm run test:unit -- DestinationSelector OriginSelector src/app/__tests__/page.test.tsx` が失敗することを確認する。
- [x] 1.2 `LocationCandidates.tsx` から見出しの段落を削り、一覧へ `aria-label={`${label}の候補`}` を付け、件数の段落を `sr-only` の `role="status"` として残す。1.1のテストが通ることを確認する。
- [x] 1.3 件数が0件のときに一覧と通知を描画しない既存の挙動が保たれることを、`LocationCandidates` を空配列で描画するテストで確かめる。

## 2. 候補項目の操作可能性

- [x] 2.1 `LocationCandidates` のテストへ、各項目が `cursor-pointer` と `hover:bg-base-100` を持ち、`hover:bg-base-200` を持たないことを確かめる検証を足し、`npm run test:unit -- DestinationSelector` が失敗することを確認する。
- [x] 2.2 `LocationCandidates.tsx` の項目のhoverを `hover:bg-base-200` から `hover:bg-base-100` へ変え、`cursor-pointer` を加える。2.1のテストが通ることを確認する。
- [x] 2.3 `npm run test:unit -- LocationSuggestions` を実行し、施設一覧のhoverと44 CSS pxの操作領域が変わっていないことを確認する。

## 3. 見出しの文字サイズ

- [x] 3.1 `LocationFieldset.test.tsx` に、`legend` が `fieldset-legend` と `text-xl` を持ち、`text-base` を持たないことを確かめる検証を足し、`DestinationSelector.test.tsx` と `DateTimeSelector.test.tsx` に「名前で検索」が `text-lg`、「よく利用される施設から選択」が `text-lg` であることを確かめる検証を足して、`npm run test:unit -- LocationFieldset DestinationSelector DateTimeSelector` が失敗することを確認する。
- [x] 3.2 `LocationFieldset.tsx`、`DateTimeSelector.tsx`、`HomeRouteForm.tsx` の `legend` を `text-xl` に、`DestinationSelector.tsx` と `LocationSuggestions.tsx` の `h3` を `text-lg` に変える。3.1のテストが通ることを確認する。
- [x] 3.3 `npm run test:unit -- src/app/__tests__/font-size-compliance.test.ts` を実行し、見出しの文字が16px以上であることを確認する。

## 4. 住所欄の補足文

- [x] 4.1 `DestinationSelector.test.tsx` と `OriginSelector.test.tsx` に、入力欄の説明が「住所か建物名を入力してください。」であり、「建物名だけでも大丈夫な場合がほとんどです。」ではないことを確かめる検証を足し、`npm run test:unit -- DestinationSelector OriginSelector` が失敗することを確認する。
- [x] 4.2 `DestinationSelector.tsx` と `OriginSelector.tsx` の `description` を「住所か建物名を入力してください。」へ変える。4.1のテストが通ることを確認する。

## 5. 統合確認

- [x] 5.1 `npm test` を実行し、unitとserverの全テストが通ることを確認する。
- [x] 5.2 `npx tsc --noEmit` と `npm run lint` を実行し、型とlintの誤りがないことを確認する。
