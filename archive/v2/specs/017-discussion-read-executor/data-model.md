# データモデル:Discussion read executor

## DiscussionReference

`DiscussionReferenceResolver`が返す正規化済み参照である。

| Field | Type | Rule |
|---|---|---|
| `discussionId` | `string` | `34550:<64桁hex pubkey>:<dTag>`形式 |
| `authorPubkey` | `string` | 64桁hex文字列 |
| `dTag` | `string` | 空文字列ではない |

Resolverは不正な`q` tagを除外する。executorはこの型の構文を再検証しない。

## DiscussionReadPlan

| Field | Type | Rule |
|---|---|---|
| `target` | `DiscussionReadTarget` | read対象を識別する |
| `filters` | `NdkEventFilter[]` | 一つ以上のfilterを許可する |
| `idleTimeoutMs` | `number` | strategy設定値を使う |
| `hardTimeoutMs` | `number` | idle timeoutより大きい |

参照先会話readでは、一意な`DiscussionReference`ごとに`kind=34550`、`authors`、`#d`、`limit=1`のfilterを作る。全filterを一つのplanに入れる。

## RelayAttempt

| Field | Type | Rule |
|---|---|---|
| `relayUrls` | `string[]` | 0から3件。Providerが決めた順序。空配列も一つのattemptとして許可し、executorはrelayを追加しない |
| `completionReason` | `CompletionReason` | `eose`、`idle-timeout`、`hard-timeout`、`cancelled` |
| `events` | `NostrEventDTO[]` | event IDで重複排除する |
| `sourceRelayUrlsByEventId` | `Record<string,string[]>` | event配送元だけを保持する |
| `duplicateCount` | `number` | attempt内の重複配送数 |
| `elapsedMs` | `number` | attempt経過時間 |

## DiscussionReadResult

| Field | Type | Rule |
|---|---|---|
| `events` | `NostrEventDTO[]` | 全attemptのeventsを安定順序で結合する |
| `completionReason` | `CompletionReason` | retryがEOSEなら`eose` |
| `duplicateCount` | `number` | 全attemptの重複配送数を合計する |
| `elapsedMs` | `number` | 全attemptの経過時間を合計する |
| `attemptedRelayUrls` | `string[]` | 全attemptで問い合わせたrelayを重複排除する |
| `successfulEventRelayUrls` | `string[]` | eventを返したrelayだけを重複排除する |
| `sourceRelayUrlsByEventId` | `Record<string,string[]>` | 全attemptの配送元を結合する |
| `attempts` | `RelayAttempt[]` | 観測用。最大2件 |

## 状態遷移

```text
initial
  → first attempt complete
  → EOSE: completed
  → non-EOSEかつ次候補あり: provisional + retrying
  → retry EOSE: completed
  → retry non-EOSEまたは次候補なし: partial
```

初回eventsは`provisional + retrying`中も保持する。retryの空結果は既存eventsを消さない。
