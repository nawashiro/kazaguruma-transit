# Tasks

## 1. 計測APIの置き換え

- [x] 1.1 `track(eventName, params)`のテストを[useGA.test.tsx](../../../src/lib/analytics/__tests__/useGA.test.tsx)へ先に書き、REDを確認する。開発環境ではログのみ、測定IDが空なら送信しないことを検証してから実装する。
- [x] 1.2 既存の`sendEvent(category, action, label, value)`を削除し、呼び出し元ゼロと`grep -rn "sendEvent" src`の結果が0件になることを確認する。
- [x] 1.3 [docs/how-to/analytics.md](../../../docs/how-to/analytics.md)のカスタムイベント節を`track(eventName, params)`の説明に更新し、記載例がそのまま型検査を通ることを確認する。

## 2. 運営者トラフィックの識別

- [x] 2.1 `?owner=1`で印を保存し、`?owner=0`で解除し、どちらもURLから`owner`を除去するテストを先に書き、REDを確認してから実装する。
- [x] 2.2 印がある場合にページビューとイベントへ`traffic_type=internal`、`user_type=owner`が付き、初期化が`debug_mode=true`になるテストを書き、REDを確認してから実装する。
- [x] 2.3 `?owner=1`付きで開いても画面表示・検索結果・共有URLが変わらないことを既存のページテストで確認する。

## 3. 入力過程の計測

- [x] 3.1 `useGeocodingSearch`に`field`を渡し、住所検索の結果を`place_search`（`field`、`outcome`）として送るテストを先に書き、REDを確認してから実装する。
- [x] 3.2 地点確定時に`place_select`（`field`、`source`）を、住所検索・施設一覧・GPS・施設詳細の各入口で送るテストを書き、REDを確認してから実装する。
- [x] 3.3 GPSの成功・拒否・タイムアウト・非対応を`gps_result`として送るテストを書き、REDを確認してから実装する。
- [x] 3.4 地点未確定の送信で`validation_failed`（`missing`）を送り、ページ遷移しないことをテストで確認してから実装する。

## 4. 経路検索と結果後の行動

- [x] 4.1 最終検索の送信時に開始時刻を`sessionStorage`へ保存するテストを先に書き、REDを確認してから実装する。
- [x] 4.2 結果ページのクライアント側で`route_search`を1回だけ送り、開始時刻を削除するテストを書く。結果URLの直接オープンと再読み込みでは送らないことも同じテストで確認してから実装する。
- [x] 4.3 PDF出力とカレンダー出力の開始時に`result_action`（`action=pdf`または`calendar`）を送り、結果ページを開いただけでは送らないテストを書き、REDを確認してから実装する。

## 5. GA4設定と手順書

- [x] 5.1 [docs/how-to/analytics.md](../../../docs/how-to/analytics.md)へ、イベントとパラメーターの一覧、カスタムディメンション5種とカスタム指標1種の登録、`?owner=1`の手順、データ保持14か月、履歴変更とフォーム操作の無効化、データフィルタの有効化手順を書く。記載したイベント名が`src`の実装と一致することを`grep`で確認する。
- [x] 5.2 データフィルタを「テスト」で1日置いた後、運営者の標準レポートが出ないことを確認してから有効化する手順になっていることを、文書を読み直して確認する（不可逆操作の前に確認を挟む）。

## 6. 統合確認

- [x] 6.1 `npm run lint`と`npm test`が通過することを確認する。
- [ ] 6.2 DebugViewで、入力画面から検索したときに`route_search`が1回だけ届き、`elapsed_ms`が付くことを確認する。
- [ ] 6.3 印の無いブラウザで検索し、翌日の標準レポートに`route_search`が出ること、`?owner=1`のブラウザでは出ないことを確認する。
- [ ] 6.4 探索レポートに「月次サマリ」（`route_search`の回数・ユーザー数）と「入力ファネル」（`page_view`→`place_select`→`route_search`→`result_action`）を保存し、四半期単位で見る手順を文書へ追記する。

## Workflow follow-up

- 実装と確認が終わったら、プロジェクトのレビュー要件を満たしたうえで変更をアーカイブする。
- アーカイブ後に`openspec/specs/usage-measurement/spec.md`と`analytics-privacy`の差分が反映されていることを確認する。
