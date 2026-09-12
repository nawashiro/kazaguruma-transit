# Research: 監査ページのヘッダー要素レイアウト移動

**Date**: 2026-01-15
**Feature**: 001-audit-header-layout

## Overview

本ドキュメントは、会話詳細ページのヘッダー要素をレイアウトコンポーネントに移動するための技術調査結果をまとめています。既存の実装パターンを分析し、最適な設計判断の根拠を記録します。

---

## 1. データ取得方法の選択

### Decision: `streamDiscussionMeta` を使用

**選択理由**:
1. **リアルタイム更新**: 会話情報の変更（タイトル・説明の編集）をリアルタイムで反映
2. **既存パターンとの整合性**: `audit/page.tsx` および `page.tsx` で使用されている実装パターン
3. **パフォーマンス**: ストリーミングにより、データ到着次第即座に表示更新

**実装パターン** (`page.tsx:247-267` を参照):
```typescript
discussionStreamCleanupRef.current = nostrService.streamDiscussionMeta(
  discussionInfo.authorPubkey,
  discussionInfo.dTag,
  {
    onEvent: (events) => {
      const latest = pickLatestDiscussion(events);
      if (latest) {
        setDiscussion(latest);
        setIsDiscussionLoading(false);
      }
    },
    onEose: (events) => {
      const latest = pickLatestDiscussion(events);
      if (latest) {
        setDiscussion(latest);
      }
      setIsDiscussionLoading(false);
    }
  }
);
```

### Alternatives Considered

**1. `getReferencedUserDiscussions` (却下)**
- 理由: 一度限りの取得、リアルタイム更新不可
- トレードオフ: 実装はシンプルだが、ユーザー体験が劣る

**2. `getDiscussionByNaddr` (仮想的な新規関数、却下)**
- 理由: 新規APIの作成が必要、既存パターンと乖離
- トレードオフ: ストリーミング不要なら実装はシンプル

### Best Practices from Codebase

- **ストリームクリーンアップ**: `useRef` でクリーンアップ関数を保持し、useEffect のクリーンアップで呼び出す
- **最新イベント選択**: 複数イベントから `createdAt` の最大値で最新を選択（`pickLatestDiscussion`）
- **EOSE ハンドリング**: `onEose` でストリーム終了を検知し、ローディング状態を終了

---

## 2. 状態管理の選択

### Decision: useState + useRef (Context 不要)

**選択理由**:
1. **シンプルさ**: ローカル状態管理で十分、過剰設計を避ける
2. **独立性**: レイアウトとメインページは独立してデータ取得（明確化で確定）
3. **キャッシュ戦略**: ブラウザキャッシュとNostrリレーの効率性で重複を軽減
4. **既存パターン**: 監査ページと同じアプローチ

**実装パターン**:
```typescript
// 状態
const [discussion, setDiscussion] = useState<Discussion | null>(null);
const [isDiscussionLoading, setIsDiscussionLoading] = useState(true);
const [discussionError, setDiscussionError] = useState<string | null>(null);

// Ref（クリーンアップと非同期制御）
const discussionStreamCleanupRef = useRef<(() => void) | null>(null);
const loadSequenceRef = useRef(0);
```

### Alternatives Considered

**1. React Context (却下)**
- 理由: 過剰設計、コンポーネント間のデータ共有が不要
- トレードオフ: 重複取得を完全に回避できるが、実装が複雑化
- 明確化での決定: 「レイアウトとメインページは独立してデータ取得」

**2. TanStack Query / SWR (却下)**
- 理由: 既存コードベースで使用されていない、学習コストが高い
- トレードオフ: 自動キャッシュ・再取得機能が充実するが、新規依存関係

### Best Practices from Codebase

- **loadSequence パターン**: 非同期操作の競合を防止（`page.tsx:90, 199`）
  ```typescript
  const loadSequenceRef = useRef(0);
  const loadSequence = ++loadSequenceRef.current;

  // データ到着時にシーケンス確認
  if (loadSequenceRef.current !== loadSequence) return;
  ```

