# Proposal

## Why

テストはCIとローカルで立て方の前提が揃っておらず、本番サーバ依存の3スイート（`transit-production`・`location-pages-404`・`location-pages-origin-runtime`）は「3100で誰かがサーバを起動している」ことと偶然一致しないと通らない。また jest が `NODE_ENV=production` で落ちる、モックファクトリに `__esModule: true` が要るといった暗黙の前提があり、ローカルでテストが失敗すると原因の切り分けに時間がかかる。実装移転後に残った skip 済みのテストもノイズになっている。

## What Changes

- jest を2プロジェクトに分割する。本番サーバに依存しない unit プロジェクトは並列で動き、`transit-production`・`location-pages-404`・`location-pages-origin-runtime` で構成する server プロジェクトは serial で動く。
- jest の globalSetup が server プロジェクトの実行前に3100サーバを用意する。健全なサーバが既に動いているならそれを流用し、無ければ production ビルドが無い場合のみ `npm run build` したうえで `next start` を立てる。globalTeardown は自分が立ち上げたサーバだけを停止する。
- `test`・`test:watch` を `NODE_ENV=test` で実行する。jest はコンテナの `NODE_ENV=production` に影響されなくなる。
- 選択器コンポーネント（DestinationSelector・OriginSelector）の手動モックを作り、`HomeRouteForm` のテストはモックファクトリ無しの `jest.mock` に替える。
- skip 済みテスト11件を破壊的に除去する。計7件は `nearest-stop.test.ts`・`transit.test.ts` に置かれたプレースホルダや現行と異なるリクエスト形のもの。残り4件は `transit-manager.test.ts` に置かれたもので、対象の `TransitManager` 自体は live である（`transit-cache-rebuild` が実使用する）ため、モジュールは保持しテストファイルだけを除く。`discussion/integration.test.ts` は skip 1件だけでなく緑の回帰10件を含むため、削除対象から外して全文を残す。
- CI workflow は同2段階（unit を並列、server を serial）に合わせて分ける。dev push で CI を回す変更は、このchangeのために行わない。

## Capabilities

### New Capabilities

- `test-infrastructure`: ローカル・CI間で前提が揃い、一発のコマンドでテストが回るための挙動（自動起動、分離、env不変性）を扱う。

### Modified Capabilities

## Impact

- `package.json`・`jest.config.js`・新規 `scripts/global-setup.mjs`・新規 `src/components/features/__mocks__/`
- 削除: `src/app/api/__tests__/nearest-stop.test.ts`・`src/app/api/__tests__/transit.test.ts`・`src/lib/db/__tests__/transit-manager.test.ts`
- `.github/workflows/quality-gate.yml`（jest の段階を2つに分ける。CI運用の追加はしない）
