# Proposal

## Why

データ提供元カードの文言を変えたコミット（`85aff01`）が、その文言を検証する `page.visual-contract.test.tsx` を更新しなかった。unit プロジェクトは1件赤のまま残り、テストは現在の画面を検証していない。

`npm test` の server プロジェクトも同じ種類のずれを抱える。テスト実行系は `.next/BUILD_ID` があるだけで production ビルドを省略するため、中断したビルドが `.next` を上書きしていると、`next start` は `routesManifest.dataRoutes` を読めずに落ちる。テストは「サーバが応答しない」と報告し、コードの不具合と区別がつかない。実際にこの状態を踏んだ。

どちらも、テストが現在のコードを検証していないことに気づけない問題である。

## What Changes

- データ提供元カードの視覚契約テストを、現在の文言と4本のリンク（データの取り込み先、WheelMap、OpenStreetMap、訂正フォーム）に合わせる。参照されていない定数を削除する。
- production ビルドを省略してよい条件を、`BUILD_ID` の存在から「`next start` が読む manifest が揃っていること」に変える。揃っていなければビルドを実行する。
- 判定を `scripts/production-build.ts` に切り出し、unit テストで固定する。globalSetup と globalTeardown を TypeScript へ移す。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `test-infrastructure`: 既存のビルド成果物を再利用してよい条件を、`BUILD_ID` の存在から成果物の健全性へ変える。

## Impact

- `src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx`
- `scripts/global-setup.mjs` → `scripts/global-setup.ts`
- `scripts/global-teardown.mjs` → `scripts/global-teardown.ts`
- `scripts/production-build.ts`（新規）、`scripts/__tests__/production-build.test.ts`（新規）
- `jest.config.js` の `globalSetup` / `globalTeardown`
