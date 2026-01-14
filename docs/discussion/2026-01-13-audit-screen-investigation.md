# 監査画面表示不具合調査報告

**日付**: 2026-01-13
**対象**: 会話一覧および会話詳細ページの監査画面

## 要約

監査画面でコンテンツが表示されない問題を調査した結果、以下の3つの主要な問題を特定しました：

1. **エラーハンドリングの欠如**: `updateFromApprovals`関数でエラーが発生した場合、データが設定されずに処理が中断される
2. **ストリーミングの競合状態**: 投稿ストリームと承認ストリームが並行実行されるため、データの到着順序によっては空配列で処理される可能性がある
3. **デバッグ情報の不足**: エラーが発生しても適切なログが出力されないため、問題の特定が困難

これらの問題により、ブラウザでイベントが正しく取得されていても、画面上にタイムラインが表示されない状態が発生している可能性があります。

---

## 問題の詳細

### 背景

ユーザーからの報告によると、以下の症状が発生しています：

- **会話一覧ページ** (`/discussions`): 監査画面に何も表示されない
- **会話詳細ページ** (`/discussions/[naddr]`): 会話の作成イベントのみが表示され、投稿や承認の履歴が表示されない

ブラウザのネットワークログを確認したところ、Nostrリレーからイベントは正しく取得できている。例えば、会話一覧ページでは以下のようなイベントが受信されている：

```json
["EVENT","sub:1",{
  "kind":1111,
  "tags":[
    ["a","34550:c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8:test-discussion"],
    ["q","34550:c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8:test-sugukesu"]
  ],
  ...
}]
```

### 調査対象ファイル

- `src/components/discussion/AuditLogSection.tsx`
- `src/app/discussions/page.tsx`
- `src/app/discussions/[naddr]/page.tsx`
- `src/lib/nostr/nostr-utils.ts`
- `src/components/discussion/AuditTimeline.tsx`

---

## 発見された問題点

### 1. エラーハンドリングの欠如

#### 会話一覧ページ (`AuditLogSection.tsx` 173-275行目)

`loadDiscussionListAuditData`関数内の`updateFromApprovals`は非同期関数ですが、try-catchブロックがありません：

```typescript
const updateFromApprovals = async (approvalsEvents: any[]) => {
  approvalEventsRef.current = approvalsEvents;
  const listApprovals = approvalsEvents
    .map(parseApprovalEvent)
    .filter((a): a is PostApproval => a !== null);

  const listPosts = postEventsRef.current
    .map((event) => parsePostEvent(event, listApprovals))
    .filter((p): p is DiscussionPost => p !== null);

  // 195-201行目: ここでエラーが発生する可能性が高い
  const individualDiscussionRefs = new Set<string>();
  listPosts.forEach((post) => {
    const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
    qTags.forEach((qTag) => {
      if (qTag[1] && qTag[1].startsWith("34550:")) {
        individualDiscussionRefs.add(qTag[1]);
      }
    });
  });

  let nextReferenced: Discussion[] = [];
  if (individualDiscussionRefs.size > 0) {
    // この呼び出しでエラーが発生した場合、処理が中断される
    const individualDiscussions =
      await nostrService.getReferencedUserDiscussions(
        Array.from(individualDiscussionRefs)
      );
    nextReferenced = individualDiscussions
      .map(parseDiscussionEvent)
      .filter((d): d is Discussion => d !== null);
  }

  // エラーが発生すると、ここに到達せずデータが空のまま
  setAuditPosts(listPosts);
  setAuditApprovals(listApprovals);
  setLocalReferencedDiscussions(nextReferenced);
  // ... プロファイル取得処理
};
```

**影響**:
- `getReferencedUserDiscussions`でエラーが発生すると、`setAuditPosts`等が呼ばれない
- 結果として、タイムラインに表示するデータが設定されない
- エラーがログにも出力されないため、問題の特定が困難

#### 会話詳細ページ (`AuditLogSection.tsx` 66-154行目)

`loadIndividualAuditData`関数内の`updateFromApprovals`も同様の問題を抱えています：

