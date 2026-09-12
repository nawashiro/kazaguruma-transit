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

## 実装検証記録

- 実装前ベースライン: 既存の対象テストを基準シナリオとして記録し、実装後に同じテスト群を再実行する。
- 実装後: `npx tsc --noEmit`、対象テスト、`npm run lint`、`npm test -- --runInBand`、`npm run build` を実行し、いずれも終了コード0を確認した。
- 009性能: 実relayのp95測定は環境依存のため、T053で同一環境の実装前後値を記録する。
- Red-team: 009 read境界、RubyWrapper、PDF Puppeteer境界、大規模ページ非分割、全画面一括移行なしを差分確認し、逸脱なし。
- 手動受け入れ: 自動テストとbuildで検証可能な状態を確認した。実relay接続、実ブラウザ、実PDFの目視確認は環境依存のため別途実施する。

### ブラウザ目視確認（2026-07-14）

- production serverを`http://127.0.0.1:3000`で起動し、Chromium headlessで `/` と `/locations` をデスクトップ（1440px）・モバイル（390px）表示した。
- 全4画面でHTTP 200/304、ページエラー0、コンソールエラー0を確認した。
- 全4画面で`document.documentElement.scrollWidth === window.innerWidth`となり、横スクロールを確認しなかった。
- ホームの目的地検索ボタン、場所一覧の現在地・検索・施設詳細ボタンにアクセシブルな名前が付いていることを確認した。
- ルビON表示、モバイルメニュー、DaisyUIカード・ボタンの角丸、施設カード、フッターをスクリーンショットで目視確認した。
- 実relayを使う検索結果、PDFの実ファイル内容、APIエラーを強制した画面は、この環境では外部状態に依存するため未確認とした。
