# Tasks

## 1. 入力画面の案内差し替え

- [x] 1.1 HomeRouteForm.tsx の案内行を「最新の運行情報はこちら【千代田区公式】」のテキストで https://kazaguruma.bus-go.com/sp/sp-busgo.php へのリンクに差し替える（target="_blank"、rel="noopener noreferrer" を維持）。検証: 既存テストに加え、`npm run build` と、開発サーバーで入力画面を開き文言とリンク先を見る。

## 2. PDFの案内差し替えとQR参照の除去

- [x] 2.1 pdf/generate/route.ts のルートなしページで、文言を「最新の運行情報はこちら【千代田区公式】」に差し替える（URL併記なし）。検証: `npm run build` と typecheck。
- [x] 2.2 route.ts から `qrCodeUrl`、`finalQrCodeUrl`、`checkImageExists`、`getImageUrl`、`mapPlaceholderUrl` とQRブロックを削り、参照が残らないこと（`grep qrCodeUrl src/` が空、`map_placeholder` も route.ts 内で検索されない）。検証: typecheck と grep の空結果。

## 3. 全体確認

- [x] 3.1 `npm run build`・lint・typecheck が通ること、入力画面のリンクをブラウザで開きバスロケーションシステムが表示されること。検証: コマンド出力と開発サーバーでの表示確認。