```typescript
const updateFromApprovals = (approvalsEvents: any[]) => {
  approvalEventsRef.current = approvalsEvents;
  const parsedApprovals = approvalsEvents
    .map(parseApprovalEvent)
    .filter((a): a is PostApproval => a !== null);

  const parsedPosts = postEventsRef.current
    .map((event) => parsePostEvent(event, parsedApprovals))
    .filter((p): p is DiscussionPost => p !== null);

  // エラーハンドリングなし
  setAuditPosts(parsedPosts);
  setAuditApprovals(parsedApprovals);
  setLocalReferencedDiscussions(referencedDiscussions);
};
```

### 2. ストリーミングの競合状態

両方のページで、投稿ストリームと承認ストリームが並行して開始されます：

```typescript
// 投稿ストリーム開始
const postStream = nostrService.streamEventsOnEvent(
  [{ kinds: [1111, 1], "#a": [listDiscussionInfo.discussionId] }],
  {
    onEvent: (events) => {
      postEventsRef.current = events;
      updateFromApprovals(approvalEventsRef.current); // ここで承認データがまだ空の可能性
    },
    onEose: (events) => {
      postEventsRef.current = events;
      updateFromApprovals(approvalEventsRef.current);
    },
    timeoutMs: nostrServiceConfig.defaultTimeout,
  }
);

// 承認ストリーム開始
approvalStreamCleanupRef.current = nostrService.streamApprovals(
  listDiscussionInfo.discussionId,
  {
    onEvent: updateFromApprovals,
    onEose: (events) => {
      updateFromApprovals(events);
      setIsAuditLoaded(true);
      setIsAuditLoading(false);
    },
    timeoutMs: nostrServiceConfig.defaultTimeout,
  }
);

postStreamCleanupRef.current = postStream;
```

**問題のシナリオ**:

1. 投稿ストリームと承認ストリームが並行して開始される
2. 投稿ストリームの`onEvent`が先に呼ばれる（ネットワークの状況による）
3. この時点で`approvalEventsRef.current`はまだ空配列
4. `updateFromApprovals([])`が実行され、承認データなしで投稿がパースされる
5. NIP-72の仕様では、承認イベントのcontentフィールドに元の投稿が含まれるため、承認データがないと投稿も復元できない
6. 結果として、`auditPosts`が空配列になる

さらに、会話詳細ページでは122行目で初期化時に空配列を渡しています：

```typescript
postStreamCleanupRef.current = postsStream;
updateFromApprovals([]); // 初期状態で空配列をセット
```

これにより、ストリーミング開始直後に一度空のデータが設定されます。

### 3. デバッグ情報の不足

現在のコードでは、データ取得の各段階でログが出力されていません：

- 取得したイベント数
- パース成功/失敗の件数
- `setAuditPosts`に設定されるデータの件数
- エラーの詳細

このため、どの段階で問題が発生しているのか特定が困難です。

---

## タイムライン生成ロジックの確認

`createAuditTimeline`関数（`nostr-utils.ts` 249-306行目）は正しく実装されています：

```typescript
export function createAuditTimeline(
  discussions: Discussion[],
  requests: DiscussionRequest[],
  posts: DiscussionPost[],
  approvals: PostApproval[]
): AuditTimelineItem[] {
  const items: AuditTimelineItem[] = [];

  // リクエスト、会話作成、投稿、承認をアイテムに変換
  requests.forEach((request) => { /* ... */ });
  discussions.forEach((discussion) => { /* ... */ });
  posts.forEach((post) => { /* ... */ });
  approvals.forEach((approval) => { /* ... */ });

  // タイムスタンプでソート
  return items.sort((a, b) => b.timestamp - a.timestamp);
}
```

`AuditLogSection`コンポーネント（309-318行目）では以下のように呼び出されています：

```typescript
const auditItems = useMemo(
  () =>
    createAuditTimeline(
      isDiscussionList ? localReferencedDiscussions : (discussion ? [discussion] : []),
      [],
      auditPosts,
      auditApprovals
    ),
  [isDiscussionList, localReferencedDiscussions, discussion, auditPosts, auditApprovals]
);
```

**問題の本質**:
- `createAuditTimeline`自体は正しく動作する
- しかし、引数として渡される`auditPosts`と`auditApprovals`が空配列のまま
- これは上記のエラーハンドリングとストリーミングの問題に起因する

