# Tasks

## 1. 依存の宣言

- [x] 1.1 `package.json` の `dependencies.maplibre-gl` を `^6.20.0`、`dependencies.next` を `^15.5.29`、`devDependencies.eslint-config-next` を `15.5.29` へ上げ、`overrides` に `"@prisma/config": { "effect": "3.22.5" }` を加える。`npm ls effect maplibre-gl next` で `effect@3.22.5` が `prisma` → `@prisma/config` 配下に入り、`maplibre-gl@6.20.0` と `next@15.5.29` が解決されることを確認する。
- [x] 1.2 `npm audit fix --no-audit --no-fund` を実行し、`npm audit --json` の `metadata.vulnerabilities` がすべて0になることを確認する。0にならない場合は残る経路を `npm ls <package>` で特定し、作業記録に書く。
- [x] 1.3 `npm ci --no-audit --no-fund` で入れ直し、`npm audit` が0件のままであること、`node -e "console.log(require('typescript/package.json').version)"` が `5.8.3` であることを確認する。`package-lock.json` の差分が300行程度に収まることも確認する。
- [x] 1.4 `npx prisma validate`、`npx prisma generate`、`npx prisma migrate status` を実行し、effect 3.22.5 の override で CLI が動くことを確認する。

## 2. 印刷地図の移行

- [x] 2.1 `src/lib/pdf/print-map.ts` で、`MAP_WORKER_SCRIPT` を `node_modules/maplibre-gl/dist/maplibre-gl.mjs` へ変え、`MAP_WORKER_THREAD` に `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` を足す。`PrintMapPage` の `addScriptTag` を削り、`evaluate` の引数型に地図ライブラリと worker の文字列を取る形を加える。`npx tsc --noEmit` が通ることを確認する。
- [x] 2.2 `drawPrintMaps` で、`readFile` した2つのファイルを `page.evaluate` へ渡し、ページ内で Blob の URL を作って `import()` し、`setWorkerUrl` を呼んでから `window.maplibregl` に載せる。読み込みの失敗は既存の `try/catch` で `ok: false` として返す。
- [x] 2.3 `renderPrintMapsInPage` の `Map` の生成で、`preserveDrawingBuffer: true` を `canvasContextAttributes: { preserveDrawingBuffer: true }` へ移す。
- [x] 2.4 `src/lib/pdf/__tests__/print-map.test.ts` の `createPage` から `addScriptTag` を削り、`evaluate` の呼び出し回数と引数の位置を新しい実装へ合わせる。注入の失敗は `evaluate` の reject で再現する。`npm run test:unit -- print-map` が通ることを確認する。
- [x] 2.5 `src/app/api/__tests__/pdf-map-failure.test.ts` を実行し、地図の読み込み失敗、地図の描画失敗、成功の3経路が従来どおり 500 と 200 に分かれることを確認する。
- [x] 2.6 実ブラウザで地図を描く検証を1回行い、`drawPrintMaps` が `{ ok: true }` を返すこと、生成したページに `img` があり、その画素が白紙でなくグレースケールであることを確認する。結果を作業記録に残す。

## 3. 表示と検査の追随

- [x] 3.1 `src/lib/license/dependencyLicenses.ts` の `maplibre-gl` の `version` を `6.20.0` へ直し、`src/lib/license/__tests__/dependencyLicenses.integration.test.ts` が通ることを確認する。
- [x] 3.2 `__tests__/dependency-security.test.ts` に、`next` の宣言下限と解決値が `15.5.29` 以上であること、`maplibre-gl` の宣言下限と解決値が `6.20.0` 以上であることを検査する項目を加える。`npm run test:unit -- dependency-security` が通ることを確認し、宣言だけを古い値に戻すと失敗することも1度確かめる。
- [x] 3.3 `docs/` のうち、依存の版や監査の状態に触れている記述を検索し、更新が必要な箇所を直す。該当がなければ、その旨を作業記録に書く。

## 4. 全体の検証

- [x] 4.1 `npx tsc --noEmit --incremental false` と `npm run lint` を実行し、どちらもエラーなく終わることを確認する。
- [x] 4.2 `npm run build` を実行し、`next build` が成功することを確認する。
- [x] 4.3 `npm run test:unit:ci` と `npm run test:server:ci` を実行し、失敗が0件であることを確認する。失敗が出た場合は、今回の変更に起因するかを `git stash` で変更前と比べて切り分け、結果を作業記録に残す。
- [x] 4.4 最終の `npm audit --json` を実行し、`high` と `critical` が0件であることを確認して、結果を作業記録に残す。

## Workflow follow-up

- 変更をアーカイブし、`server-dependency-security` のデルタを主仕様へ反映する。
- アーカイブ後の `openspec/specs/server-dependency-security/spec.md` に、追加した要件が入っていることを確認する。
