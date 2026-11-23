# Proposal

## Why

現在のGA送信はページビューだけで、利用の実態（経路検索が何回成功したか、どこで迷って戻ったか）を測る手段がない。カスタムイベントは未実装で、`form_submit`はGA4の自動計測が拾う汎用イベントのため、経路検索・住所検索・GPSのどれなのか区別できない。さらに運営者自身の動作確認がそのまま混ざり、もともと小さい母数の数字を濁らせている。

## What Changes

- 運営者のブラウザを明示的に識別する。`?owner=1`を一度開くと端末ごとに印を保存し、以後の送信に内部トラフィックの印を付ける。IPに依存しない。
- 明示イベントを6つ追加する：`route_search`、`place_search`、`place_select`、`gps_result`、`validation_failed`、`result_action`。座標・住所・停留所名は送らない。
- 汎用の`sendEvent(category, action, label, value)`を、GA4のイベント名とパラメーターを渡す形に置き換える。呼び出し元は現状ゼロなので互換維持はしない。
- GA4側の設定（データ保持14か月、履歴変更とフォーム操作の自動計測をオフ、内部・開発者トラフィックの除外）を手順書へ記録する。
- 利用者向けの画面、URL、経路検索の挙動は変えない。

## Capabilities

### New Capabilities

- `usage-measurement`: 経路検索の実行と迷いどころをGA4で測るためのイベント契約、および運営者トラフィックの識別。

### Modified Capabilities

- `analytics-privacy`: イベントパラメーターにも位置情報・住所・停留所名を含めない要件を追加する。

## Impact

`src/lib/analytics/useGA.ts`、`src/components/features/HomeRouteForm.tsx`、`DestinationSelector.tsx`、`OriginSelector.tsx`、`useGeocodingSearch.ts`、`RouteResultActions.tsx`、`docs/how-to/analytics.md`、GA4プロパティ設定。依存パッケージの追加なし。サーバー側の保存なし。
