# Tasks

## 1. CSS検査を jest へ移す

- [x] 1.1 `scripts/__tests__/button-color-scope.test.ts` を作り、`node:test` の `test` / `assert` を jest の `it` / `expect` へ置き換える。検査内容（`--color-primary`・`--color-secondary`・`--focus-color` 系の宣言が `.transit-button` と `.my-toggle` の内側に留まること）は変えない。`NODE_ENV=test npx jest --selectProjects unit --testPathPattern "button-color-scope"` が green になることを確認する。
- [x] 1.2 `scripts/__tests__/button-color-scope.test.mjs` を削除し、`npm run test:unit` が green のままであることを確認する。

## 2. ブラウザ検証のコマンドと文書

- [x] 2.1 `package.json` に `test:skip-link` を追加する。`start-server-and-test` で `next start` を3000に起動し、`node --test scripts/__tests__/skip-link-targets.test.mjs` を実行して、終了時にサーバを停止する。
- [x] 2.2 `npm run build` のあと `npm run test:skip-link` を実行し、green になり、終了後に `ss -ltn` で3000ポートが解放されていることを確認する。
- [x] 2.3 `docs/reference/technology-stack.md` のコマンド表に `npm run test:skip-link` を追加し、`npm run build` が前提であることと、3000ポートを使うことを書く。

## 3. Quality Gate への組み込み

- [x] 3.1 `.github/workflows/quality-gate.yml` の Jest のステップのあとに `npm run test:skip-link` のステップを追加する。YAML として読み込めることを確認する（`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/quality-gate.yml'))"`）。

## 4. 統合確認

- [x] 4.1 `npm test` が green になり、unit のスイート数が197から198に増えている（`.mjs` は元からjestの数に入っていなかった）ことを確認する。
- [x] 4.2 `npx tsc --noEmit` がエラーなし、`npm run lint` がエラーなしで通ることを確認する。

## Workflow follow-up

- レビューを経てから `openspec archive` でこのチェンジをアーカイブする。
- アーカイブ後の `openspec/specs/test-infrastructure/spec.md` に2つの要件が入っていることを確認する。
