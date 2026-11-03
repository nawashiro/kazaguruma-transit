# Design

## Context

大元の現状は proposal.md のとおり。本番サーバ依存の4スイートは `transit-production.test.ts` と `location-pages-404.test.ts`・`location-pages-origin-runtime.test.ts` で、既定の `http://127.0.0.1:3100` を `*_BASE_URL` 環境変数で上書きできる。CI（quality-gate）は `npm start` で `PORT=3100` を立ててから `npm test -- --runInBand --ci` とする現行順 のままである。

## Goals / Non-Goals

**Goals:**

- `npm test`（ローカル）と CI の両方で、暗黙の前提なく同じ挙動になること。
- unit プロジェクトの並列化。
- skip 専用テスト8件の除去。

**Non-Goals:**

- dev push での CI 実行の追加（quality-gate のトリガー変更はしない）。
- テストの書き換えやカバレッジ改善（除去対象以外）。
- コンテナの dev-env ラッパや、コンテナの常駐3100プロセスの管理（検出して流用するだけで済ませる）。

## Decisions

- **jest projects分割**: `jest.config.js` を `projects: []` にする。unit プロジェクトは `testPathIgnorePatterns` に本番サーバ依存ディレクトリ3つ（`src/app/api/__tests__/` かつ `transit-production`、`src/app/__tests__/location-pages-`）を載せる。serverプロジェクトは `testPathIgnorePatterns` を空にせず、先頭の `transit-production.test.ts` と `location-pages-` を検出するよう絞る。
- **globalSetup/globalTeardown**: server プロジェクトのみに設定する（unit では無意味なために起動しない）。実装は scripts/global-setup.mjs で `node:child_process` を使うため jest config 側は `globalSetup: "<rootDir>/scripts/global-setup.mjs"` 形式のまま書く。
- **既存サーバの判定と流用**: 起動前に `http://127.0.0.1:3100/` への get で応答可能か確認し、応答できれば流用とする。全部のテスト対象が root パスまで応答できれば十分。ss / lsof には依存しない。
- **自動ビルド**: `.next/BUILD_ID` の存在を確認し、無い場合のみ globalSetup で `npm run build` を同期実行する。実行時間はサイクル初回のみ重く、二回目以降は build をしない。
- **PORTの安定性**: `next start` には `PORT=3100` を渡し、PID を globalSetup からテストへ共有する（`).jest/server.pid` 等のファイルで渡す）。globalTeardown このファイルから PID を読み、自分が起動したものだけを `SIGTERM`→（短い待機→`SIGKILL`）で止める。既存サーバを流用した場合は teardown は何もしない。
- **test script**: `package.json` に `test: NODE_ENV=test jest`、`test:watch`、CI 用に `test:unit: NODE_ENV=test jest --selectProjects unit --ci`、`test:server: NODE_ENV=test jest --selectProjects server --runInBand --ci` の4本。`npm test` はどちらも流用可能な表現にして（両プロジェクト実行）、CI は unit → server の2段に分解する。
- **手動モック**: `src/components/features/__mocks__/DestinationSelector.tsx`・`OriginSelector.tsx` を作り props を素通しで stub にする。HomeRouteForm テストは factory 無し `jest.mock("../DestinationSelector")` 等に替える。他のスイートが既存の factory/mock 방법を保持する（自前モックの置き換えはしない）。
- **skip テストの除去**: 12件。8件はプレースホルダや旧リクエスト形のままのテスト3ファイル。残り4件は `transit-manager.test.ts` のもので、対象の `TransitManager` 自体は `transit-cache-rebuild` が実使用するためモジュールは保持し、実体をほぼ持たないテストファイル（スキップ4件＋シングルトン単一assert1件）だけを除去する。動作保証は transit-cache-rebuild（実DB結合）と API レベルの transit-production が担う。

## Risks / Trade-offs

- globalSetup が build や起動を失敗させるとテストが先に落ちて原因が見えにくい。スクリプトは失敗時に明示的なメッセージを出す。
- 既存3100サーバが「response はするがテスト対象 API が正しくない」場合を検出できない。unit プロジェクトの後に server プロジェクトが動くため、その場合は当該テストで落ち、原因への手がかりは main 遷移 por メッセージの分（3010とは異なる単一ポート固定）。
- jest projects 化により CLI オプション（`--testPathPattern` 等）の挙動が変わる可能性がある。既存コマンド使用例（`npm test -- --testPathPattern X`）は維持する。
