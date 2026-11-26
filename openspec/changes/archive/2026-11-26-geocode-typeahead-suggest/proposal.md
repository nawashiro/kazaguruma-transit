# Proposal

## Why

住所・場所名の入力は、文字を打ち終えて決定ボタンかEnterを押してからでないと候補が出ない。索引検索はプロセス内で0.4ms、応答は700バイト程度しかないのに、利用者は「当たっているか分からないまま打ち続ける」ことを強いられている。打鍵に応じて候補を出せば、この往復が消える。

その妨げになっているのが、地点検索に掛けているIPあたり1時間600回の利用制限である。打鍵のたびに検索すると上限に当たり、429を受けたクライアントは入力途中の文字を捨てて利用制限画面へ飛ぶ。地点検索はサーバー内の静的索引しか読まず、守るべき外部資源がないため、この制限は地点検索には不要である。

## What Changes

- 住所・場所名の入力中に候補を自動表示する。日本語入力の変換中は検索せず、打鍵が落ち着いてから検索する。
- 古い応答が新しい候補を上書きしないようにする。
- 入力中の空振りや通信失敗ではエラーを鳴らさず、入力欄から離れたとき・明示的に確定を試みたときだけ伝える。
- 住所欄のアイコン専用検索ボタンを廃止する。Enterは待ち時間を待たずに即座に検索する。
- 入力欄のブラウザ自動補完を切り、自前の候補と重ならないようにする。
- **BREAKING** `/api/geocode` から利用制限を外し、429を返さなくなる。経路検索・PDF生成・結果ページの利用制限は維持する。
- 地点検索の結果を受けて利用制限画面へ遷移するクライアント分岐と、`place_search` の `rate_limited` を廃止する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `location-search`: 「検索の利用制限」を削除し、地点検索が利用回数で拒否されないことを規定する。
- `route-search-form`: 住所入力中の候補表示を追加する。打鍵に応じた自動検索、日本語入力の変換中は検索しないこと、古い応答を破棄すること、入力中のエラー抑制を規定する。
- `search-controls`: 住所検索の虫眼鏡ボタンを廃止し、Enterによる即時検索へ置き換える。

## Impact

- サーバー: `src/app/api/geocode/route.ts` からレート制限ミドルウェアと `limitExceeded` を除去する。
- クライアント: `src/lib/location/geocoding-search.ts`、`src/components/features/useGeocodingSearch.ts`、`OriginSelector.tsx`、`DestinationSelector.tsx`、`LocationCandidates.tsx`、`src/components/ui/InputField.tsx`、`SearchButton.tsx`。
- API契約: `/api/geocode` は429を返さない。`GeocodingStatus` から `rate-limited` が消え、`isRateLimited` を参照する分岐が消える。
- テスト: `geocode-route.test.ts`、`geocoding-search.test.ts`、`useGeocodingSearch.test.tsx`、`OriginSelector.test.tsx`、`DestinationSelector.test.tsx`、`page.test.tsx` の検索ボタン契約。
- 仕様: `location-search`、`route-search-form`、`search-controls`。
- 進行中の `analytics-usage-measurement`: `place_search` の `outcome` から `rate_limited` が到達不能になるため、アーカイブ前に差分を追随させる。
