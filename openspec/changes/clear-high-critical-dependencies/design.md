# Design

## Context

PDF の印刷地図は `src/lib/pdf/print-map.ts` が描く。Puppeteer のページへ `addStyleTag` で CSS を、`addScriptTag({ path })` で `node_modules/maplibre-gl/dist/maplibre-gl.js` を注入し、`page.evaluate` で `window.maplibregl` を読む。描画後は WebGL のキャンバスを 2D のキャンバスへ `drawImage` してグレースケールにし、`img` に置き換える。テストは `PrintMapPage` インターフェースで Puppeteer を差し替える。

maplibre-gl 5.24.1 は `dist/maplibre-gl.js`（classic バンドル）を配る。6.20.0 の `dist/` は次の構成に変わる。

```
maplibre-gl.mjs          ESM。global を設定しない（window.maplibregl を作らない）
maplibre-gl-worker.mjs   worker。別ファイルで配る
maplibre-gl.css
```

v6 の worker URL は `import.meta.url` から兄弟ファイル名を組み立てて解決する。Blob から import すると `import.meta.url` が `blob:` になり、`/^https?:/` の判定で空文字を返すため、worker を起動できない。`setWorkerUrl` で明示的に渡す必要がある。

実測で確認した制約は次のとおり。

- `addScriptTag({ path: '*.mjs' })` は script タグの type が `text/javascript` のままで、`import.meta` の構文エラーになる。呼び出し自体は成功するため、失敗は `window.maplibregl` が undefined のまま現れる。
- `addScriptTag({ type: 'module' })` は注入が完了する前に戻り、直後の `evaluate` ではまだ `window.maplibregl` が undefined になる。
- `page.evaluate(async ({ library, worker }) => ...)` で Blob import する方式は、`--disable-gpu` のヘッドレス Chrome でも `idle` まで到達し、キャンバスに描画できる。

## Goals / Non-Goals

**Goals:**

- maplibre-gl 6.20.0 で、既存と同じ見た目のモノクロ地図を PDF に載せる。
- 地図ライブラリの読み込み失敗を、既存の失敗経路（`ok: false` → 500 応答）に合流させる。
- 監査の high と critical を0件にする。

**Non-Goals:**

- TypeScript を 5.9 系へ上げない。`page.pdf()` の戻り値と `BodyInit` の型の問題は別件として切り離す。
- Prisma を 8 系（RC）へ上げない。7.10.1 のまま effect だけを override する。
- `` `public/licenses/dependencies.json` `` の生成方法を変えない。ビルド時に webpack プラグインが作る既存の流れを保つ。
- PDF の本文、用紙設定、徒歩区間の描画規則を変えない。

## Decisions

### 依存ファイルを読み、Blob としてページ内で import する

`readFile` で `maplibre-gl.mjs` と `maplibre-gl-worker.mjs` を読み、`page.evaluate` の引数として渡す。ページ側では次の 3 手順を実行する。

1. 本体を `Blob` → `URL.createObjectURL` → `import()` で読み込む。
2. 同じ方法で作った worker の Blob URL を `api.setWorkerUrl` に渡す。
3. 読み込んだ名前空間を `window.maplibregl` に載せる。既存の `renderPrintMapsInPage` は `window.maplibregl` を読むため、描画側を変えずに済む。

`addScriptTag({ type: 'module' })` を採らない理由は、注入の完了を待つ手段がないこと。`evaluate` の中で `import()` を await すれば、読み込みの成否が同じ呼び出しの例外として返る。既存の `try/catch` がそのまま失敗経路として働く。

`data:` URL へ base64 で埋め込む案は採らない。ファイルサイズが約1.7MBあり、base64 で膨らませる意味がない。`Blob` なら元の文字列のまま渡せる。

### worker は `setWorkerUrl` で渡す

v6 は worker を別ファイルで配り、既定では `import.meta.url` の兄弟として解決する。Blob import ではこの解決が働かないため、`setWorkerUrl` を明示的に呼ぶ。呼ばないとマップの生成自体は成功し、タイルの要求で初めて失敗する。失敗は `map.on('error')` に届くので、既存の失敗処理で拾えるが、原因が分かりにくい。明示的に渡す。

### キャンバス属性を `canvasContextAttributes` へ移す

v6 で `preserveDrawingBuffer` は `MapOptions` 直下から `canvasContextAttributes` 配下へ移った。直下に置いても型エラーにならず無視されるため、`toDataURL` が空画像を返し、例外を出さずに白紙の地図が刷られる。この静かな失敗を防ぐため、指定位置を移す。

実測では、`canvasContextAttributes` を指定した場合と指定しない場合で `toDataURL` の長さが同じ 238,498 だった。これは `preserveDrawingBuffer` を付け忘れても `idle` 直後の `toDataURL` が偶然撮れるためである。指定は必須だが、その有無を出力の差で検出するテストは書かない。

### Prisma は据え置き、effect だけを override する

