# Design

## Context

大元の現状は proposal.md のとおり。本番サーバ依存の3スイートは `transit-production.test.ts` と `location-pages-404.test.ts`・`location-pages-origin-runtime.test.ts` で、既定の `http://127.0.0.1:3100` を `*_BASE_URL` 環境変数で上書きできる。同ディレクトリの `location-pages-responsive-contract.test.tsx` は実ファイルへの静的な契約検査でサーバに依存しないため、unit 側で実行を続ける。CI（quality-gate）は `npm start` で `PORT=3100` を立ててから `npm test -- --runInBand --ci` とする現行順 のままである。

## Goals / Non-Goals

**Goals:**

- `npm test`（ローカル）と CI の両方で、暗黙の前提なく同じ挙動になること。
- unit プロジェクトの並列化。
- skip 専用テスト11件の除去。

**Non-Goals:**

- dev push での CI 実行の追加（quality-gate のトリガー変更はしない）。
- テストの書き換えやカバレッジ改善（除去対象以外）。
- コンテナの dev-env ラッパや、コンテナの常駐3100プロセスの管理（検出して流用するだけで済ませる）。

## Decisions

- **jest projects分割**: `jest.config.js` を `projects: []` にする。unit プロジェクトは `testPathIgnorePatterns` に本番サーバ依存テスト3ファイル（`src/app/api/__tests__/transit-production`、`src/app/__tests__/location-pages-404`、`src/app/__tests__/location-pages-origin-runtime`）を載せ、サーバ依存以外の unit テストが漏れないよう絞る。server プロジェクトは `testMatch` で上記3ファイルのみを拾う。
- **globalSetup/globalTeardown**: server プロジェクトのみに設定する（unit では無意味なために起動しない）。実装は scripts/global-setup.mjs と scripts/global-teardown.mjs。
- **既存サーバの判定と流用**: 起動前に `http://127.0.0.1:3100/` への GET で応答可能か確認し、応答できれば流用とする。ss / lsof には依存しない。
- **自動ビルド**: `.next/BUILD_ID` の存在を確認し、無い場合のみ globalSetup で `npm run build` を同期実行する。実行時間はサイクル初回のみ重く、次回以降は build をしない。
- **サーバ起動とPID管理**: `npm start`（import-gtfs でキャッシュを再構築する）を避け、`node node_modules/next/dist/bin/next start -p 3100` を直接起動する。PID 前提の停止は、next-server がプロセス群を engine から離脱させる挙動をしたため、teardown が SIGTERM 後に /proc/net/tcp と /proc/*/fd から 3100 の LISTEN socket の所有 PID を特定して確実に解放する（3000 など他ポートの next-server には触れない）。
- **test script**: `package.json` に `test`・`test:watch`（両プロジェクト実行）と、`test:unit`・`test:server`（並列・serial分離。`--runInBand` はserver側）を置く。CI は `test:unit:ci` → `test:server:ci` の2stepを使う。
- **手動モック**: `src/components/features/__mocks__/DestinationSelector.tsx`・`OriginSelector.tsx` を作り props を素通しで stub にする。HomeRouteForm テストは factory 無し `jest.mock("../DestinationSelector")` 等に替える。他のスイートが既存の factory/mock 방법を保持する（自前モックの置き換えはしない）。
- **skip テストの除去**: 11件。7件は `nearest-stop.test.ts`・`transit.test.ts` のプレースホルダや旧リクエスト形のままのテスト。残り4件は `transit-manager.test.ts` のもので、対象の `TransitManager` 自体は `transit-cache-rebuild` が実使用するためモジュールは保持し、実体をほぼ持たないテストファイル（スキップ4件＋シングルトン単一assert1件）だけを除去する。`discussion/integration.test.ts` は skip 1件と現行コードで通る回帰10件が同居するため除去対象から外し、実行中に検出されたため除去対象から外し、初回の削除判断は撤回する。動作保証は transit-cache-rebuild（実DB結合）と API レベルの transit-production が担う。

## Risks / Trade-offs

- globalSetup が build や起動を失敗させるとテストが先に落ちて原因が見えにくい。スクリプトは失敗時に明示的なメッセージを出す。
- 既存3100サーバが「応答するがテスト対象の API ではない」場合を流用側で検出できない。その場合は server プロジェクトのテストが落ち、globalSetup のログ（起動した/流用した）が手がかりになる。
- jest projects 化により CLI オプション（`--testPathPattern` 等）の挙動が変わる可能性がある。既存コマンド使用例（`npm test -- --testPathPattern X`）は維持する。
