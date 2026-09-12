# Data Model

## DiscussionReadTarget

`"discussion-list" | "discussion-meta" | "discussion-approvals" | "discussion-evaluations" | "discussion-audit" | "discussion-edit"`

画面目的を表す識別子。目的ごとに許可filter・relay上限・timeoutが決まる。

## DiscussionReadPlan

| Field | Type | Rule |
|---|---|---|
| `target` | `DiscussionReadTarget` | 読み取り目的 |
| `filters` | `NdkEventFilter[]` | 目的外kind/tagを含めない |
| `relayHints` | `string[]` | naddr・イベント由来の候補 |
| `limit` | `number` | 監査は常に10 |
| `idleTimeoutMs` | `number` | `DiscussionReadStrategyConfig`の範囲内 |
| `hardTimeoutMs` | `number` | idleより大きい |

## RelayCandidate

| Field | Type | Rule |
|---|---|---|
| `url` | `string` | 有効なws/wss URL |
| `source` | `"hint" | "recommended" | "successful" | "configured" | "default"` | 優先根拠 |
| `lastSuccessAt` | `number \| null` | 成功実績があれば保持 |

選別後のURLは重複なし、初回は最大3件。候補不足時はconfigured/defaultを追加する。

## DiscussionReadResult

| Field | Type | Rule |
|---|---|---|
| `events` | `NostrEventDTO[]` | ID重複なし、created_at降順、同時刻はevent ID昇順 |
| `completionReason` | `CompletionReason` | 既存4種類を保持 |
| `isPartial` | `boolean` | EOSE以外でtrue |
| `relayUrls` | `string[]` | 実際に要求した候補 |
| `duplicateCount` | `number` | 表示対象から除外したID重複数 |
| `elapsedMs` | `number` | 観測ログ用 |
| `usedKnownData` | `boolean` | 暫定値を使ったか |

## KnownDiscussionData

会話IDごとに、最新会話メタデータ、既知イベントID、問い合わせ済みrelay、対象イベントを実際に返したrelay（イベントID別source relay）、保存時刻を持つ。正規の成功実績フィールドは`successfulEventRelayUrls`とし、旧`successfulRelays`は移行期間の読み取り互換に限る。`sessionStorage`にversion付きJSONで保存し、relay結果を受けるたびにIDでマージする。問い合わせただけのrelayは成功実績に含めない。既知イベントと承認状態は暫定材料であり、relay readなしに確定しない。

## DiscussionModerationSnapshot

同一会話の投稿・申請イベント、承認イベント、relay選別結果、完了状態をまとめた画面横断の読み取り結果。詳細、承認、監査は投稿IDと承認イベントの`e` tagをこのスナップショット内で結合する。

| Field | Type | Rule |
|---|---|---|
| `primaryEvents` | `NostrEventDTO[]` | 投稿・申請のevent IDで重複排除した集合 |
| `approvalEvents` | `NostrEventDTO[]` | 対象投稿IDに結び付くkind 4550のID重複なし集合 |
| `relayCandidates` | `RelayCandidate[]` | hint・推奨・成功・設定・既定を同じ入力から選別 |
| `initialRelayUrls` | `string[]` | 初回readで使う最大3 relay |
| `attemptedRelayUrls` | `string[]` | 初回・再読取を通じて実際に問い合わせたrelay |
| `nextRelayUrls` | `string[]` | 未応答・partial時に次回候補となる未試行relay（最大3件） |
| `completionReason` | `CompletionReason` | 未観測の承認を未承認と確定できるか判断する根拠 |
| `approvalState` | `"approved" | "unapproved" | "unknown"` | 承認未観測かつpartial又は`nextRelayUrls`が残る場合は`unknown` |

初回readは最大3 relayとする。各readには単調増加する`readGeneration`を付与し、古い世代の結果は新しい世代の状態を上書きできない。承認未観測でpartial、timeout、または未試行候補が残る場合は`unknown`とし、未試行候補を最大3 relayずつ限定再読取する。全候補でEOSEを受信するか候補が尽きた時点で停止し、その時点で承認がなければ`unapproved`を確定する。承認操作で生成したイベントは同一snapshotへIDマージし、後続の空readで削除しない。監査ページでは`primaryEvents`だけに10件のページサイズを適用する。各`primaryEvent.id`に対する承認は、`#e`で当該ページの主イベントIDだけを指定し、`limit: 10`を持つ別filterで取得する。

一覧・管理・BusStopMemo・BusStopDiscussionも、表示対象のprimary投稿集合を先に確定し、その投稿ID集合に対する承認readを別filterで行う。評価・集計への入力は`approved`状態のみとし、`unknown`は未承認として確定せず、snapshot更新時に再評価可能な状態として保持する。

## UI State Transitions

`loading` -> `available`（EOSE）
`loading` -> `partial`（timeout/cancelled、イベントまたは既知データあり）
`loading` -> `unavailable`（timeout/cancelled、データなし）
`loading` -> `not-found`（EOSE、対象なし）

`partial`、`unavailable`は再読み込み可能である。

## DiscussionReadStrategyConfig

| Field | Default | Validation |
|---|---:|---|
| `relayLimit` | 3 | 1以上3以下 |
| `idleTimeoutMs` | 既存`defaultTimeout` | 正の整数 |
| `hardTimeoutMs` | idleの3倍 | idleより大きい正の整数 |
| `dedupWindowMs` | 250 | 0以上の整数 |

## AuditEventOrder

監査イベントは`created_at`降順で並べる。同時刻は`promotion-requested`、`listing-requested`、`post-submitted`の順とし、同種の同時刻イベントはevent ID昇順で安定化する。