監査は prisma の修正として 6.12.0 への後退を提示する。7.10.1 が 7 系の最新安定（dist-tag `prev`）であり、8.0.0 は RC なので、後退は採らない。

effect の脆弱性（GHSA-7589-6fvf-x4pw）は `@prisma/config` が 3.20.0 を固定していることで残る。`overrides` に `@prisma/config: { effect: '3.22.5' }` を書けば、Prisma 本体の版を動かさずに修正できる。3.22.5 は effect 3 系の最新で、`@prisma/config` 7.11.0-dev.4 が実際に採用している版でもある。

effect は `@prisma/client` の依存に含まれない。`@prisma/client` の依存は `@prisma/client-runtime-utils` だけであり、実行時のアプリへは入らない。影響は CLI（`prisma generate`、`validate`、`migrate`）に限られる。3つのコマンドが 3.22.5 で正常に動くことを確認済み。

Prisma 8 が安定したら、この override は外す。

### TypeScript は 5.8.3 に据え置く

`npm update` を全範囲に掛けると TypeScript が 5.9.3 になり、`next build` が次で落ちる。

```
src/app/api/pdf/generate/route.ts(160,31): error TS2345:
Argument of type 'Uint8Array<ArrayBufferLike>' is not assignable to parameter of type 'BodyInit'
```

`page.pdf()` の戻り値は `Uint8Array` で、TS 5.9 の `BodyInit` はこれを受け付けない。`new Uint8Array(pdfBuffer)` を通せば型は通るが、今回の変更の目的は脆弱性の解消であり、型の追随は別の変更として扱う。lock を 5.8.3 に保てばコード変更なしで通る。

なお `package.json` の宣言は `"typescript": "^5"` のままである。次に全範囲の `npm update` を打つと再び 5.9 系が入り、同じ箇所で落ちる。この罠は tasks に記録として残し、宣言の固定は今回の範囲に含めない。

### 更新は段階を分けず、1つの変更として適用する

`dependency-maintenance` は段階ごとの採用と、失敗した経路だけの取消しを求めている。今回は次の理由で1段階にまとめる。

- maplibre-gl 以外の更新は、既存の振る舞いを変えない。
- maplibre-gl の更新は 1 ファイルの変更で完結し、PDF の描画という1つの経路に閉じる。
- 段階を分けると、lock の差分を何度も作り直すことになり、レビューの負担が増える。

ただし作業の途中で検証が失敗した場合は、`dependency-maintenance` の定めに従い、失敗した経路の変更だけを取り消す。

## Risks / Trade-offs

- [Blob import は CSP の影響を受ける] → PDF 生成のページは `page.setContent` で作るローカルの HTML で、CSP を設定していない。将来 CSP を入れる場合は `script-src blob:` が必要になる。`src/lib/pdf/route-html.ts` に CSP の記述がないことを確認済み。
- [v6 の API 差分が他にもある] → 使用している API は `Map`、`Marker`、`on`、`addSource`、`addLayer`、`setLngLat`、`addTo` のみ。v6 の型定義で `MapOptions`、`MarkerOptions`、`GeoJSONSource` の該当項目が残ることを確認済み。実ブラウザで `idle` 到達と画素の描画を確認済み。
- [Blob URL を解放していない] → ページは PDF 生成のたびに作って閉じるため、リークは PDF 1 回分に閉じる。`URL.revokeObjectURL` を呼ぶには描画完了を待つ必要があり、待機の複雑さに見合わない。
- [effect の override が Prisma の更新で壊れる] → `@prisma/config` が effect 4 系へ移った場合、`overrides` の指定が解決できずに導入が失敗する。その時点で override を外す。失敗は導入時点で分かるため、静かに壊れることはない。
- [`typescript` の宣言が `^5` のまま] → 全範囲の `npm update` で 5.9 系が入り `next build` が落ちる。tasks に記録として残す。

## Migration Plan

1. `maplibre-gl`、`next`、`eslint-config-next` の宣言を上げ、`overrides` に effect を加える。
2. `npm audit fix` で残りの推移的依存を修正版へ上げる。
3. `src/lib/pdf/print-map.ts` の読み込み方式とキャンバス属性を変える。
4. `src/lib/license/dependencyLicenses.ts` の版表記を直す。
5. `npm ci` で入れ直し、`npm audit` が 0 件になることを確認する。
6. `npx tsc --noEmit`、`npm run lint`、`npm run build`、`npm run test:unit:ci`、`npm run test:server:ci` を実行する。
7. 実ブラウザで PDF の地図を描き、白紙でないことを確認する。

巻き戻す場合は、`package.json`、`package-lock.json`、`src/lib/pdf/print-map.ts`、`src/lib/pdf/__tests__/print-map.test.ts`、`src/lib/license/dependencyLicenses.ts` を戻す。`__tests__/dependency-security.test.ts` の追加分も戻す。

## Open Questions

なし。
