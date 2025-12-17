# Issue #27 ストリーミング対応サマリ

## 目的
- `EOSE` を待たず「受信したら即画面に反映」する経路を標準にする。
- 例外は明示的に `EOSE` が必要な箇所（現状 `src/app/discussions/[naddr]/page.tsx` のみ）。

## 主要変更点
- Nostr 取得をストリーミング優先に統一（BusStop 系、承認ページ、監査ログ、会話一覧）。
- `streamEventsOnEvent` を同期 `EOSE` にも安全な構造に修正し、タイムアウト/クリーンアップを安定化。
- ストリーム挙動を担保する軽量テストを追加（即時反映とブロックの排除を検証）。

## 運用メモ
- 新規コンポーネントは `getEventsOnEose` をデフォルトに使わず、`streamEventsOnEvent` と `streamApprovals(ForPosts)` を優先。
- テストではストリームモックを用いて「初期描画がブロックされないこと」を確認する。
