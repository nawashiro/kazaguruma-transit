# Data Model: 監査ページのヘッダー要素レイアウト移動

**Date**: 2026-01-15
**Feature**: 001-audit-header-layout

## Overview

本ドキュメントは、`DiscussionTabLayout` コンポーネントに追加される状態とデータフローを定義します。既存の型定義を使用し、新規の型追加は最小限に抑えます。

---

## 1. 既存エンティティ（再利用）

### Discussion

**ファイル**: `src/types/discussion.ts`

```typescript
export interface Discussion {
  id: string;                    // Nostr イベントID（kind:34550）
  dTag: string;                  // d タグ（会話の識別子）
  title: string;                 // 会話タイトル
  description: string;           // 会話の説明
  authorPubkey: string;          // 作成者の公開鍵
  moderators: Moderator[];       // モデレーターリスト
  createdAt: number;             // 作成タイムスタンプ（UNIX秒）
  event?: Event;                 // 元のNostrイベント
}
```

**使用箇所**:
- レイアウトの状態: `const [discussion, setDiscussion] = useState<Discussion | null>(null)`
- タイトル表示: `discussion.title`
- 説明表示: `discussion.description`

**バリデーションルール**:
- `title`: 必須、1文字以上
- `description`: 必須、改行を含む可能性あり
- `createdAt`: UNIX秒（ミリ秒ではない）

### DiscussionInfo

**ファイル**: `src/lib/nostr/naddr-utils.ts`

```typescript
export interface DiscussionInfo {
  discussionId: string;       // kind:34550 の a タグ値
  authorPubkey: string;       // 作成者の公開鍵
  dTag: string;               // d タグ
}
```

**使用箇所**:
- NADDR パース: `const discussionInfo = extractDiscussionFromNaddr(naddr)`
- データ取得のパラメータ: `streamDiscussionMeta(discussionInfo.authorPubkey, discussionInfo.dTag, ...)`
- テストモード判定: `isTestMode(discussionInfo.dTag)`

**抽出ロジック**:
```typescript
// NADDR: naddr1...xyz
// ↓
// DiscussionInfo: {
//   discussionId: "34550:authorPubkey:dTag",
//   authorPubkey: "hex...",
//   dTag: "unique-id"
// }
```

---

## 2. 新規状態（DiscussionTabLayout）

### Component State

```typescript
// 会話データ
const [discussion, setDiscussion] = useState<Discussion | null>(null);

// ローディング状態
const [isDiscussionLoading, setIsDiscussionLoading] = useState(true);

// エラー状態
const [discussionError, setDiscussionError] = useState<string | null>(null);

// ストリームクリーンアップ関数
const discussionStreamCleanupRef = useRef<(() => void) | null>(null);

// 非同期操作の競合防止
const loadSequenceRef = useRef(0);
```

### 状態遷移図

```
初期状態
├── isDiscussionLoading: true
├── discussion: null
└── discussionError: null
    ↓
    ├─→ [テストモード] loadTestData()
    │   ├─→ 成功
    │   │   ├── discussion: テストDiscussion
    │   │   ├── isDiscussionLoading: false
    │   │   └── discussionError: null
    │   └─→ 失敗
    │       ├── discussion: null
    │       ├── isDiscussionLoading: false
    │       └── discussionError: "テストデータの読み込みに失敗しました"
    │
    └─→ [本番モード] streamDiscussionMeta()
        ├─→ onEvent: データ到着
        │   ├── discussion: 最新Discussion
        │   ├── isDiscussionLoading: false
        │   └── discussionError: null
        ├─→ onEose: ストリーム終了
        │   ├── discussion: 最新Discussion or null
        │   ├── isDiscussionLoading: false
        │   └── discussionError: null
        └─→ エラー
            ├── discussion: null
            ├── isDiscussionLoading: false
            └── discussionError: "会話データの取得に失敗しました"
```

---

## 3. データフロー