---

## 会話詳細ページで「会話の作成のみ表示される」理由

会話詳細ページでは、以下の条件でタイムラインアイテムが生成されます：

1. **会話作成イベント**: `discussion`オブジェクトが存在すれば必ず生成される
2. **投稿提出イベント**: `auditPosts`配列から生成される
3. **投稿承認イベント**: `auditApprovals`配列から生成される

現在「会話の作成のみが表示される」ということは：
- `discussion`は正しく取得できている
- `auditPosts`と`auditApprovals`が空配列

これは以下の可能性があります：

**可能性A: データが実際に存在しない**
- test-sugukesuという会話に対する投稿が実際に存在しない
- この場合は正常な動作

**可能性B: データ取得に失敗している**
- エラーハンドリングの欠如により、取得処理が中断されている
- ストリーミングの競合により、データが正しくパースされていない

ブラウザのログで「イベントが取得されている」という情報から、可能性Bが高いと推測されます。

---

## 推奨される修正

### 1. エラーハンドリングの追加

#### 会話一覧ページ

```typescript
const updateFromApprovals = async (approvalsEvents: any[]) => {
  try {
    logger.info("updateFromApprovals called", {
      approvalsCount: approvalsEvents.length,
      postsCount: postEventsRef.current.length
    });

    approvalEventsRef.current = approvalsEvents;
    const listApprovals = approvalsEvents
      .map(parseApprovalEvent)
      .filter((a): a is PostApproval => a !== null);

    logger.info("Parsed approvals", { count: listApprovals.length });

    const listPosts = postEventsRef.current
      .map((event) => parsePostEvent(event, listApprovals))
      .filter((p): p is DiscussionPost => p !== null);

    logger.info("Parsed posts", { count: listPosts.length });

    const individualDiscussionRefs = new Set<string>();
    listPosts.forEach((post) => {
      const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
      qTags.forEach((qTag) => {
        if (qTag[1] && qTag[1].startsWith("34550:")) {
          individualDiscussionRefs.add(qTag[1]);
        }
      });
    });

    logger.info("Found discussion references", {
      count: individualDiscussionRefs.size,
      refs: Array.from(individualDiscussionRefs)
    });

    let nextReferenced: Discussion[] = [];
    if (individualDiscussionRefs.size > 0) {
      const individualDiscussions =
        await nostrService.getReferencedUserDiscussions(
          Array.from(individualDiscussionRefs)
        );
      nextReferenced = individualDiscussions
        .map(parseDiscussionEvent)
        .filter((d): d is Discussion => d !== null);

      logger.info("Parsed referenced discussions", { count: nextReferenced.length });
    }

    setAuditPosts(listPosts);
    setAuditApprovals(listApprovals);
    setLocalReferencedDiscussions(nextReferenced);

    logger.info("Set audit data", {
      posts: listPosts.length,
      approvals: listApprovals.length,
      discussions: nextReferenced.length
    });

    // プロファイル取得処理...
  } catch (error) {
    logger.error("Failed to update from approvals:", error);
    // エラー時も最低限のデータをセット（空配列でも良い）
    setAuditPosts([]);
    setAuditApprovals([]);
    setLocalReferencedDiscussions([]);
    setIsAuditLoaded(true);
    setIsAuditLoading(false);
  }
};
```

#### 会話詳細ページ

```typescript
const updateFromApprovals = (approvalsEvents: any[]) => {
  try {
    logger.info("Individual audit: updateFromApprovals called", {
      approvalsCount: approvalsEvents.length,
      postsCount: postEventsRef.current.length
    });

    approvalEventsRef.current = approvalsEvents;
    const parsedApprovals = approvalsEvents
      .map(parseApprovalEvent)
      .filter((a): a is PostApproval => a !== null);

    logger.info("Individual audit: Parsed approvals", { count: parsedApprovals.length });

    const parsedPosts = postEventsRef.current
      .map((event) => parsePostEvent(event, parsedApprovals))
      .filter((p): p is DiscussionPost => p !== null);

    logger.info("Individual audit: Parsed posts", { count: parsedPosts.length });

    setAuditPosts(parsedPosts);
    setAuditApprovals(parsedApprovals);
    setLocalReferencedDiscussions(referencedDiscussions);

    logger.info("Individual audit: Set audit data", {
      posts: parsedPosts.length,
      approvals: parsedApprovals.length
    });
  } catch (error) {
    logger.error("Individual audit: Failed to update from approvals:", error);
    setAuditPosts([]);
    setAuditApprovals([]);
    setLocalReferencedDiscussions(referencedDiscussions);
  }
};
```

