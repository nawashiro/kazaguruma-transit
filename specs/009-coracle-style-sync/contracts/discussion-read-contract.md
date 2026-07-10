# Discussion Read Contract

## Common Contract

すべてのDiscussion readは`DiscussionReadPlan`から実行する。UIはfilterやrelay URLを直接組み立てない。結果はID重複を除き、`completionReason`、実relay数、重複数、経過時間を観測ログに残す。

| Target | Allowed filters | Limit | Relay cap |
|---|---|---:|---:|
| `discussion-list` | kind 34550、掲載/承認関連のみ | 50 | 3 |
| `discussion-meta` | kind 34550、author + `#d` | 1 | 3 |
| `discussion-approvals` | kind 4550、対象`#a`。詳細では承認済み投稿を復元し、承認画面では承認対象として変換する | 50 | 3 |
| `discussion-evaluations` | kind 7、取得済み投稿の`#e` | 100 | 3 |
| `discussion-audit` | 画面種別で許可された監査kind/tag | 10 | 3 |
| `discussion-edit` | kind 34550、対象会話と昇格申請 | 20 | 3 |

## Result-to-UI Contract

| Condition | Japanese status | User action |
|---|---|---|
| 読み取り中 | `会話データを読み込み中...` | 既存ナビゲーションを利用可能にする |
| EOSE + data | 状態表示なしまたは取得完了 | 通常表示 |
| timeout/cancelled + data | `一部のrelayからの取得が完了していません。表示内容は暫定です。` | `再読み込み` |
| timeout/cancelled + no data | `会話データを取得できませんでした。relayの応答を待てなかった可能性があります。` | `再読み込み` |
| EOSE + no target | `会話が見つかりません` | 一覧へ戻る |

状態文は`role="status" aria-live="polite"`で通知し、再読み込みボタンは44px以上とする。

## Cache Contract

- 既知メタデータは最初に表示してよいが、`暫定`状態を示す。
- 既知イベントは重複排除とrelay候補補強に利用できる。
- 新規relay結果は古い会話定義・承認状態を上書きできる。
- cacheのみで最新投稿、承認済み、権限可否、Not Foundを確定しない。

## Strategy Configuration Contract

`DiscussionReadStrategyConfig`は`src/lib/config/discussion-config.ts`で保守する。relay limitは1-3に丸め、hard timeoutがidle以下なら既定値へ戻す。各readは選別済みURLを`NDKRelaySet.fromRelayUrls()`でrelay set化し、`ndk.subscribe()`へ渡す。候補不足時の補充は購読開始前に1回だけ行う。

## Stable Ordering Contract

投稿・承認・評価は`created_at`降順、同時刻はevent ID昇順とする。監査は`AuditEventOrder`の種別優先順位、`created_at`降順、event ID昇順で並べる。到着順は表示順に使わない。
