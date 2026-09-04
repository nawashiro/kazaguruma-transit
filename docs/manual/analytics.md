# Google Analytics 4 (GA4) 設定

このプロジェクトでは Google Analytics 4 (GA4) を使用してユーザーの行動を追跡しています。

## セットアップ方法

1. Google Analytics アカウントにアクセスして、GA4 のプロパティを作成します。
2. データストリームの設定で「Web」を選択し、サイト情報を入力します。
3. 測定 ID（例: G-XXXXXXXXXX）を取得します。
4. `app-config.json.example`を`app-config.json`へコピーし、`gaMeasurementId`へ測定IDを設定します。
   `app-config.json`は配布先ごとの設定であり、Gitでは管理しません。

```json
{
  "gaMeasurementId": "G-XXXXXXXXXX"
}
```

公開設定はJSONを変更してからbuildします。`app-config.json`が無い場合は、`npm run dev`、`npm test`、
`npm run build`、`npm start`がexampleから自動生成します。

## 使用方法

### ページビューの追跡

ページビューは自動的に追跡されます。`GoogleAnalytics` コンポーネントが `app/layout.tsx` に含まれているため、ページ遷移が発生するたびにイベントが送信されます。

### カスタムイベントの送信

特定のユーザーアクションを追跡するには、以下のようにカスタムイベントを送信できます:

```typescript
import { sendEvent } from "@/lib/analytics/useGA";

sendEvent(
  "category",
  "action",
  "label",
  value
);
```

## 注意事項

- GA4 の追跡はプロダクション環境でのみ有効になります。
- 開発環境では、イベントは送信されず、コンソールにログが表示されます。
- 測定IDは公開情報であり、配布先固有のgitignored `app-config.json`へ置かれます。