### 2. ストリーミングの初期化順序を改善

承認データが先に到着することを保証するため、ストリーミングの開始順序を変更する、または承認データの到着を待ってから投稿データを処理する：

```typescript
// 承認ストリームを先に開始し、onEoseで投稿ストリームを開始
approvalStreamCleanupRef.current = nostrService.streamApprovals(
  discussionInfo.discussionId,
  {
    onEvent: updateFromApprovals,
    onEose: (events) => {
      updateFromApprovals(events);

      // 承認データの取得完了後、投稿ストリームを開始
      postStreamCleanupRef.current = nostrService.streamEventsOnEvent(
        [{ kinds: [1111, 1], "#a": [discussionInfo.discussionId] }],
        {
          onEvent: (postEvents) => {
            postEventsRef.current = postEvents;
            updateFromApprovals(approvalEventsRef.current);
          },
          onEose: (postEvents) => {
            postEventsRef.current = postEvents;
            updateFromApprovals(approvalEventsRef.current);
            setIsAuditLoaded(true);
            setIsAuditLoading(false);
          },
          timeoutMs: nostrServiceConfig.defaultTimeout,
        }
      );
    },
    timeoutMs: nostrServiceConfig.defaultTimeout,
  }
);
```

### 3. 初期化時の空配列呼び出しを削除

会話詳細ページの122行目を削除またはコメントアウト：

```typescript
postStreamCleanupRef.current = postsStream;
// updateFromApprovals([]); // この行を削除
```

---

## 次のステップ

1. **上記の修正を適用**
   - エラーハンドリングとログの追加
   - ストリーミング順序の改善

2. **ブラウザコンソールでログを確認**
   - 各段階で取得・パースされたデータ数
   - エラーメッセージの有無

3. **テストケースの追加**
   - `AuditLogSection`コンポーネントのテストに、エラーケースを追加
   - ストリーミングの順序によるテストケースを追加

4. **環境変数の確認**
   - `NEXT_PUBLIC_DISCUSSION_LIST_NADDR`が正しく設定されているか確認
   - リレーサーバーの接続状態を確認

5. **データの存在確認**
   - Nostrリレーに実際にどのようなイベントが保存されているか確認
   - 特にtest-discussionとtest-sugukesuに関連するイベント

---

## 技術的補足

### NIP-72の承認メカニズム

NIP-72では、承認イベント（kind:4550）のcontentフィールドに、承認対象の投稿全体がJSON文字列として含まれます：

```json
{
  "kind": 4550,
  "content": "{\"kind\":1111,\"content\":\"投稿内容\",\"tags\":[...],\"pubkey\":\"...\"}",
  "tags": [
    ["a", "34550:...:test-discussion"],
    ["e", "<post-id>"],
    ["p", "<post-author-pubkey>"],
    ["k", "1111"]
  ]
}
```

このため、承認されていない投稿を監査ログに表示するには：
1. 投稿イベント自体を取得する（kind:1111、aタグで会話を指定）
2. 承認イベントを取得する（kind:4550、aタグで会話を指定）
3. 投稿と承認を紐付けて表示

現在の実装では、承認イベントのcontentから投稿を復元する方法を採用していますが、これは承認データが先に必要という依存関係を生み出しています。

### 代替アプローチ

承認データへの依存を減らすため、以下のアプローチも検討できます：

```typescript
// 投稿と承認を独立して取得し、後でマージ
const posts = await nostrService.getPosts(discussionId); // 全投稿
const approvals = await nostrService.getApprovals(discussionId); // 全承認

// 承認から復元された投稿と、直接取得した投稿をマージ
const allPosts = mergePosts(posts, approvals);
```

ただし、これは現在のアーキテクチャの大きな変更を伴うため、まずは上記の修正で問題が解決するか確認することを推奨します。
