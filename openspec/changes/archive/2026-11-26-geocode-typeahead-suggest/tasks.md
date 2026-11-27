# Tasks

## 1. 地点検索の利用制限の除去

- [x] 1.1 `src/app/api/__tests__/geocode-route.test.ts` の「利用制限に達したら429を返す」を、「同じ利用元から繰り返し検索しても429を返さない」へ書き換え、REDを確認する。`dataManager.getRateLimitByIp` が上限値を返す状態でも200を返すことを確かめる。
- [x] 1.2 `src/app/api/geocode/route.ts` から `appRouterRateLimitMiddleware` の呼び出しと `limitExceeded` を除去し、1.1がGREENになることを確認する。
- [x] 1.3 `src/lib/location/__tests__/geocoding-search.test.ts` の「429を利用制限として扱う」を削除し、`GeocodingStatus` から `rate-limited` を除いた状態で型検査（`npx tsc --noEmit`）が通ることを確認する。
- [x] 1.4 `src/lib/location/geocoding-search.ts` から429分岐と `isRateLimited` を削除し、`searchGeocoding` は失敗時に `error` だけを返すことをテストで確認する。
- [x] 1.5 経路検索・PDF生成・結果ページの利用制限が変わっていないことを、`src/app/api/__tests__/transit-rate-limit.test.ts` と `src/app/routes/__tests__/page.test.tsx` が無変更で通ることで確認する。

## 2. クライアントから利用制限の分岐を除く

- [x] 2.1 `src/components/features/__tests__/useGeocodingSearch.test.tsx` の「利用制限では利用制限画面へ案内する」を削除し、`next/navigation` のモックと `place_search` の `rate_limited` への期待も外してREDを確認する。
- [x] 2.2 `src/components/features/useGeocodingSearch.ts` から `useRouter`、`router.push`、`rate_limited` の記録を削除し、2.1がGREENになることを確認する。`place_search` の `outcome` が `found` / `not_found` / `failed` の3つだけになることを確かめる。
- [x] 2.3 `src/components/features/__tests__/OriginSelector.test.tsx` と `DestinationSelector.test.tsx` から429の遷移テストを削除し、`OriginSelector.tsx` の逆引きから `isRateLimited` の分岐と `useRouter` を削除して両テストがGREENになることを確認する。
- [x] 2.4 `openspec/changes/analytics-usage-measurement/specs/usage-measurement/spec.md` の `place_search` の `outcome` から `rate_limited` を除き、`grep -rn "rate_limited" src` が0件になることを確認する。

## 3. 入力中の候補表示

- [x] 3.1 `src/components/features/__tests__/useGeocodingSearch.test.tsx` に、2文字以上の打鍵で時間経過後に検索が1回だけ走り、候補が `candidates` に入るテストを先に書き、REDを確認してから、フックへ入力値と250msのデバウンスを実装する。`jest.useFakeTimers()` で待ち時間を進めて確かめる。
- [x] 3.2 同じテストファイルに、`compositionstart` から `compositionend` までの入力では検索が走らず、確定後の入力で1回だけ走るテストを書いてREDを確認し、フックにIME判定を実装する。
- [x] 3.3 同じテストファイルに、「神」の応答が「神田」の応答より後に届いても候補が「神田」の結果のままであるテストを書いてREDを確認し、世代番号による古い応答の破棄を実装する。
- [x] 3.4 同じテストファイルに、打鍵中の `empty` と `error` では `error` が立たず、フォーカスを外したときとフォーム送信時だけ立つテストを書いてREDを確認し、検索の契機を区別する実装を行う。
- [x] 3.5 `src/components/features/__tests__/DestinationSelector.test.tsx` に、入力中に候補が自動表示され、決定ボタンを押さずに候補を選べるテストを書いてREDを確認してから、`DestinationSelector.tsx` をフックの `query` / `setQuery` に結び付ける。`OriginSelector.tsx` も同じ形にする。
- [x] 3.6 `OriginSelector.test.tsx` に、入力欄からフォーカスを外すと候補なしのエラーが入力に `aria-describedby` で関連付くテストを書き、REDを確認してから実装する。
- [x] 3.7 `src/components/features/LocationCandidates.tsx` に候補件数の `role="status"` と Escでの候補クローズを実装し、`DestinationSelector.test.tsx` で件数の読み上げとEscによる非表示を確認する。

## 4. 入力欄とボタンの整理

- [x] 4.1 `src/components/ui/__tests__/InputField.test.tsx` に `autoComplete="off"` が入力要素へ渡るテストを書き、REDを確認してから `InputField.tsx` に `autoComplete` プロパティを足す。既定値は現状のままにする。
- [x] 4.2 `OriginSelector.tsx` と `DestinationSelector.tsx` の住所欄に `autoComplete="off"` を渡し、`DestinationSelector.test.tsx` で住所欄の `autocomplete` 属性を確認する。
- [x] 4.3 `OriginSelector.test.tsx` と `DestinationSelector.test.tsx` の「検索submit」を期待するテストを、住所欄に検索ボタンが存在しないこととEnterで検索できることの確認へ書き換えてREDを確認し、両Selectorから `SearchButton` を外す。
- [x] 4.4 `src/app/__tests__/page.test.tsx` の「住所検索はアイコン専用、最終検索は可視文字『経路を検索』のsubmitに分ける」を、最終検索のsubmitだけを確認する内容へ書き換え、`getAllByRole("button", { name: "検索" })` が0件であることを確認する。
- [x] 4.5 `grep -rn "SearchButton" src` が0件になったことを確認し、`src/components/ui/SearchButton.tsx` を削除する。

## 5. 統合確認

- [x] 5.1 `npm run lint` と `npm test` が通ることを確認する。
- [x] 5.2 開発サーバーで入力画面を開き、目的地に「かんだ」と打鍵して変換中に通信が発生せず、変換確定後に候補が出ることを確認する。ブラウザの開発者ツールで `/api/geocode` の要求回数と応答を確かめる。
- [x] 5.3 同じ画面で、候補を表示したままTabで移動して選べること、Escで候補が閉じること、入力欄から離れると候補なしのエラーが読み上げられることを確認する。
- [x] 5.4 `openspec validate geocode-typeahead-suggest --strict` が通ることを確認する。

## Workflow follow-up

- プロジェクトのレビュー要件を満たしたうえで変更をアーカイブし、`location-search`、`route-search-form`、`search-controls` の主仕様へ差分が反映されたことを確認する。
- 進行中の `analytics-usage-measurement` をアーカイブする前に、`place_search` の `outcome` から `rate_limited` が消えていることを確かめる。
