# Quickstart: 監査ページリファクタリングと表示不具合修正

**Feature**: 001-audit-page-refactor
**Date**: 2026-01-14

## 前提条件

- Node.js 18以上
- npm 9以上
- 開発環境がセットアップ済み（`npm install`完了）

## 開発サーバー起動

```bash
npm run dev
```

開発サーバーは http://localhost:3000 で起動します。

## 関連ページ

この機能で変更/追加されるページ：

| URL | 説明 | 状態 |
|-----|------|------|
| `/discussions` | 会話一覧（メイン） | 既存 |
| `/discussions/audit` | 会話一覧（監査） | **新規** |
| `/discussions/[naddr]` | 会話詳細（メイン） | 既存 |
| `/discussions/[naddr]/audit` | 会話詳細（監査） | **新規** |

## テスト実行

```bash
# 全テスト実行
npm test

# 特定のテストファイル
npm test -- AuditLogSection.test.tsx
npm test -- DiscussionTabLayout.test.tsx

# watchモード
npm run test:watch
```

## 型チェック

```bash
npx tsc --noEmit
```

## Lint

```bash
npm run lint
```

## ビルド確認

```bash
npm run build
```

---

## ファイル構成

### 新規作成ファイル

```
src/
├── app/discussions/
│   ├── audit/
│   │   └── page.tsx              # 会話一覧監査ページ
│   └── [naddr]/
│       └── audit/
│           └── page.tsx          # 会話詳細監査ページ
└── components/discussion/
    └── DiscussionTabLayout.tsx   # タブナビゲーション
```

### 修正ファイル

```
src/
├── app/discussions/
│   └── [naddr]/
│       └── layout.tsx            # タブナビゲーション追加
└── components/discussion/
    └── AuditLogSection.tsx       # 独自Discussion取得追加
```

### テストファイル

```
tests/
├── app/discussions/
│   ├── audit/
│   │   └── page.test.tsx
│   └── [naddr]/
│       └── audit/
│           └── page.test.tsx
└── components/discussion/
    ├── AuditLogSection.test.tsx  # 追加テスト
    └── DiscussionTabLayout.test.tsx
```

---

## 環境変数

必須の環境変数（`.env.local`）：

```bash
# Nostrリレー設定
NEXT_PUBLIC_NOSTR_RELAYS="wss://relay.example.com"

# 会話一覧ページのNADDR
NEXT_PUBLIC_DISCUSSION_LIST_NADDR="naddr1..."

# ディスカッション機能有効化
NEXT_PUBLIC_DISCUSSIONS_ENABLED="true"
```

---

## デバッグ

### ログ出力

開発中は`logger`を使用してデバッグ情報を出力：

```typescript
import { logger } from "@/utils/logger";

logger.info("Audit data loaded", { count: items.length });
logger.error("Failed to load audit data", error);
```

ブラウザの開発者ツールのコンソールでログを確認できます。

### Nostrイベント確認

Nostrリレーから取得したイベントを確認するには：

1. ブラウザの開発者ツールを開く
2. Network タブで WebSocket 通信を確認
3. メッセージ内容でイベントデータを確認

---

## 実装の進め方

1. **テスト駆動開発（TDD）**: まずテストを書いてから実装
2. **アクセシビリティ確認**: タブナビゲーションのキーボード操作を確認
3. **エラーハンドリング**: 各データ取得でエラー状態を確認

### テスト優先順位

1. DiscussionTabLayout のアクセシビリティテスト
2. AuditLogSection の独自Discussion取得テスト
3. 監査ページのレンダリングテスト
4. エラー状態のテスト

---

## トラブルシューティング

### 監査データが表示されない

1. コンソールでエラーログを確認
2. Network タブでWebSocket接続を確認
3. `NEXT_PUBLIC_DISCUSSION_LIST_NADDR`が正しく設定されているか確認

### タブが機能しない

1. `usePathname()`が正しいパスを返しているか確認
2. `baseHref`が正しく設定されているか確認
3. Linkコンポーネントのhref属性を確認

---

## References

- [plan.md](./plan.md) - 実装計画
- [data-model.md](./data-model.md) - データモデル
- [research.md](./research.md) - 調査結果
- [CLAUDE.md](../../CLAUDE.md) - プロジェクト規約