- **クリーンアップパターン**: ストリームを確実にクリーンアップ
  ```typescript
  useEffect(() => {
    // 前のストリームをクリーンアップ
    discussionStreamCleanupRef.current?.();

    // 新しいストリーム開始
    discussionStreamCleanupRef.current = nostrService.streamDiscussionMeta(...);

    // クリーンアップ関数
    return () => {
      discussionStreamCleanupRef.current?.();
      discussionStreamCleanupRef.current = null;
    };
  }, [dependencies]);
  ```

---

## 3. ローディング状態の表示方法

### Decision: 段階的ローディング（タブ+戻るリンク → タイトル+説明）

**選択理由**:
1. **UX向上**: ユーザーは即座にナビゲーション可能（タブ・戻るリンク）
2. **データ依存の明確化**: タイトル・説明は外部データ、タブ・戻るリンクは静的
3. **エラー時の一貫性**: データ取得エラー時もナビゲーションは維持（明確化で確定）

**実装パターン**:
```typescript
// ローディング中: タブ+戻るリンクのみ表示
{!isDiscussionLoading && discussion && (
  <>
    <h1 className="text-3xl font-bold mb-4 ruby-text">
      {discussion.title}
    </h1>
    {discussion.description.split("\n").map((line, idx) => (
      <p key={idx} className="text-gray-600 dark:text-gray-400 ruby-text">
        {line}
      </p>
    ))}
  </>
)}
```

### Alternatives Considered

**1. 全要素同時表示（スケルトンローダー）(却下)**
- 理由: タブ・戻るリンクまでローディング表示する必要がない
- トレードオフ: 実装がシンプルだが、UXが劣る

**2. スケルトンプレースホルダー（グレーボックス）(却下)**
- 理由: 段階的表示の方が情報の優先度が明確
- トレードオフ: ローディング中の視覚的フィードバックは良いが、実装が複雑

### Best Practices from Codebase

- **条件付きレンダリング**: データ到着後に表示（`&& discussion &&`）
- **ruby-text クラス**: 日本語テキストに一貫して適用
- **複数行対応**: `description.split("\n").map()` で改行を保持

---

## 4. エラーハンドリング

### Decision: エラー時もタブナビゲーション表示

**選択理由**:
1. **ナビゲーション維持**: ユーザーは戻るリンクやタブで脱出可能（明確化で確定）
2. **エラー表示**: エラーメッセージは日本語で分かりやすく
3. **再試行機能**: エラー時に再試行ボタンを表示

**実装パターン** (`AuditLogSection.tsx:300-310` を参照):
```typescript
if (discussionError) {
  return (
    <div className="alert alert-error" role="alert">
      <span>{discussionError}</span>
      <button
        className="btn btn-sm btn-outline"
        onClick={() => {
          setDiscussionError(null);
          loadDiscussionData();
        }}
      >
        再試行
      </button>
    </div>
  );
}
```

### Alternatives Considered

**1. レイアウト全体を非表示（却下)**
- 理由: ユーザーがナビゲーションできなくなる
- 明確化での決定: 「エラー時もタブナビゲーションは表示」

**2. 自動再試行（却下)**
- 理由: ユーザーの意図しないリクエスト増加、リレーへの負荷
- トレードオフ: UXは向上するが、エラーループのリスク

### Best Practices from Codebase

- **role="alert"**: エラーメッセージにARIA属性を付与（アクセシビリティ）
- **日本語エラーメッセージ**: 技術的詳細ではなく、ユーザー向けの説明
- **再試行ボタン**: 明示的なユーザーアクション

---

## 5. テストモード対応

### Decision: `isTestMode` 判定 + `loadTestData`

**選択理由**:
1. **既存パターン**: `page.tsx`、`audit/page.tsx`、`AuditLogSection.tsx` で統一
2. **テストデータ互換性**: CSV/JSON ベースのテストデータを使用

