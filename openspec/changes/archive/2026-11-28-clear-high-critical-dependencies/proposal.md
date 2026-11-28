# Proposal

## Why

依存監査に critical 1件、high 5件、moderate 7件が残っている。critical は PDF 印刷地図に使う maplibre-gl 5.24.1 の XSS（GHSA-jrc7-96c5-q579、CVSS 10）で、5系には修正版が存在しない。high は Prisma CLI が抱える effect の ReDoS、開発用の follow-redirects と joi が占める。

PDF 地図は外部入力の経路座標を描く処理であり、公開サーバーから到達できる。修正版のない深刻度の高い警告を放置し続ける理由はない。

## What Changes

- `maplibre-gl` を 5.24.1 から 6.20.0 へ上げる。6系は classic バンドル（`dist/maplibre-gl.js`）を廃止し、`dist/maplibre-gl.mjs` と別ファイルの worker を配る。PDF 生成のページへの読み込みを、ファイルを Blob として import する方式へ変え、worker も `setWorkerUrl` で明示的に渡す。
- `MapOptions` の `preserveDrawingBuffer` が `canvasContextAttributes` 配下へ移ったため、指定位置を移動する。放置すると例外を出さずに白紙の地図が PDF に載る。
- `next` と `eslint-config-next` を 15.5.29 へ上げる。中程度3件（画像最適化の SVG 拒否迂回など）が消える。
- `overrides` に `@prisma/config` の `effect` 3.22.5 を加える。Prisma 本体は 7.10.1 のまま据え置く。監査が提示する 6.12.0 への後退は採らない。
- 開発用の推移的依存（follow-redirects、joi、@typescript-eslint 系）を `npm audit fix` で修正版へ上げる。
- `typescript` の解決値を 5.8.3 に据え置く。5.9 系では `page.pdf()` の戻り値と `BodyInit` の型が合わず `next build` が落ちる。型に合わせた 1 行の修正は採らず、今回の範囲を脆弱性の解消に限る。
- 依存の回帰を止める検査を `__tests__/dependency-security.test.ts` に加える。
- ライセンスページが読む `maplibre-gl` の版表記を 6.20.0 に直す。

利用者から見た PDF、経路検索、画面の出力は変えない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `server-dependency-security`: 修正版を使用する依存に `maplibre-gl` と `next` を加える。あわせて、監査の high と critical を残さない要件、修正版を下回る依存の回帰を検査で止める要件を追加する。

`printed-route-map` の要件は変えない。地図の出典、モノクロ描画、徒歩区間、表示範囲、失敗時の応答は、移行後も同じ振る舞いで満たす。`dependency-maintenance` の要件も変えない。段階ごとの採用と取消しの手順で進める。

## Impact

- `package.json`、`package-lock.json`: `maplibre-gl` と `next`、`eslint-config-next` の宣言、`overrides`。lock の差は 290 行追加、273 行削除。
- `src/lib/pdf/print-map.ts`: 地図ライブラリの読み込み方式とキャンバス属性。`PrintMapPage` の `addScriptTag` を `evaluate` に置き換える。
- `src/lib/pdf/__tests__/print-map.test.ts`: 上記の差し替えに追随する。
- `src/lib/license/dependencyLicenses.ts`: `maplibre-gl` の版表記。
- `__tests__/dependency-security.test.ts`: 回帰検査。
- 影響を受けない: 経路検索、GTFS 取込、地点検索、Prisma のスキーマと生成クライアント、PDF の用紙設定と本文。
- 実行時の挙動: Prisma CLI の設定読み込みだけが effect 3.22.5 になる。`@prisma/client` の依存に effect は含まれない。
