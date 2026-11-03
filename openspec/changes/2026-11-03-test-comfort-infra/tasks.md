# Tasks

## 1. skip済みテストの除去

- [x] 1.1 `src/app/api/__tests__/nearest-stop.test.ts`・`src/app/api/__tests__/transit.test.ts` を削除し、既存テスト全量がテストスイート数・テスト数とも欠損なく流れることを `npm run test:unit` で確認する。`discussion/integration.test.ts` は skip 1件と緑の回帰10件が同居するため削除せず全文を残す。
- [x] 1.2 `src/lib/db/__tests__/transit-manager.test.ts`（skip済み4件を含む）を削除し、`transit-manager.ts`・`database.ts` は保持する。対象モジュールは `transit-cache-rebuild` が実使用する。検証: `transit-cache-rebuild` を含む全テスト緑。

## 2. 並列化のためのプロジェクト分離とサーバ自動管理

- [x] 2.1 `scripts/global-setup.mjs`・`scripts/global-teardown.mjs` を作成する。既存3100サーバの検出・流用、`.next/BUILD_ID` 無し時の build、`PORT=3100` でのサーバ起動と PID 記録、teardown での自分起動分のみ停止。検証: `next start` 出力・グレースフル終了・PID ファイルの後始末を手動ロジックで確認。
- [x] 2.2 `jest.config.js` を projects 2分割（unit=並列可能・server=globalSetup+serial）にし、`package.json` に `test:unit`・`test:server` を追加する。検証: `npm run test:unit`（並列）と `npm run test:server` を回して本番サーバ依存スイートが server 側のみに認識されること。

## 3. テストコマンドのenv固定とモックの整理

- [x] 3.1 `package.json` の `test`・`test:watch` を `NODE_ENV=test` 付きに変更し、コンテナの `NODE_ENV=production` で `npm run test:unit` が通ることを確認する。
- [x] 3.2 `src/components/features/__mocks__/DestinationSelector.tsx`・`OriginSelector.tsx` を作り、HomeRouteForm テストを factory 無し `jest.mock` に書き替える。検証: `npm run test:unit` 全量。

## 4. CI workflow の2段階化

- [x] 4.1 `.github/workflows/quality-gate.yml` の Jest 段階を `npm run test:unit:ci` を並列後、`npm run test:server:ci` を serial の2stepに分解し、`npm start` で立てていた3100と `RUNNER_TEMP` の PID 管理ステップを jest に任せる。検証: workflow YAML の構文確認（act 等でのローカル実行は行わない）。

## 5. 全体確認

- [x] 5.1 `npm test`（両プロジェクト・`NODE_ENV=test`）が、サーバ未起動・ビルド済み・既存サーバ稼働の3状態で通ることを確認し、`npm run lint`・`tsc --noEmit` も通す。検証: 各実行ログ。

## 6. レビュー指摘対応

- [x] 6.1 `scripts/global-setup.mjs` の `pidsListeningOnPort` を `/proc/net/tcp(6)` の inode 列（第10列）から取得するよう修正し、LISTEN 中のソケットに対し当該 PID を返すことを実リスナーで確認する。
- [x] 6.2 `src/lib/discussion/__tests__/integration.test.ts` を dev から復元し、proposal・design・tasks の件数と削除範囲の記述を実態に合わせる。
- [x] 6.3誤コミット `nohup.out` をリポジトリから除去し `.gitignore` に追加する。
- [x] 6.4 unit 側の `testPathIgnorePatterns` をサーバ依存2ファイルに絞り、`location-pages-responsive-contract.test.tsx` が実行対象に復帰することを `npm run test:unit` の検出数で確認する。
