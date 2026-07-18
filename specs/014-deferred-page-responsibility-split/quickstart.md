# Quickstart: 後続ページ責務分離

## 前提

- リポジトリルート `/home/navi/kazaguruma-transit` で実行する。
- Node.js/npm、依存関係、Jest、ブラウザ確認環境が準備済みであること。
- Nostrの実環境確認には既存のrelay設定、PDF確認には既存のGoogle Maps・Puppeteer設定が必要になる場合がある。

## 1. 段階導入の確認

実装は必ず次の順で進め、各段階の対象テストと回帰確認を完了してから次へ進む。

1. 経路検索ページ
2. 場所一覧ページ
3. 会話タブのメタデータ取得境界

## 2. 経路検索ページ

対象テスト例:

```bash
npm test -- --runInBand \
  src/app/__tests__/page.test.tsx \
  src/app/api/__tests__/transit.test.ts \
  src/app/api/__tests__/pdf-route-contract.test.ts \
  src/components/features/__tests__/OriginSelector.test.tsx \
  src/components/features/__tests__/DestinationSelector.test.tsx \
  src/components/features/__tests__/IntegratedRouteDisplay.test.tsx \
  src/components/features/__tests__/RoutePdfExport.test.tsx
```

確認内容:

- URLの目的地ディープリンク、検索、再検索、リセット、ブラウザ履歴を維持する。
- 検索中、成功、経路なし、429、通信/API失敗、古い要求の破棄を確認する。
- 直通、乗換、時刻不明、徒歩区間、メモの意味が画面とPDFで一致することを確認する。

## 3. 場所一覧ページ

```bash
npm test -- --runInBand src/app/locations/__tests__/page.test.tsx
```

確認内容:

- 初期読み込み、最初のカテゴリ選択、カテゴリ切替、場所なしを確認する。
- 現在地の成功・拒否・失敗、住所検索の成功・空結果・レート制限を確認する。
- 距離順、詳細モーダル、閉じる、戻る遷移、モバイル幅を確認する。
- 古い位置・詳細要求が現在表示を上書きしないことを確認する。

## 4. 会話タブ

```bash
npm test -- --runInBand \
  src/components/discussion/__tests__/DiscussionTabLayout.test.tsx \
  src/app/discussions/[naddr]/__tests__/layout.test.tsx \
  src/lib/discussion/__tests__/discussion-known-data-cache.test.ts \
  src/lib/discussion/__tests__/relay-candidate-selector.test.ts \
  src/lib/nostr/__tests__/nostr-service.test.ts
```

確認内容:

- 初期、known-data、partial、unknown、completion、error、reloadを確認する。
- relay選択、重複排除、source relay、未観測を不在としない規則を確認する。
- タブURL、選択状態、戻るリンク、Arrow/Home/End、フォーカス、44px操作領域を確認する。

## 5. 共通検証

```bash
npx tsc --noEmit
npm run lint
npm test -- --runInBand
npm run build
```

期待結果: 型検査、lint、全テスト、既存のPrisma/GTFS/Next.js build chainを含むproduction buildが成功する。

## 6. 性能・手動受け入れ

- 実装前後で同一環境・同一代表シナリオの `/api/transit` と `/api/geocode` のAPI応答p95を測定し、各p95が200ms以内で、実装後がベースラインを10%超上回らないことを記録する。
- `/` と `/locations`をデスクトップ・モバイル幅で開き、横スクロール、ページエラー、コンソールエラー、表示崩れがないことを確認する。
- 実relay環境で会話のpartial/timeout/unknownを確認する。実環境で測定できない場合は未確認理由を記録する。
- 見た目の変更は原則なく、アクセシビリティ修正・明らかな表示不具合だけが差分に含まれることをred-team確認する。

## 詳細契約

- 責務境界: [contracts/responsibility-boundaries.md](contracts/responsibility-boundaries.md)
- 状態モデル: [data-model.md](data-model.md)
- 009 read契約: [../../009-coracle-style-sync/contracts/discussion-read-contract.md](../../009-coracle-style-sync/contracts/discussion-read-contract.md)
- 013 UI境界: [../013-ui-kiss-maintenance/contracts/ui-component-boundary.md](../013-ui-kiss-maintenance/contracts/ui-component-boundary.md)

## 実装前ベースライン

2026-07-14時点の実装前ベースラインは、経路検索ページ、場所一覧ページ、会話タブの既存テストを実行して記録する。実装後は同一コマンドを再実行し、テスト結果、URL・履歴、表示状態、Nostr read契約の差分を比較する。

## 実装結果（2026-07-14）

- 実装前対象テスト: 3スイート21テストが通過。
- 実装後対象テスト: 80スイート中80スイートが通過、424テスト通過（17テストは既存のskip）。
- `npx tsc --noEmit`: 通過。
- `npm run lint`: 通過。既存コード由来のwarning（`any`、既存Hook依存、既存`img`）のみ。
- `npm run build`: Prisma generate/db push、GTFS import、Next.js production buildを通過。
- production smoke: `/`、`/locations`、`/discussions` がHTTP 200。
- API測定（ローカルproduction server、各12回、レート制限回避のため要求ごとに異なるローカルIPヘッダー）: 実装前 `/api/geocode` p95 0.188秒・`/api/transit` p95 0.048秒、実装後 `/api/geocode` p95 0.185秒・`/api/transit` p95 0.047秒。いずれも200ms以内で、実装後の悪化はありません。
- 手動確認のうち、DOMベースのURL・ARIA・キーボード・表示状態は対象テストで確認した。実ブラウザのデスクトップ/モバイル視覚確認と実relay上のpartial/timeout確認は、このCLI実行環境では未実施。
- 実装前後とも同一環境・同一代表リクエスト・各12回で測定し、p95 200ms以内およびベースライン比10%超の悪化なしを確認した。