**実装パターン** (`page.tsx:212-228` を参照):
```typescript
if (isTestMode(discussionInfo.dTag)) {
  loadTestData()
    .then((testData) => {
      if (loadSequenceRef.current !== loadSequence) return;
      setDiscussion(testData.discussion);
      setIsDiscussionLoading(false);
    })
    .catch((error) => {
      logger.error("Failed to load discussion:", error);
      setDiscussionError("テストデータの読み込みに失敗しました");
    })
    .finally(() => {
      if (loadSequenceRef.current === loadSequence) {
        setIsDiscussionLoading(false);
      }
    });
  return;
}
```

### Test Data Structure

**テスト会話ID**: `a52957e8-b28f-4b43-b037-e6c4fd34ec6c`

**テストDiscussion**:
```typescript
{
  id: "test-discussion-id",
  dTag: "test",
  title: "統計処理のテスト: AI生成物の著作権について",
  description: "この会話はPolisのテストデータを使用しています。",
  authorPubkey: "test-author",
  moderators: [],
  createdAt: 1700000000,
  // ...
}
```

### Best Practices from Codebase

- **早期リターン**: テストモードの場合、Nostrストリーミングをスキップ
- **loadSequence チェック**: テストデータロード中も非同期制御を維持
- **エラーハンドリング**: テストデータのロード失敗も適切に処理

---

## 6. スタイリングとアクセシビリティ

### Decision: 既存パターンを踏襲

**選択理由**:
1. **一貫性**: 既存の会話ページと同じスタイル（明確化で確定）
2. **アクセシビリティ**: WCAG 2.1 AA 準拠を維持
3. **DaisyUI + Tailwind**: プロジェクトの標準パターン

**スタイリングパターン**:
```typescript
// 戻るリンク
<Link
  href="/discussions"
  className="btn btn-ghost btn-sm rounded-full dark:rounded-sm"
>
  <span className="ruby-text">← 会話一覧に戻る</span>
</Link>

// タイトル
<h1 className="text-3xl font-bold mb-4 ruby-text">
  {discussion.title}
</h1>

// 説明
{discussion.description.split("\n").map((line, idx) => (
  <p key={idx} className="text-gray-600 dark:text-gray-400 ruby-text">
    {line}
  </p>
))}

// ローディングスピナー
<div
  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 ruby-text"
  role="status"
  aria-live="polite"
>
  <div className="loading loading-spinner loading-sm" aria-hidden="true"></div>
  <span>会話情報を読み込み中...</span>
</div>
```

### Accessibility Checklist

- [x] **role="status"**: ローディング状態に付与
- [x] **aria-live="polite"**: スクリーンリーダーに通知
- [x] **aria-hidden="true"**: 装飾的なスピナーを非表示
- [x] **ruby-text クラス**: 日本語フォント調整
- [x] **タッチターゲット**: ボタンは既に44px以上（`btn-sm` でも最小サイズ確保）

### Best Practices from Codebase

- **dark: プレフィックス**: ダークモード対応
- **rounded-full dark:rounded-sm**: iOS との互換性（CLAUDE.md で指定）
- **flex items-center gap-2**: 一貫したスペーシング

---

## 7. パフォーマンス考慮事項

### キャッシュ戦略

**Nostrリレーのキャッシュ**:
- リレーサーバー側で kind:34550 イベントをキャッシュ
- 同一イベントの重複取得は自動的に軽減

**ブラウザキャッシュ**:
- HTTP キャッシュは適用されない（WebSocket 経由）
- メモリ内のイベントキャッシュは nostr-tools が管理

**重複取得の影響**:
- レイアウトとメインページが独立して取得しても、リレーの効率性により実質的な負荷は最小限
- kind:34550 は通常1つのイベント（軽量）

### ストリーミングのオーバーヘッド

**メリット**:
- リアルタイム更新により、ユーザーは常に最新情報を取得
- EOSE 後もコネクションを維持し、更新を即座に反映

