# Contracts: 監査ページリファクタリングと表示不具合修正

**Feature**: 001-audit-page-refactor
**Date**: 2026-01-14

## 概要

この機能はフロントエンドのみの変更であり、新規バックエンドAPIは追加しない。
Nostrリレーとの通信は既存の `NostrService` を使用する。

---

## 既存API（再利用）

### NostrService

`src/lib/nostr/nostr-service.ts` で定義されている既存のサービス。

#### streamApprovals

```typescript
streamApprovals(
  discussionId: string,
  options: {
    onEvent: (events: NostrEvent[]) => void
    onEose: (events: NostrEvent[]) => void
    timeoutMs?: number
  }
): () => void  // cleanup function
```

**用途**: kind:4550 承認イベントのストリーミング取得

#### streamEventsOnEvent

```typescript
streamEventsOnEvent(
  filters: Filter[],
  options: {
    onEvent: (events: NostrEvent[]) => void
    onEose: (events: NostrEvent[]) => void
    timeoutMs?: number
  }
): () => void  // cleanup function
```

**用途**: kind:1111/1 投稿イベントのストリーミング取得

#### getReferencedUserDiscussions

```typescript
getReferencedUserDiscussions(
  discussionRefs: string[]
): Promise<NostrEvent[]>
```

**用途**: qタグで参照された会話（kind:34550）の取得

#### getProfile

```typescript
getProfile(pubkeys: string[]): Promise<NostrEvent[]>
```

**用途**: ユーザープロファイルの取得（モデレーター・作成者のみ）

---

## 新規コンポーネントインターフェース

### DiscussionTabLayout

タブナビゲーションを提供する共通レイアウトコンポーネント。

```typescript
// Props
interface DiscussionTabLayoutProps {
  /** タブナビゲーションのベースURL（例: "/discussions" または "/discussions/[naddr]"） */
  baseHref: string
  /** 子コンポーネント（ページコンテンツ） */
  children: React.ReactNode
}

// Usage
<DiscussionTabLayout baseHref="/discussions">
  {/* Page content */}
</DiscussionTabLayout>

<DiscussionTabLayout baseHref={`/discussions/${naddr}`}>
  {/* Page content */}
</DiscussionTabLayout>
```

### AuditLogSection（修正）

既存コンポーネントに独自のDiscussion取得機能を追加。

```typescript
// 現在のProps
interface AuditLogSectionProps {
  discussion: Discussion | null          // メイン画面から渡される
  discussionInfo: {
    discussionId: string
    authorPubkey: string
    dTag: string
  } | null
  conversationAuditMode?: boolean
  referencedDiscussions?: Discussion[]
  isDiscussionList?: boolean
}

// 修正後のProps（オプショナルに変更）
interface AuditLogSectionProps {
  discussion?: Discussion | null         // オプショナルに変更
  discussionInfo: {
    discussionId: string
    authorPubkey: string
    dTag: string
  } | null
  conversationAuditMode?: boolean
  referencedDiscussions?: Discussion[]
  isDiscussionList?: boolean
  loadDiscussionIndependently?: boolean  // 新規: 独自にDiscussionを取得するフラグ
}
```

---

## Nostrイベントフィルター

### 投稿取得フィルター

```typescript
{
  kinds: [1111, 1],
  "#a": [discussionId]  // 例: "34550:pubkey:dTag"
}
```

### 承認取得フィルター

```typescript
{
  kinds: [4550],
  "#a": [discussionId]
}
```

---

## エラーハンドリング契約

### エラーコード

| コード | 説明 | ユーザーメッセージ |
|--------|------|------------------|
| RELAY_ERROR | Nostrリレーへの接続失敗 | 「サーバーに接続できません。再試行してください。」 |
| TIMEOUT_ERROR | ストリーミングタイムアウト | 「データの取得に時間がかかっています。再試行してください。」 |
| PARSE_ERROR | イベントパースエラー | 「データの読み込みに失敗しました。」 |
| NO_DATA | データが見つからない | 「データが見つかりません。」 |

### 再試行ポリシー

- ユーザー主導の再試行（再試行ボタン）
- 自動再試行は行わない（ストリーミング接続のため）

---

## References

- [src/lib/nostr/nostr-service.ts](../../../src/lib/nostr/nostr-service.ts) - 既存NostrService
- [data-model.md](./data-model.md) - データモデル定義
- [spec.md](../spec.md) - 機能仕様
