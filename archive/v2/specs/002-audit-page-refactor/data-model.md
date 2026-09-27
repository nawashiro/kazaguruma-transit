# Data Model: 監査ページリファクタリングと表示不具合修正

**Feature**: 001-audit-page-refactor
**Date**: 2026-01-14
**Source**: [spec.md](./spec.md)

## 概要

この機能で使用されるデータモデルを定義する。既存の型定義（`src/types/discussion.ts`）を最大限活用し、新規追加は必要最小限とする。

---

## 既存エンティティ（再利用）

### AuditTimelineItem

監査タイムラインに表示される個々のイベントを表す。

```typescript
// src/types/discussion.ts から
export interface AuditTimelineItem {
  id: string
  type: 'discussion-request' | 'discussion-created' | 'discussion-deleted' | 'post-submitted' | 'post-approved' | 'post-rejected'
  timestamp: number
  actorPubkey: string
  actorName?: string
  targetId?: string
  description: string
  event: Event
}
```

**使用箇所**: AuditTimeline コンポーネント、createAuditTimeline ユーティリティ

### Discussion

会話（Nostr kind:34550）を表す。

```typescript
// src/types/discussion.ts から
export interface Discussion {
  id: string
  dTag: string
  title: string
  description: string
  moderators: DiscussionModerator[]
  authorPubkey: string
  createdAt: number
  event: Event
  approvedAt?: number
  approvalReference?: string
}
```

**ページ分離での注意点**: 監査ページでは、メイン画面からpropsで受け取るのではなく、独自にkind:34550を取得する必要がある（FR-016）。

### PostApproval

投稿の承認イベント（Nostr kind:4550）を表す。

```typescript
// src/types/discussion.ts から
export interface PostApproval {
  id: string
  postId: string
  postAuthorPubkey: string
  moderatorPubkey: string
  discussionId: string
  createdAt: number
  event: Event
}
```

### DiscussionPost

投稿（Nostr kind:1111/1）を表す。

```typescript
// src/types/discussion.ts から
export interface DiscussionPost {
  id: string
  content: string
  authorPubkey: string
  discussionId: string
  busStopTag?: string
  createdAt: number
  approved: boolean
  approvedBy?: string[]
  approvedAt?: number
  event: Event
}
```

### LoadingState

ローディング状態とエラー状態を表す。

```typescript
// src/types/discussion.ts から
export interface LoadingState {
  isLoading: boolean
  error: string | null
}
```

---

## 新規エンティティ

### AuditPageState

監査ページ固有の状態を表す。既存のLoadingStateを拡張し、データ取得完了フラグを追加。

```typescript
// src/types/discussion.ts に追加予定
export interface AuditPageState extends LoadingState {
  /** データ取得が完了したかどうか */
  isLoaded: boolean
  /** 再試行可能なエラーかどうか */
  isRetryable: boolean
}
```

**使用箇所**:
- `/discussions/audit/page.tsx`
- `/discussions/[naddr]/audit/page.tsx`

**状態遷移**:
```
初期状態: { isLoading: false, isLoaded: false, error: null, isRetryable: false }
     ↓ loadAuditData()
読み込み中: { isLoading: true, isLoaded: false, error: null, isRetryable: false }
     ↓ 成功
完了: { isLoading: false, isLoaded: true, error: null, isRetryable: false }
     ↓ 失敗
エラー: { isLoading: false, isLoaded: false, error: "エラーメッセージ", isRetryable: true }
```

### TabLayoutConfig

タブナビゲーションの設定を表す。

```typescript
// src/components/discussion/DiscussionTabLayout.tsx で使用
export interface TabLayoutConfig {
  /** タブナビゲーションのベースURL */
  baseHref: string
  /** 会話タブのラベル */
  mainLabel?: string  // デフォルト: "会話"
  /** 監査タブのラベル */
  auditLabel?: string // デフォルト: "監査ログ"
}
```

**使用箇所**: DiscussionTabLayout コンポーネント

### TabNavItem

個々のタブアイテムを表す（内部使用）。

```typescript
// src/components/discussion/DiscussionTabLayout.tsx 内部で使用
interface TabNavItem {
  href: string
  label: string
  isActive: boolean
}
```

---

## データフロー

### 会話詳細監査ページ (`/discussions/[naddr]/audit`)

```
URL params (naddr)
     ↓ extractDiscussionFromNaddr()
discussionInfo: { discussionId, authorPubkey, dTag }
     ↓ nostrService.streamApprovals() + streamEventsOnEvent()
[PostApproval[], DiscussionPost[]]
     ↓ nostrService.getDiscussionEvent()  ← NEW: 独自取得
Discussion
     ↓ createAuditTimeline()
AuditTimelineItem[]
     ↓
AuditTimeline コンポーネント
```

### 会話一覧監査ページ (`/discussions/audit`)

```
NEXT_PUBLIC_DISCUSSION_LIST_NADDR
     ↓ extractDiscussionFromNaddr()
listDiscussionInfo
     ↓ nostrService.streamApprovals() + streamEventsOnEvent()
[PostApproval[], DiscussionPost[]]
     ↓ qタグからreferenced discussion取得
Discussion[] (referencedDiscussions)
     ↓ createAuditTimeline()
AuditTimelineItem[]
     ↓
AuditTimeline コンポーネント
```

---

## 関連するNostrイベント種別

| Kind | 名称 | 説明 | 監査での使用 |
|------|------|------|-------------|
| 34550 | Discussion | 会話定義 | discussion-created イベント |
| 4550 | Approval | 投稿承認 | post-approved イベント |
| 1111 | Community Post | 投稿 | post-submitted イベント |
| 1 | Short Text Note | 投稿（後方互換） | post-submitted イベント |

---

## バリデーションルール

### AuditTimelineItem

- `id`: 必須、空文字不可
- `type`: 定義された6種類のいずれか
- `timestamp`: Unix timestamp (秒)、0より大きい
- `actorPubkey`: 64文字の16進数文字列
- `event`: 有効なNostrイベント

### Discussion

- `id`: 必須、`34550:pubkey:dTag` 形式
- `dTag`: 必須、空文字不可
- `authorPubkey`: 64文字の16進数文字列
- `moderators`: 配列（空可）

---

## References

- [src/types/discussion.ts](../../src/types/discussion.ts) - 既存の型定義
- [NIP-72](../../docs/discussion/NIP-72.md) - Moderated Communities仕様
- [spec.md](./spec.md) - 機能仕様
