# Contract: Discussion read coordinator

## 1. NostrReadExecutor contract

### Input

```ts
interface ExecuteNostrReadInput {
  plan: NostrReadPlan;
  relayUrls: string[];
  onAttemptComplete?: (attempt: NostrReadAttempt) => void;
}
```

### Behavior

- relay候補の順序を保持して重複除去する。
- 初回attemptは候補先頭の最大3relayを使う。
- 初回completionがEOSE以外で、未試行候補がある場合だけ次候補を最大3relayで一度retryする。
- EOSE完了に対して自動retryを追加しない。
- attempt間のeventsをNostr identity規則でmergeする。
- successful relayは実際にeventを返したrelayだけを集約する。
- `onAttemptComplete`は観測用であり、domain UIの最終loading完了を意味しない。

### Non-responsibilities

- naddr、q tag、Discussion IDの解釈
- Discussionの掲載・承認・権限判定
- UI stateの確定
- relay候補の意味づけや優先順位の決定

## 2. DiscussionDetailProvider contract

```ts
interface DiscussionDetailModel {
  state: "loading" | "ready" | "partial" | "error";
  snapshot: DiscussionDetailSnapshot | null;
  error: string | null;
  reload: () => Promise<void>;
  addPost: (post: DiscussionPost) => void;
  addApproval: (approval: PostApproval) => void;
  removeApproval: (approvalId: string) => void;
}
```

### Read sequence

```text
metadata
  → primary content
  → approvals for known post IDs
  → evaluations for known post IDs
  → final snapshot commit
```

- phase途中のcallbackはページへ公開しない。
- moderator requestはprimary contentから抽出する。
- userEvaluationIdsはevaluation結果から導出する。
- pageとchild routeはこのmodelをselectorとして使う。

## 3. DiscussionManagementProvider contract

```ts
interface DiscussionManagementModel {
  state: "loading" | "ready" | "partial" | "error";
  snapshot: DiscussionManagementSnapshot | null;
  error: string | null;
  reload: () => Promise<void>;
}
```

### Read sequence

```text
list metadata
  → listing content
  → listing approvals
  → q reference normalization
  → referenced metadata batch
  → final snapshot commit
```

## 4. Cache contract

- cache keyは`kazaguruma-discussion-read-v2:<identity>`とする。
- `relayProvenance`はphase別配列を持つ。
- cacheが欠損、期限切れ、壊れている場合、readはcacheなしで継続する。
- metadataで成功したrelayをcontentのsuccessful relayとして保存してはならない。
- cache eventがある場合も、relay readは省略しない。

## 5. UI contract

| State | UI behavior |
|---|---|
| `loading` | skeletonまたは読み込み表示。空結果と断定しない。 |
| `ready` | snapshotを通常表示。unknown actionを表示しない。 |
| `partial` | 取得済みsnapshotを表示し、暫定状態とreloadを表示。未確認approvalのactionはdisabled。 |
| `error` | エラーとreloadを表示。Not Foundと混同しない。 |

- statusは日本語、`role="status"`、`aria-live="polite"`で表示する。
- reload buttonは44px以上の操作領域を持つ。
- 子route自身がNostr readを呼び出してはならない。
