# Google Analytics 4 (GA4) 設定

このプロジェクトでは Google Analytics 4 (GA4) を使用してユーザーの行動を追跡しています。

## セットアップ方法

1. Google Analytics アカウントにアクセスして、GA4 のプロパティを作成します。
2. データストリームの設定で「Web」を選択し、サイト情報を入力します。
3. 測定 ID（例: G-XXXXXXXXXX）を取得します。
4. 運用者が`app-config.json.example`を`app-config.json`へコピーし、`gaMeasurementId`へ測定IDを設定します。
   `app-config.json`は配布先ごとの設定であり、Gitでは管理しません。

```json
{
  "gaMeasurementId": "G-XXXXXXXXXX"
}
```

運用者が`app-config.json`を用意してJSONを変更してからbuildします。`npm run dev`、`npm test`、
`npm run build`、`npm start`はファイルの存在だけを検証し、欠落時は非ゼロで終了します。
これらのコマンドはexampleから自動生成しません。Quality GateのCIだけが、チェックアウト内に一時コピーを明示的に用意します。
実際の測定IDなどの配布先固有値はリポジトリへ保存・公開しません。

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
