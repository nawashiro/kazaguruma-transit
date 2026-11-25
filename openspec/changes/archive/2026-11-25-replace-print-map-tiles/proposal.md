# Proposal

## Why

印刷用PDFの地図は、Google Directions APIで徒歩ポリラインを取り、Google Static Maps APIの画像を`<img>`で埋め込んでいる。印刷物への埋め込みはGoogleの規約で認められておらず、Issue [#156](https://github.com/nawashiro/kazaguruma-transit/issues/156)で指摘された違反がこの経路に残っている。Issue [#158](https://github.com/nawashiro/kazaguruma-transit/issues/158)。

国土地理院タイルは代替になるが、縮尺の大きい場面で道路密度が落ちて読みにくい。MapLibreで使われるような淡色のベクタ地図に置き換える。

## What Changes

- PDF内の地図を、Puppeteerの描画中にMapLibre GL JSで地図タイルから描く方式へ置き換える。背景タイルはOpenFreeMapのPositronスタイルを使う。
- **BREAKING**（出力内容）: PDFの地図にGoogleの地図・経路が含まれなくなる。地図の色はモノクロへ統一する。
- 徒歩区間は、リクエストに任意の折れ線（`walkPaths`）があればその線を破線で描き、無ければ始点と終点を結ぶ破線を描く。本物の徒歩経路の生成はIssue [#151](https://github.com/nawashiro/kazaguruma-transit/issues/151)の範囲外とし、受け口だけを用意する。
- PDF生成からGoogle Directions APIとStatic Maps APIの呼び出しを削除する。`@googlemaps/google-maps-services-js`への依存を削除する。
- `GOOGLE_MAPS_API_KEY`を必要としなくなり、環境変数の例とドキュメントから記述を削除する。
- 紙面とライセンスページに、背景タイルの出典（OpenFreeMap・OpenMapTiles・OpenStreetMap）を追加する。
- 地図の取得に失敗した場合は、地図を欠いたPDFを返さず、PDFを生成できなかったことを示すエラーを返す。

## Capabilities

### New Capabilities

- `printed-route-map`: 印刷用PDFに載せる地図のタイル出典、モノクロ描画、徒歩区間の描画、帰属表示、および地図取得失敗時の振る舞い。

### Modified Capabilities

なし。既存の `route-search-results`、`server-dependency-security`、`dependency-maintenance` が定める「PDFを出力でき、用紙設定を変えない」という契約はそのまま満たす。

## Impact

- `src/app/api/pdf/generate/route.ts`: Google Mapsクライアントと静的画像URLの生成を削除し、MapLibreによる描画へ置き換える。`walkPaths`の受け取りを追加する。
- `src/components/features/RoutePdfExport.tsx`: 経路座標が手元にある場合に`walkPaths`を渡せるようにする。現時点では渡さない。
- `package.json`、`package-lock.json`: `maplibre-gl`を追加し、`@googlemaps/google-maps-services-js`を削除する。
- `src/lib/license/openDataLicenses.json`、`src/app/license/page.tsx`: タイルの出典を追加する。
- `.env.local.example`、`README.md`、`docs/how-to/docker-setup.md`: `GOOGLE_MAPS_API_KEY`の記述を削除する。
- テスト: `src/app/api/__tests__/pdf-route-contract.test.ts`に入力契約の追加分を足し、描画内容の契約テストを新設する。
- 影響を受けない: 検索、GTFS取込、Nostr、場所詳細、Webページ上の地図リンク（Issue [#157](https://github.com/nawashiro/kazaguruma-transit/issues/157)）。
