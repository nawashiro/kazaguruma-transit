# Issue #27 対応メモ

## 変更概要
- Nostr取得をEOSE専用 (`getEventsOnEose`) とストリーミング (`streamEventsOnEvent` / `streamApprovals` / `streamApprovalsForPosts`) に分離し、重複排除＋時系列ソートを共通化。
- `/discussions/manage`・`/discussions`・`/discussions/[naddr]/approve` とバス停系コンポーネントで承認(4550)をストリーミング取得に切り替え、初期描画を即時化・誤った権限エラー点滅を防止。
- AuditLogSection をストリーミング化し、購読クリーンアップでリークを防止。
- ストリーミングAPIと manage ページの挙動を検証するテストを追加（モックは簡潔に）。

## 動作確認
- `npm test`
- `npm test -- src/lib/nostr/__tests__/nostr-service.test.ts`
- `npm test -- src/app/discussions/manage/__tests__/page.test.tsx`
