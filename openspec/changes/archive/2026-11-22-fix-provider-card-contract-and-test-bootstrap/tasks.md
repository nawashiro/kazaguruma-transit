# Tasks

## 1. データ提供元カードのテスト追随

- [x] 1.1 `npm run test:unit` を実行し、`src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx` の1件だけが赤であることを確認する。失敗メッセージに「千代田区の主要施設を表示しています。」の不在が出ていること。
- [x] 1.2 同テストのデータ提供元カード検証を、現行の3段落と4本のリンク（千代田区区民施設向けデータ、WheelMap、OpenStreetMap、こちらのフォーム）に合わせる。リンクは `getAllByRole("link")` の本数と各 `href` で固定する。リンクを含む段落は `getByText` が直接のテキストノードだけを見るため、段落の検証は部分一致にする。
- [x] 1.3 参照されていない `DATA_PROVIDER_SOURCE_DESCRIPTION` と `DATA_PROVIDER_CORRECTION_DESCRIPTION` を削除し、`DATA_PROVIDER_SOURCE_HREF` をリンクの `href` 検証に使う。
- [x] 1.4 `NODE_ENV=test npx jest --selectProjects unit src/app/locations/\[category-id\]/__tests__/page.visual-contract.test.tsx` が green になり、`npm run lint` から当該ファイルの未使用変数の警告が消えることを確認する。

## 2. ビルド成果物の健全性判定

- [x] 2.1 `scripts/__tests__/production-build.test.ts` を書き、正常な成果物、`BUILD_ID` の欠落と空文字、`routes-manifest.json` の `dataRoutes`・`dynamicRoutes` が配列でない、JSON の解析失敗、`prerender-manifest.json` の `routes` 欠落、`server/pages-manifest.json` の欠落を検証する。未実装の `scripts/production-build.ts` を import して RED になることを確認する。
- [x] 2.2 `scripts/production-build.ts` に `isProductionBuildUsable(nextDir)` を実装し、2.1 の unit テストが green になることを確認する。
- [x] 2.3 `scripts/global-setup.mjs` と `scripts/global-teardown.mjs` を `.ts` へ移し、`jest.config.js` の `globalSetup` と `globalTeardown` を更新する。globalSetup は `.next/BUILD_ID` の存在確認ではなく `isProductionBuildUsable` でビルドの要否を決める。`npm run test:server` が green になり、TypeScript の globalSetup が読めることを確認する。
- [x] 2.4 正常な `.next` がある状態で `npm run test:server` を実行し、production ビルドが走らないまま（ビルドの出力が出ないまま）green になることを確認する。揃った成果物を不健全と判定していないことの確認になる。
- [x] 2.5 `.next/routes-manifest.json` から `dataRoutes` を削った状態で `npm run test:server` を実行し、production ビルドが走ったうえで server プロジェクトが green になることを確認する。確認後、`.next` が再ビルドされた状態に戻っていること。

## 3. 統合確認

- [x] 3.1 `npm test` を実行し、unit 197スイートとserver 4スイートがすべて green になることを確認する。
- [x] 3.2 `npx tsc --noEmit` がエラーなし、`npm run lint` がエラーなしで通ることを確認する。
- [x] 3.3 `npm test` の終了後に `ss -ltn` で3100ポートが解放されていることを確認する。

## Workflow follow-up

- レビューを経てから `openspec archive` でこのチェンジをアーカイブする。
- アーカイブ後の `openspec/specs/test-infrastructure/spec.md` が更新されていることを確認する。