### 3.1 初期ロード

```
ページマウント
    ↓
useParams() → naddr 取得
    ↓
extractDiscussionFromNaddr(naddr) → discussionInfo
    ↓
useEffect 実行
    ↓
    ├─→ [無効なnaddr]
    │   └── エラー表示（レイアウト外で処理）
    │
    └─→ [有効なnaddr]
        ├─→ isTestMode(discussionInfo.dTag)?
        │   ├─→ YES: loadTestData()
        │   │   └── setDiscussion(testData.discussion)
        │   │
        │   └─→ NO: streamDiscussionMeta()
        │       ├── onEvent: setDiscussion(latest)
        │       └── onEose: setDiscussion(latest)
        │
        └── setIsDiscussionLoading(false)
```

### 3.2 データ更新（ストリーミング）

```
streamDiscussionMeta 開始
    ↓
リレーから kind:34550 イベント受信
    ↓
onEvent コールバック
    ↓
pickLatestDiscussion(events)
    ├─→ createdAt の最大値を選択
    └─→ Discussion | null
        ↓
loadSequence チェック
    ├─→ 古いシーケンス → 破棄
    └─→ 現在のシーケンス → setDiscussion(latest)
```

### 3.3 エラーハンドリング

```
エラー発生
    ↓
try-catch でキャッチ
    ↓
logger.error() でログ出力
    ↓
setDiscussionError("エラーメッセージ")
    ↓
setIsDiscussionLoading(false)
    ↓
UI: エラー表示 + 再試行ボタン
    ↓
    ├─→ ユーザーが再試行
    │   └── エラー状態をクリアして再ロード
    │
    └─→ ユーザーが戻るリンクで離脱
```

### 3.4 クリーンアップ

```
useEffect クリーンアップ
    ↓
discussionStreamCleanupRef.current?.()
    ↓
WebSocket 接続を切断
    ↓
メモリ解放
```

---

## 4. 関数とヘルパー

### 4.1 loadDiscussionData

```typescript
const loadDiscussionData = useCallback(async () => {
  // 前のストリームをクリーンアップ
  discussionStreamCleanupRef.current?.();
  discussionStreamCleanupRef.current = null;

  // シーケンス番号を増加
  const loadSequence = ++loadSequenceRef.current;

  // 状態初期化
  setDiscussion(null);
  setIsDiscussionLoading(true);
  setDiscussionError(null);

  try {
    // テストモード判定
    if (isTestMode(discussionInfo.dTag)) {
      const testData = await loadTestData();
      if (loadSequenceRef.current !== loadSequence) return;
      setDiscussion(testData.discussion);
      setIsDiscussionLoading(false);
      return;
    }

    // ストリーム開始
    discussionStreamCleanupRef.current = nostrService.streamDiscussionMeta(
      discussionInfo.authorPubkey,
      discussionInfo.dTag,
      {
        onEvent: (events) => {
          if (loadSequenceRef.current !== loadSequence) return;
          const latest = pickLatestDiscussion(events);
          if (latest) {
            setDiscussion(latest);
            setIsDiscussionLoading(false);
          }
        },
        onEose: (events) => {
          if (loadSequenceRef.current !== loadSequence) return;
          const latest = pickLatestDiscussion(events);
          if (latest) {
            setDiscussion(latest);
          }
          setIsDiscussionLoading(false);
        }
      }
    );
  } catch (error) {
    if (loadSequenceRef.current !== loadSequence) return;
    logger.error("Failed to load discussion:", error);
    setDiscussionError("会話データの取得に失敗しました");
    setIsDiscussionLoading(false);
  }
}, [discussionInfo]);
```

### 4.2 pickLatestDiscussion

```typescript
const pickLatestDiscussion = (events: Event[]): Discussion | null => {
  const parsed = events
    .map(parseDiscussionEvent)
    .filter((d): d is Discussion => d !== null);

  if (parsed.length === 0) {
    return null;
  }

  return parsed.reduce((latest, current) =>
    current.createdAt > latest.createdAt ? current : latest
  );
};
```

