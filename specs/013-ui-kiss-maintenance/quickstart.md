# Quickstart: UI KISS観点の整備

## 前提

- リポジトリルート `/home/navi/kazaguruma-transit` で実行する。
- Node.js/npm、依存関係、テスト用設定が準備済みであること。
- PDF APIの検証には既存の `NEXT_PUBLIC_APP_URL`、Google Maps設定、Puppeteer実行環境が必要になる場合がある。

## 1. 対象単体テスト

変更した順に、まず共通変換とUIのテストを実行する。

```bash
npm test -- --runInBand \
  src/components/ui/__tests__/Button.test.tsx \
  src/components/features/__tests__/OriginSelector.test.tsx \
  src/components/features/__tests__/DestinationSelector.test.tsx \
  src/components/features/__tests__/IntegratedRouteDisplay.test.tsx \
  src/components/features/__tests__/RoutePdfExport.test.tsx \
  src/components/discussion/__tests__/BusStopDiscussion.streaming.test.tsx \
  src/components/discussion/__tests__/BusStopMemo.streaming.test.tsx
```

期待結果: 共通変換、loading/error、ARIA、PDFエラー、009のpartial/unknown/承認状態に関する対象テストが全件成功する。

## 2. 009保護テスト

```bash
npm test -- --runInBand \
  src/lib/discussion/__tests__/discussion-moderation-snapshot.test.ts \
  src/lib/discussion/__tests__/discussion-known-data-cache.test.ts \
  src/lib/discussion/__tests__/relay-candidate-selector.test.ts \
  src/lib/nostr/__tests__/nostr-service.test.ts
```

期待結果: read plan、relay候補、重複排除、source relay、partial/timeout/unknown、承認結合の挙動に回帰がない。

## 3. 静的検証

```bash
npm run lint
npm test -- --runInBand
```

期待結果: lintと全テストが成功する。共通UIの変更で既存画面のテストが壊れていない。

## 4. ビルド検証

```bash
npm run build
```

期待結果: Prisma/GTFSを含む既存build chainを通過し、Next.js production buildが成功する。

## 5. 手動受け入れ確認

1. 出発地・目的地で、成功、空結果、429、ネットワークエラーを確認する。
2. 直通、乗換、時刻不明、徒歩区間、停留所メモを画面とPDFで比較する。意味が一致し、レイアウト差は許容する。
3. PDF失敗後に、エラーが日本語で表示され、再試行できることを確認する。
4. BusStopで投稿、承認待ち、承認済み、評価、代表メモを確認し、表示面の承認状態が一致することを確認する。
5. 共通Buttonの通常、submit、loading、iconOnly、joined状態をキーボードで確認する。
6. ルビが利用可能・利用不能・遅延利用可能な状態で、通常テキストが欠落または二重表示されないことを確認する。

## 詳細契約

- 共通UI: [contracts/ui-component-boundary.md](contracts/ui-component-boundary.md)
- PDF入力: [contracts/pdf-route-input.md](contracts/pdf-route-input.md)
- 共有データ: [data-model.md](data-model.md)
- 009 Nostr read契約: [../../009-coracle-style-sync/contracts/discussion-read-contract.md](../../009-coracle-style-sync/contracts/discussion-read-contract.md)
