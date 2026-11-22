# Proposal

## Why

入力画面では「最新の運行情報」を千代田区公式LINEで確認できると案内しているが、風ぐるま公式のバスロケーションシステム（BusGO!、kazaguruma.bus-go.com）が利用できる。現在地がどこを走っているのかを紙面かLINEで確認するより、バスロケーションでの確認のほうが利用者にとって役立つため、リンク先を差し替える。PDFの案内文にも同様のLINE案内と、既に画像が削除されたQR参照（常にフォールバック画像へ読み替えられる）が残っており、あわせて整理する。

## What Changes

- 入力画面の最新運行情報の案内リンクを、千代田区公式LINE（lin.ee/CgIBOSd）から風ぐるま公式バスロケーションシステム（https://kazaguruma.bus-go.com/sp/sp-busgo.php）へ差し替える。文言は「最新の運行情報はこちら【千代田区公式】」とする。
- PDF（ルートが見つからない場合のページ）の案内文も同じ文言に差し替える。
- PDF生成コードから、存在しないQR画像（chiyoda_line_qr.png）への参照とそのフォールバック機構を破壊的に除去する。
- バスロケーションシステム自体の改修は行わない。

## Capabilities

### New Capabilities

### Modified Capabilities

- `route-search-form`: 入力画面に運行情報の案内リンクを示す要件が存在しないため、公式バスロケーションシステムへのリンクと文言を要件として追加する。

## Impact

- `src/components/features/HomeRouteForm.tsx`: 案内行の文言とリンク先の差し替え。
- `src/app/api/pdf/generate/route.ts`: 案内文の差し替えと、QR画像参照・フォールバック機構の除去。
- 外部サービス `kazaguruma.bus-go.com`（BusGO!、株式会社アチピレーションテクノロジー運営）へのリンクが新たに登場する。
