# EOSE/Timeout Observability Note

## 背景

現状の discussion 実装では、読み取り完了判定に EOSE 依存が混在している。
一方で実運用の relay では、EOSE 未送信または遅延送信（15秒超）があり得る。
このため、以下の誤判定が発生する:

- 取得処理が `fetchEvents` の完了待ちで戻らず、画面が読み込み中のままになる
- ストリーム側の固定タイムアウトで `not found` へ遷移し、遅延到着イベントを取りこぼす

## 目的

「逐次返事が来ていて遅い」のか「沈黙して遅い」のかを区別可能にし、
UI とログが誤判定しないようにする。

## 判定モデル

### 収集する観測値

- `eventCount`: 受信イベント総数
- `lastEventAt`: 最後に `onEvent` を受けた時刻
- `startedAt`: 処理開始時刻
- `eoseReceived`: EOSE を受信したか

### 完了理由 (`completionReason`)

- `eose`: EOSE 受信で正常完了
- `idle-timeout`: 一定時間 `onEvent` がなく沈黙したため打ち切り
- `hard-timeout`: 全体上限時間に到達して打ち切り
- `cancelled`: 画面遷移等で明示停止

### 状態判定

- 逐次返事あり遅延: `eventCount > 0` かつ `now - lastEventAt` が短い
- 沈黙遅延: `eventCount === 0` または `now - lastEventAt` が閾値超過

## 実装原則

1. `onEose` と `timeout` を同一扱いしない（理由を必ず区別する）
2. 画面の `Not Found` 判定を「timeout直後」に確定しない
3. 監査/一覧/詳細の初回読込は、EOSE依存の無期限待機を避ける
4. 監査追加取得（10件）は引き続き再クエリ方式を維持する

## 仕様整合（ストリーミング要否）

spec008 の FR では、監査は「`limit=10` の再クエリ」と「状態表示」が要件であり、
リアルタイム push 表示は必須要件に含まれていない。
したがって、discussion の主要画面でストリーミングを前提にする実装は、
要件上の必須ではなく、むしろ EOSE 非依存の安定取得を優先すべきである。

## 次フェーズでの反映候補

- `NostrService` に `completionReason` を返す read API を追加
- `fetchEvents` 依存箇所に `idle/hard timeout` を実装
- `not found` 表示条件を `completionReason` ベースへ変更
- ログに `completionReason`, `eventCount`, `elapsedMs` を常時出力
