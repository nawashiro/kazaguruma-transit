# Google Analytics 4設定

## 設定入力

測定IDは公開アプリ設定`app-config.json`の`gaMeasurementId`へ設定します。

```bash
cp app-config.json.example app-config.json
```

`app-config.json`はGitで管理しません。測定IDを`.env.local`や`transit-config.json`へ移しません。サーバー秘密値を`app-config.json`へ入れません。

`app-config.json`がない場合、`npm run dev`、`npm test`、`npm run build`、`npm start`は非ゼロで終了します。これらのコマンドはexampleから設定を自動生成しません。Quality Gateだけがcheckout内へ一時コピーを作ります。

## 実装

- `src/app/layout.tsx`が`GoogleAnalytics`をroot layoutへ配置します。
- `src/components/layouts/GoogleAnalytics.tsx`が`useGA`をSuspense内で呼び出します。
- `src/lib/analytics/useGA.ts`が`appConfig.gaMeasurementId`を読みます。

`useGA`はpathnameとsearch paramsを監視し、ページビューを送ります。測定IDが空の場合は送信しません。

## 実行環境ごとの動作

`NODE_ENV`が`development`のとき、GAを初期化せず、ページビューとイベントを送信しません。代わりにログを出します。

`development`以外では、測定IDがある場合にGAを初期化し、ページビューを送ります。

## カスタムイベント

カスタムイベントは`sendEvent`を使います。

```typescript
import { sendEvent } from "@/lib/analytics/useGA";

sendEvent("category", "action", "label", 1);
```

引数は`category`、`action`、任意の`label`、任意の`value`です。開発環境ではログだけを出し、それ以外では測定IDがある場合に送信します。

## 確認

1. `app-config.json`へ配布先の測定IDを設定します。
2. `npm run dev`を実行します。
3. ブラウザでページを開き、開発者コンソールにGA無効化のログが出ることを確認します。
4. 非development環境では、測定IDを設定したbuildを起動し、ページ遷移とイベントの送信を確認します。

```bash
npm run lint
npm test -- --runInBand --ci
```
