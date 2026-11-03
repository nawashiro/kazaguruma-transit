# Design

## Context

入力画面（HomeRouteForm.tsx）とPDF（pdf/generate/route.ts、ルートなしページ）に千代田区公式LINEの案内が残る。QR画像 chiyoda_line_qr.png はすでに削除されており、PDF側の参照は毎回 map_placeholder.png へのフォールバックとして動いている。差し替え先のバスロケーションシステム（https://kazaguruma.bus-go.com/sp/sp-busgo.php）は jQuery Mobile 構成のモバイルページで、HTTP 200と路線選択UIを確認済み。

## Goals / Non-Goals

**Goals:**

- 両所の案内リンクを公式バスロケーションシステムへ差し替える。
- PDF生成コードからQR関連の参照を破壊的に除去する。

**Non-Goals:**

- 新しいQRコードの生成・同梱。
- バスロケーションシステム側の改修や、その可用性の監視。
- lin.ee 以外の外部リンク・注意書きの見直し。

## Decisions

-文言は利用者指定の「最新の運行情報はこちら【千代田区公式】」とする。リンクテキスト自体を案内にするため、補足の説明行は増やさない。
- PDFはスマホが使えない利用者向けの前提とし、文言の差し替えのみとする。参照できないURLを紙面に併記しない。
- route.tsの map_placeholder.png 参照はQRフォールバックとしてのみ使われているため、QR除去に合わせて `qrCodeUrl`・`finalQrCodeUrl`・`checkImageExists`・`getImageUrl`・`mapPlaceholderUrl` と、QRブロックごと削る。画像はルートありページの地図でも使われるため public/images/map_placeholder.png は残す。

## Risks / Trade-offs

- 差し替え先のページは jQuery Mobile 1.2.0 の旧実装で、提供形態の変更リスクは区側の判断に委ねる。リンクの存在と文言だけを仕様にする。
- 公式LINEの入口を完全に外すため、LINEでの確認を好む利用者は入口を失う。これは今回の決定事項である。
