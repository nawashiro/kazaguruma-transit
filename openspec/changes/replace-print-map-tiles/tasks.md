# Tasks

## 1. 地図描画の土台

- [x] 1.1 `maplibre-gl` を `dependencies` に追加し、`npm install` が成功することを確認する。
- [x] 1.2 `src/lib/pdf/print-map.ts`（新規）に、地図1枚分の描画指定（中心と範囲、破線の座標、出典文字列、破線の描き方）を組み立てる純粋関数を置き、単体テスト `src/lib/pdf/__tests__/print-map.test.ts` で範囲の算出と座標の並びを検証する。
- [x] 1.3 同じモジュールに、PuppeteerのページへMapLibreを注入して地図を描き、WebGLのcanvasを2Dのcanvas経由でモノクロの画像へ置き換え、上限時間で打ち切る関数を置く。上限時間の経過と描画失敗の双方で例外を投げず失敗を返すことを、Puppeteerをモックした単体テストで検証する。

## 2. PDFの地図をMapLibreへ置き換える

- [x] 2.1 `src/app/api/pdf/generate/route.ts` から `Client`・`TravelMode`・`Language` の利用と `getDirectionsMapUrlWithPolyline` を削除し、`generateRouteHTML` を `export` して単体テストから直接呼べるようにする。`npx tsc --noEmit` が通り、Google SDKのimportがこのファイルから消えていることを `grep` で確認する。
- [x] 2.2 `GeneratePdfRequest` に `walkPaths`（`originToStop` と `stopToDestination` の任意の座標配列）を追加し、両方を受け取った場合と省いた場合で、地図以外のHTMLが同一になることを `src/app/api/__tests__/pdf-route-contract.test.ts` に追加した契約テストで検証する。
- [x] 2.3 `generateRouteHTML` が、地図を含むHTMLに地図の描画領域と出典の4つの文字列（OpenMapTiles・OpenFreeMap・OpenStreetMap contributors・ODbL-1.0）を含めることを `src/app/api/__tests__/pdf-print-map-html.test.ts`（新規）で検証する。座標がある区間だけ地図を持つことも同じテストで確認する。
- [x] 2.4 経路のない `type: "none"` のHTMLに地図が含まれないことを同じテストで検証し、既存の本文の文言が変わっていないことを確認する。

## 3. 地図の失敗をエラーとして返す

- [x] 3.1 地図の描画が失敗した場合に、PDFを返さず失敗を返すことを、`print-map.ts` の単体テストで検証する。
- [x] 3.2 地図が2枚あり片方だけが失敗した場合も、部分的なPDFを返さず失敗として扱うことを単体テストで検証する。
- [x] 3.3 描画の上限時間が経過したときに、PDFではなく日本語のメッセージを含む500の応答を返すことを、Puppeteerをモックして `POST` を直接呼ぶ結合テスト `src/app/api/__tests__/pdf-map-failure.test.ts`（新規）で検証する。
- [x] 3.4 既存の `type: "none"` の応答が、地図を必要としないため本変更後もPDFを返すことを、同じ結合テストで検証する。

## 4. Google依存とAPIキーの撤去

- [x] 4.1 `@googlemaps/google-maps-services-js` を `package.json` と `package-lock.json` から削除し、`npm ls @googlemaps/google-maps-services-js` が空になることを確認する。
- [x] 4.2 `src` 配下に `maps.googleapis.com` と `@googlemaps` の参照が残っていないことを `grep` で確認する。
- [x] 4.3 `.env.local.example`、`README.md`、`docs/how-to/docker-setup.md` から `GOOGLE_MAPS_API_KEY` の記述を削除し、`grep -rn "GOOGLE_MAPS_API_KEY" --exclude-dir=node_modules --exclude-dir=openspec` が何も返さないことを確認する。

## 5. 出典の表示

- [x] 5.1 `src/lib/license/openDataLicenses.json` にOpenFreeMap（MIT）とOpenMapTiles（スキーマ）の出典を追加し、既存のOpenStreetMapの項目に地図タイルの出典である旨を追記する。`npm run test:unit -- openDataLicenses` が通ることを確認する。
- [x] 5.2 ライセンスページに新しい出典が表示されることを、`src/app/api/__tests__/licenses.sections.integration.test.ts` に追加した検証で確認する。
- [x] 5.3 紙面の出典表示が仕様の4つの文字列を含むことを、2.3のHTML契約テストで確認する（追加の作業が生じた場合のみ再実行）。

## 6. 統合確認

- [x] 6.1 `npm test`、`npm run lint`、`npx tsc --noEmit` を実行し、すべて成功することを確認する。
- [x] 6.2 `npm run build` が成功し、ライセンスの依存一覧にMapLibre（BSD-3-Clause）が含まれることを確認する。
- [x] 6.3 本番ビルドをローカルで起動し、`POST /api/pdf/generate` に経路を送ってPDFを得る。地図の画素が平均彩度0.000でインク10.89%あり、出典が読め、経路・時刻・乗換・メモが従来どおり含まれることを確認する。タイル配信元を到達不能にした状態ではPDFではなく500の日本語メッセージが返ることを併せて確認する。
- [x] 6.4 作業文書の実測値と実装後の挙動を突き合わせ、`design.md` の決定4と制約表を実装に合わせて更新した（WebGLのcanvasは `page.pdf` に載らないため、2Dのcanvasへ写して画像に置き換える方式へ変更）。
