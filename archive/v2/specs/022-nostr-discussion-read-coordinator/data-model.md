# Data Model: Discussion read lifecycleの単純化

## Nostr read基盤

### NostrReadPlan

Nostr executorが必要とする最小read要求。

| Field | Type | Meaning |
|---|---|---|
| `filters` | `NdkEventFilter[]` | 正規化済みNostr filter群 |
| `idleTimeoutMs` | `number` | 無通信時の終了時間 |
| `hardTimeoutMs` | `number` | read全体の上限時間 |

Discussion固有の`target`はdomain planに保持し、executorの通信契約には不要とする。

### NostrReadResult

| Field | Type | Meaning |
|---|---|---|
| `events` | `NostrEventDTO[]` | identity dedupe後のevents |
| `completionReason` | `CompletionReason` | `eose`、timeout等 |
| `duplicateCount` | `number` | transportが観測した重複数 |
| `elapsedMs` | `number` | 経過時間 |
| `attemptedRelayUrls` | `string[]` | 実際に試したrelay |
| `successfulEventRelayUrls` | `string[]` | eventを返したrelay |
| `sourceRelayUrlsByEventId` | `Record<string,string[]>` | eventごとの取得元 |
| `attempts` | `NostrReadAttempt[]` | attempt別観測結果 |

## Read provenance

```ts
interface ReadProvenance {
  successfulRelayUrlsByPhase: Partial<
    Record<"metadata" | "content" | "evaluation" | "reference", string[]>
  >;
}
```

`attemptedRelayUrls`や`sourceRelayUrlsByEventId`は現在のread resultと診断に保持する。次回候補用cacheには、phase別successful relayだけを保存する。

## DiscussionDetailSnapshot

```ts
interface DiscussionDetailSnapshot {
  discussion: Discussion | null;
  posts: DiscussionPost[];
  approvals: PostApproval[];
  moderatorRequests: ModeratorRequest[];
  evaluations: PostEvaluation[];
  userEvaluationIds: Set<string>;
}
```

### Derived rules

- `posts`: primary contentからmoderator requestを除いたもの。
- `moderatorRequests`: primary contentからmoderator requestだけを抽出したもの。
- `approvals`: post IDと結びつくapprovalだけを採用する。
- `userEvaluationIds`: `evaluations`のevaluator pubkeyが現在ユーザーと一致するものから導出する。
- readがpartialの場合、approvalを確認できない投稿のapproval stateは`unknown`とする。

## DiscussionManagementSnapshot

```ts
interface DiscussionManagementSnapshot {
  listDiscussion: Discussion | null;
  listingPosts: DiscussionPost[];
  listingApprovals: PostApproval[];
  referencedDiscussions: Discussion[];
}
```

### Derived rules

- `referencedDiscussions`は`q` tagをresolverで正規化し、同じDiscussion identityを一件にする。
- listing readまたはreference readがpartialなら、空一覧を確定しない。
- 承認済み判定が確定しない投稿からreferenceを公開一覧へ追加しない。

## ReadSession

```ts
interface ReadSession<TSnapshot> {
  generation: number;
  state: "loading" | "ready" | "partial" | "error";
  snapshot: TSnapshot | null;
  provenance: ReadProvenance;
  error: string | null;
}
```

- naddr変更とreloadはgenerationを進める。
- 古いgenerationのresultはsnapshotへ適用しない。
- stateはcoordinatorが一つだけ確定する。

## ReadCacheV2

```ts
interface ReadCacheV2<TMetadata, TEvent> {
  version: 2;
  savedAt: number;
  metadata: TMetadata | null;
  eventIds: string[];
  events?: TEvent[];
  relayProvenance: {
    metadata?: string[];
    content?: string[];
    evaluation?: string[];
    reference?: string[];
  };
}
```

- `sessionStorage`にdiscussion identityごと保存する。
- 24時間を過ぎたcacheは無視する。
- cache eventは暫定表示用であり、relay readを省略する根拠にしない。
- v1の`successfulRelays`と`successfulEventRelayUrls`は移行せず無視する。
