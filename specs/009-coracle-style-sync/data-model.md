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

会話IDごとに、最新会話メタデータ、既知イベントIDとrelay URL、relay成功実績、保存時刻を持つ。`sessionStorage`にversion付きJSONで保存し、relay結果を受けるたびにマージする。

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
