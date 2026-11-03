# Tasks

## 1. skip済みテストの除去

- [x] 1.1 `src/app/api/__tests__/nearest-stop.test.ts`・`src/app/api/__tests__/transit.test.ts`・`src/lib/discussion/__tests__/integration.test.ts` を削除し、既存テスト全量がテストスイート数・テスト数とも欠損なく流れることを `npm run test:unit` で確認する。
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
