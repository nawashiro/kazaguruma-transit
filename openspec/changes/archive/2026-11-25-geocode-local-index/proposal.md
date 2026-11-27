# Proposal

## Why

住所・場所名の検索とGPSの逆引きがGoogle Maps Geocoding APIに依存しており、Google Maps Platform Service Specific Terms 6.2（Google Maps Contentを非Google地図と併用してはならない）、6.3.1（座標のキャッシュは連続30日まで）、および利用規約3.2.3(a)（pre-fetch・index・store・rehostの禁止）に反している。Issue [#156](https://github.com/nawashiro/kazaguruma-transit/issues/156)。

印刷物への埋め込みとGoogleマップへのリンクは別issue（静的画像・PDFは #156 の範囲外として切り出し、リンクは [#157](https://github.com/nawashiro/kazaguruma-transit/issues/157)）で扱う。本変更はジオコーディングだけを対象とし、外部APIの呼び出しをゼロにする。

## What Changes

- **BREAKING** `/api/geocode` はGoogle Maps Geocoding APIへ問い合わせず、ビルド時に生成したローカル索引を探索する。クエリは `q`（名前または住所）と `lat`/`lng`（逆引き）の2系統を受け付ける。
- **BREAKING** 検索結果は最大5件の候補配列を返す。現行の「先頭の結果を自動確定」をやめ、利用者が候補から選んで確定する。
- 名前索引は、OSMの東京都抽出（`JP-13-latest.osm.pbf`）を町字ポリゴンで切り出した名前付き要素と、既存の場所artifact、GTFS停留所を統合して作る。線形要素（道路・鉄道・水路・境界）は除外する。
- 番地索引は、国土交通省「位置参照情報」の千代田区街区レベルデータから作る。OSMの `addr:*` タグは街区キーに解決できるものが約2割しかないため、番地の正としない。
- 逆引きは番地索引の最近傍探索で行い、「千代田区◯◯◯丁目N番」形式の住所を返す。
- 候補は種別の重みで順位付けする。駅・公園・公共施設・文化施設を上位、物販・飲食・駐車場を下位に置く。
- 検索語の正規化として、末尾の「駅」を落とした再照合、全角数字・漢数字丁目の吸収、`番地`/`号`の区切り統一を行う。
- 索引は `data/geocode-index.json` としてリポジトリに置き、`npm run update-geocode-index` で更新する。ビルドは索引を読むだけで、外部から取得しない。
- `/api/geocode` の利用制限は共有バケツのまま上限を1時間あたり600回へ引き上げ、利用制限画面の文言を追随させる。429の契約と `/rate-limit?source=home` への案内は残す。
- `@googlemaps/google-maps-services-js` への依存のうち、ジオコーディング経路を削除する。PDF・静的画像が使うDirectionsとStatic Mapsの削除は本変更で行わない。
- 到達不能になった `src/lib/maps/staticMap.ts`、`src/lib/maps/directions.ts`、および `src/utils/maps.ts` の非同期URL生成関数は削除する。これらは呼び出し元を持たない。

## Capabilities

### New Capabilities

- `location-search`: 名前・住所による地点検索と、座標からの住所逆引き。候補の生成・順位付け・上限、正規化、索引の鮮度と失敗時の挙動を扱う。

### Modified Capabilities

- `route-search-form`: 「住所検索は先頭の検索結果を採用し」という確定規則を、候補一覧からの選択へ改める。

現行仕様は住所検索の利用制限の上限値を定めていないため、600回/時の制限は `location-search` に含める。

## Impact

- `src/app/api/geocode/route.ts`: 外部API呼び出しをローカル索引探索へ置換。クエリ・レスポンス形式の変更。
- `src/lib/location/geocoding-search.ts`、`src/components/features/useGeocodingSearch.ts`、`src/components/features/OriginSelector.tsx`、`src/components/features/DestinationSelector.tsx`: 候補配列の受け取りと選択UI。
- `src/lib/api/rate-limit.ts`、`src/app/rate-limit/page.tsx`、関連テスト: 上限値600回/時と文言。
- `scripts/update-geocode-index.ts`（新規）、`data/geocode-index.json`（新規）、`package.json` のスクリプト。
- `src/lib/location/geocode-index.ts`（新規）: 索引の読み込み、正規化、照合、順位付け。
- 削除: `src/lib/maps/staticMap.ts`、`src/lib/maps/directions.ts`、`src/utils/maps.ts` の非同期関数。参照のない `public/images/map_placeholder.png`。
- ライセンス表示: `src/lib/license/openDataLicenses.json` に位置参照情報（PDL-1.0）とOSM（ODbL-1.0）の出典を追加。
- 影響を受けない: 経路検索、GTFS取込、PDF出力、Nostr、場所詳細。
