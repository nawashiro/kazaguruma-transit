# Tasks

## 1. テスト向け lint 設定の変更

- [x] 1.1 `eslint.config.mjs` のテスト向け override で `@typescript-eslint/no-explicit-any` を `"off"` にし、`npx eslint --print-config src/app/settings/__tests__/page.streaming.test.tsx` の出力で重大度が 0 になることを確認する
- [x] 1.2 本番コード向けの設定が `"error"` のままであることを `npx eslint --print-config src/app/page.tsx` の出力で確認する
- [x] 1.3 `npm run lint` を実行し、テスト配下の `@typescript-eslint/no-explicit-any` 警告が0件で、error 0 のままであることを確認する

## 2. 統合確認

- [x] 2.1 `npx tsc --noEmit --incremental false` を実行し、型検査が通ることを確認する
- [x] 2.2 `openspec validate disable-any-lint-in-tests --strict` を実行し、警告なしで通ることを確認する
