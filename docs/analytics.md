# Google Analytics 4 (GA4) 設定

このプロジェクトでは Google Analytics 4 (GA4) を使用してユーザーの行動を追跡しています。

## セットアップ方法

1. Google Analytics アカウントにアクセスして、GA4 のプロパティを作成します
2. データストリームの設定で「Web」を選択し、サイト情報を入力します
3. 測定 ID（例: G-XXXXXXXXXX）を取得します
4. プロジェクトのルートに `.env.local` ファイルを作成して、以下の内容を追加します:

```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

※ 「G-XXXXXXXXXX」の部分を実際の測定 ID に置き換えてください

## 使用方法

### ページビューの追跡

ページビューは自動的に追跡されます。`GoogleAnalytics` コンポーネントが `app/layout.tsx` に含まれているため、ページ遷移が発生するたびにイベントが送信されます。

### カスタムイベントの送信

特定のユーザーアクションを追跡するには、以下のようにカスタムイベントを送信できます:

```typescript
import { sendEvent } from "@/lib/analytics/ga4";

// イベントを送信
sendEvent(
  "category", // カテゴリ（例: 'UI Action'）
  "action", // アクション（例: 'Button Click'）
  "label", // ラベル（例: 'Search Button'）
  value // 値（数値、オプション）
);
```

## 注意事項

- GA4 の追跡はプロダクション環境でのみ有効になります
- 開発環境では、イベントは送信されず、コンソールにログが表示されます
- 測定 ID を `.env.local` ファイルに設定する必要があります
