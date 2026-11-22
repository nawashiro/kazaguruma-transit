# Proposal

## Why

`npm run lint` はテストコードの `any` にも警告を出し、現状49件の `@typescript-eslint/no-explicit-any` 警告が常時出力に混じる。テストではモックや境界値の組み立てに `any` を使う箇所があり、この警告はテストの可読性を上げず、本当に見るべき警告を埋もれさせる。本番コードでは `any` を禁止したまま、テストとテスト用モックだけを対象外にする。

## What Changes

- テストファイルとテスト用モックでは `@typescript-eslint/no-explicit-any` を報告しない（`off`）。
- 本番コードでは `@typescript-eslint/no-explicit-any` を `error` のまま維持する。
- テストに既存の `any` は書き換えない。警告だけを消し、テストの型を触らない。
- 対象は `**/__tests__/**`、`**/*.test.ts(x)`、`**/__mocks__/**` に置かれた TypeScript ファイルとする。

## Capabilities

### New Capabilities

- `lint-policy`: `any` の禁止をどのファイルに適用するかという、lint の適用手順を扱う。

### Modified Capabilities

なし

## Impact

- 変更するのは `eslint.config.mjs` のテスト向け override だけ。
- 本番コード、テストの実行内容、CI の合否には影響しない。警告は元々 exit code を変えていない。
- テスト側の `any` 49件はそのまま残る。
