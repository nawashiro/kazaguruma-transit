# Design

## Context

`eslint.config.mjs` は `@typescript-eslint/no-explicit-any` を全体で `error` にし、テスト向けの override で `warn` に落としている。`npm run lint` の現状は、この警告がテスト配下に49件出る。`next lint` は警告だけなら exit 0 で終わるため、警告はCIの合否に影響せず、出力のノイズだけが残る。

## Goals / Non-Goals

**Goals:**

- テストとテスト用モックの `any` を lint の警告としても出さない。
- 本番コードの `any` は引き続きエラーとして扱う。

**Non-Goals:**

- テストの既存 `any` の書き換え。
- `no-explicit-any` 以外の警告（未使用変数、hook 依存、`<img>`）の解消。
- `next lint` から ESLint CLI への移行。

## Decisions

### テスト向け override の値を `warn` から `off` にする

警告を消す手段は3つある。行ごとの `eslint-disable` は49行のコメントを増やし、テストの可読性を下げる。全体を `off` にすると本番コードの防御まで失う。既存の override の値を変えるのが最小で、対象の範囲も既にテストとモックに限定されている。よって `off` を選ぶ。

### 対象のglobは既存のままにする

`**/__tests__/**`、`**/*.test.ts(x)`、`**/__mocks__/**` は現在のテスト配置を網羅している。`*.spec.ts(x)` はリポジトリに存在せず、使っていないパターンを足さない。

## Risks / Trade-offs

- テストの `any` が型の誤りを隠す → 本番コードのエラーは維持し、テストも `tsc --noEmit` の型検査対象に残す。`any` は型エラーを消すが、テストの実行結果は別に検証される。
- テスト用の共有ヘルパーを `__tests__` の外に置くと再び警告が出る → そのときは配置か glob を意図的に見直す。今は該当ファイルがない。
- ルールを弱める判断が本番コードへ波及する → override はテスト用の glob に限定したままにする。