**ロジック**:
1. すべてのイベントを `parseDiscussionEvent` でパース
2. パース失敗（null）を除外
3. `createdAt` の最大値を持つ Discussion を返す
4. イベントが0件の場合は null

### 4.3 handleRetry

```typescript
const handleRetry = () => {
  setDiscussionError(null);
  loadDiscussionData();
};
```

---

## 5. テストデータ構造

### Test Discussion

**ソース**: `public/test_data/comments.csv` + `public/test_data/votes.json`

**生成される Discussion**:
```typescript
{
  id: "test-discussion-id",
  dTag: "test",
  title: "統計処理のテスト: AI生成物の著作権について",
  description: "この会話はPolisのテストデータを使用しています。\n\n...",
  authorPubkey: "test-author",
  moderators: [],
  createdAt: 1700000000,
  event: undefined
}
```

**判定ロジック**:
```typescript
isTestMode("test") === true
isTestMode("a52957e8-b28f-4b43-b037-e6c4fd34ec6c") === true
isTestMode("other-id") === false
```

---

## 6. パフォーマンス考慮事項

### メモリ使用量

| 項目 | サイズ（推定） |
|------|---------------|
| Discussion オブジェクト | ~1KB |
| ストリーム接続 | ~10KB（WebSocket） |
| イベント配列（onEvent） | ~5KB（複数イベント） |
| 合計 | ~16KB |

### ネットワーク

| 操作 | データ量 | 頻度 |
|------|---------|------|
| 初回 kind:34550 取得 | ~1KB | 1回 |
| リアルタイム更新 | ~1KB | 編集時のみ |
| ストリーム維持 | 微小 | 継続的 |

### 最適化ポイント

1. **loadSequence パターン**: 古いデータの破棄で無駄な更新を防止
2. **条件付きレンダリング**: `discussion` が null の場合は表示しない
3. **クリーンアップ**: ページ離脱時にストリームを確実に停止

---

## 7. エラーケース

### 7.1 無効な NADDR

**状態**:
- `discussionInfo: null`
- レイアウト外（`layout.tsx` の呼び出し元）でエラー処理

**表示**:
- 「無効な会話URL」メッセージ（`layout.tsx` の親で処理）

### 7.2 ネットワークエラー

**状態**:
- `discussion: null`
- `isDiscussionLoading: false`
- `discussionError: "会話データの取得に失敗しました"`

**表示**:
- エラーメッセージ + 再試行ボタン
- タブナビゲーションと戻るリンクは維持

### 7.3 会話が存在しない

**状態**:
- `discussion: null`
- `isDiscussionLoading: false`
- `discussionError: null`（EOSE 後もデータなし）

**表示**:
- 「会話が見つかりません」メッセージ
- タブナビゲーションと戻るリンクは維持

### 7.4 テストデータロード失敗

**状態**:
- `discussion: null`
- `isDiscussionLoading: false`
- `discussionError: "テストデータの読み込みに失敗しました"`

**表示**:
- エラーメッセージ + 再試行ボタン

---

## 8. 型安全性チェックリスト

- [x] すべての状態に明示的な型定義
- [x] `null` と `undefined` の明確な使い分け
- [x] `any` 型の不使用
- [x] 型ガードによる型の絞り込み（`filter((d): d is Discussion => d !== null)`）
- [x] Optional chaining の適切な使用（`discussionStreamCleanupRef.current?.()`）
- [x] 非同期関数の戻り値型（`Promise<void>`）
- [x] コールバック関数の型定義（`StreamEventsOptions`）

---

## Summary

本データモデルは、既存の `Discussion` と `DiscussionInfo` 型を使用し、最小限の新規状態で実装されています。状態遷移とデータフローは既存のパターンに従い、型安全性とエラーハンドリングを重視した設計です。
