# Proposal

## Why

`scripts/__tests__/button-color-scope.test.mjs` と `scripts/__tests__/skip-link-targets.test.mjs` は `node:test` で書かれているが、`package.json` のどのスクリプトからも、`.github/workflows/quality-gate.yml` からも実行されていない。どちらも現在のコードでは通るのに、誰も走らせないので、壊れても気づけない。

前者はブランド色の上書きが共有ボタンとルビ切り替えの外へ漏れないこと、後者はキーボード操作のスキップリンクがヘッダーの操作要素に隠れず `main` へ到達することを確かめている。どちらもアクセシビリティ方針が実装に効いているかを見る検査であり、実行されないまま残す理由がない。

## What Changes

- `button-color-scope` を jest の unit プロジェクトへ移す。`npm test` と Quality Gate がそのまま実行する。
- `skip-link-targets` は puppeteer で実ブラウザを動かすため `node:test` のまま残し、production ビルドを起動してから実行する npm スクリプト `test:skip-link` を用意する。
- Quality Gate に `test:skip-link` のステップを足す。
- すべてのテストファイルが実行経路を持つことを仕様に明記する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `test-infrastructure`: テストファイルの実行経路と、Quality Gate がブラウザ検証も実行することを追加する。

## Impact

- `scripts/__tests__/button-color-scope.test.mjs` → `scripts/__tests__/button-color-scope.test.ts`
- `scripts/__tests__/skip-link-targets.test.mjs`（`node:test` のまま残す）
- `package.json`（`test:skip-link` の追加）
- `.github/workflows/quality-gate.yml`
- `docs/reference/technology-stack.md`（コマンド表に追記）