**デメリット**:
- WebSocket 接続の維持（軽微なリソース消費）
- 対策: `useEffect` のクリーンアップで確実に切断

### Best Practices

- **loadSequence パターン**: 古いデータの破棄で無駄な更新を防止
- **クリーンアップ**: ページ離脱時にストリームを停止
- **条件付きローディング**: データ到着済みの場合は再取得しない

---

## 8. 実装の優先順位

### Phase 1: コアデータ取得（P1）
1. `DiscussionTabLayout` に状態追加
2. `extractDiscussionFromNaddr` で naddr 抽出
3. `streamDiscussionMeta` でデータ取得
4. `pickLatestDiscussion` で最新選択

### Phase 2: ローディング状態（P1）
1. 段階的ローディング実装
2. ローディングスピナー表示
3. データ到着後の条件付きレンダリング

### Phase 3: エラーハンドリング（P1）
1. try-catch + エラー状態管理
2. エラーメッセージ表示
3. 再試行ボタン

### Phase 4: テストモード（P2）
1. `isTestMode` 判定
2. `loadTestData` 統合
3. テストデータの表示

### Phase 5: リファクタリング（P1）
1. `page.tsx` からヘッダー要素削除
2. `audit/page.tsx` から見出し削除
3. スタイル調整

### Phase 6: テスト（P1）
1. データ取得のテスト
2. ローディング状態のテスト
3. エラー処理のテスト
4. テストモードのテスト

---

## 9. リスクと緩和策

### Risk 1: 重複データ取得によるパフォーマンス劣化

**リスク**: レイアウトとメインページが同じデータを取得

**緩和策**:
- Nostrリレーのキャッシュで軽減
- kind:34550 は軽量（通常数KB）
- 明確化で設計判断を確定（独立取得が方針）

**モニタリング**:
- ブラウザのネットワークタブで実際の重複を確認
- 必要に応じて Context を導入（将来の最適化）

### Risk 2: ストリーミングのクリーンアップ漏れ

**リスク**: メモリリークやコネクション残存

**緩和策**:
- `useRef` でクリーンアップ関数を保持
- `useEffect` のクリーンアップで確実に呼び出し
- 既存パターンを踏襲

**モニタリング**:
- React DevTools の Profiler でメモリ使用量を確認
- ページ遷移時のコネクション状態を確認

### Risk 3: テストモードの互換性

**リスク**: テストデータの構造変更

**緩和策**:
- `loadTestData` の戻り値型を使用
- テストケースで検証

**モニタリング**:
- テストモードでの動作確認
- CI/CD でのテスト実行

---

## 10. 技術的負債の回避

### 回避した過剰設計

1. **React Context**: 現時点では不要、将来の最適化として保留
2. **TanStack Query**: 新規依存関係の追加を回避
3. **カスタムフック**: 単一コンポーネントでの使用のため不要

### 採用した既存パターン

1. **streamDiscussionMeta**: 実績のあるパターン
2. **loadSequence**: 非同期制御の標準パターン
3. **段階的ローディング**: UX向上の実証済みパターン

### 将来の拡張性

- **Context 導入**: データ共有が必要になった場合の準備
- **カスタムフック**: 複数コンポーネントで使用する場合の抽出
- **キャッシュライブラリ**: パフォーマンス問題が顕在化した場合の選択肢

---

## Summary

本リサーチの結果、以下の設計判断を下しました：

1. **データ取得**: `streamDiscussionMeta` によるリアルタイム更新
2. **状態管理**: useState + useRef（Context 不要）
3. **ローディング**: 段階的表示（タブ+戻るリンク → タイトル+説明）
4. **エラー処理**: タブナビゲーション維持 + エラーメッセージ + 再試行
5. **テストモード**: 既存パターン踏襲
6. **スタイリング**: 既存パターン踏襲、WCAG 2.1 AA 準拠

これらの決定は、既存のコードベースとの整合性、ユーザー体験、保守性、パフォーマンスのバランスを考慮した結果です。
