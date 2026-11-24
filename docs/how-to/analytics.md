# Google Analytics 4設定

## 設定入力

測定IDは公開アプリ設定の`gaMeasurementId`へ設定します。本番は`app-config.json`、開発は`app-config.local.json`を使います。

```bash
cp app-config.json.example app-config.json
cp app-config.json.example app-config.local.json
```

- 2つの設定ファイルはGitで管理しません。
- 測定IDを`.env.local`や`transit-config.json`へ移しません。
- サーバー秘密値を設定ファイルへ入れません。

どちらかの設定ファイルがない場合、`npm run dev`、`npm test`、`npm run build`、`npm start`は非ゼロで終了します。これらのコマンドはテンプレートから設定を自動生成しません。Quality Gateだけがcheckout内へ一時コピーを作ります。`app-config.json.example`は開発用の値を持つので、本番の測定IDは`app-config.json`へ書きます。

## 計測の実装

- `src/app/layout.tsx`が`GoogleAnalytics`をroot layoutへ配置します。
- `src/components/layouts/GoogleAnalytics.tsx`が`useGA`をSuspense内で呼び出します。
- `src/lib/analytics/useGA.ts`がページビューを送ります。
- `src/lib/analytics/tracking.ts`がイベント送信、運営者の識別、検索開始時刻の保存を持ちます。
- `src/components/features/RouteSearchTracker.tsx`が結果ページの表示時に`route_search`を送ります。

`useGA`はpathnameとsearch paramsを監視し、ページビューを送ります。測定IDが空の場合は送信しません。開発環境では初期化せず、イベントはコンソールへ出力します。

ページ側のイベントは、`useGA`の初期化（`config`）より先に発火することがあります。`track`は未初期化のあいだイベントを保持し、初期化後にまとめて送ります。`flushPendingEvents`を`useGA`が初期化直後に呼びます。保持するのは最大20件です。


## 計測するイベント

| イベント | 送る条件 | パラメーター |
|---|---|---|
| `route_search` | 入力画面から検索し、結果ページに検索結果を表示した | `elapsed_ms` |
| `place_search` | 住所検索が終わった | `field`、`outcome` |
| `place_select` | 地点を確定した | `field`、`source` |
| `gps_result` | GPSの取得が終わった | `outcome` |
| `validation_failed` | 地点が未確定のまま送信した | `missing` |
| `result_action` | PDFまたはカレンダーの出力を開始した | `action` |

パラメーターの値は次のとおりです。

- `field`: `origin`、`destination`
- `outcome`（住所検索）: `found`、`not_found`、`failed`、`rate_limited`
- `outcome`（GPS）: `granted`、`denied`、`timeout`、`unsupported`
- `source`: `address`、`catalog`、`gps`、`detail`
- `missing`: `origin`、`destination`、`both`
- `action`: `pdf`、`calendar`

座標、住所、停留所名、入力した文字列はイベントへ含めません。

イベントは`track`で送ります。

```typescript
import { track } from "@/lib/analytics/tracking";

track("place_select", { field: "destination", source: "catalog" });
```

## カスタム定義

GA4の管理画面で、次のイベントスコープのカスタムディメンションとカスタム指標を登録します。登録しないと、探索レポートの条件に使えません。

| 種別 | 名前 | イベントパラメーター |
|---|---|---|
| ディメンション | 入力項目 | `field` |
| ディメンション | 入力の入口 | `source` |
| ディメンション | 入力の結果 | `outcome` |
| ディメンション | 未確定の項目 | `missing` |
| ディメンション | 出力の種類 | `action` |
| 指標 | 経過時間（ミリ秒） | `elapsed_ms` |

## 運営者のアクセスを除外する

運営者の回線は動的IPなので、IPでは除外しません。ブラウザに印を保存し、そのブラウザからの送信だけを内部トラフィックとして扱います。

1. 除外したいブラウザで`https://<本番のURL>/?owner=1`を開きます。
2. アドレスバーから`owner`が消え、以後のページビューとイベントに`traffic_type=internal`と`user_type=owner`が付きます。
3. 印を消すときは`https://<本番のURL>/?owner=0`を開きます。

印は`localStorage`に保存します。端末、ブラウザ、プロファイルごとに一度設定します。シークレットウィンドウと、保存領域を消したあとのブラウザは、もう一度設定してください。

`?owner=1`を付けても、画面の表示、検索結果、共有URLは変わりません。

## GA4の管理画面設定

1. 管理 > データ設定 > データ保持で、保持期間を14か月にします。
2. 管理 > データストリーム > 対象のストリーム > 拡張計測機能の設定で、次をオフにします。
   - 「履歴変更によるページビュー」: `useGA`が自前でページビューを送るため、二重計上になります。
   - 「フォーム操作」: `form_submit`はフォームを区別できないため、明示イベントへ置き換えます。
3. 管理 > データ設定 > データフィルタで、「内部トラフィック」と「開発者トラフィック」を有効にします。
   - 最初は「テスト」のまま1日置きます。
   - 翌日の標準レポートに自分のアクセスが出ないことを確認してから、「有効」に変えます。データフィルタは元に戻せません。

## 確認

1. `?owner=1`を設定したブラウザで`npm run dev`ではなく本番のURLを開き、管理 > DebugViewで`route_search`が1回だけ届くことを確認します。`elapsed_ms`が付いていることも確認します。
2. 印の無いブラウザで入力画面から検索し、翌日の標準レポートに`route_search`が出ることを確認します。
3. 印のあるブラウザのアクセスが、翌日の標準レポートに出ないことを確認します。
4. データフィルタを有効にしたあと、同じ確認を1回行います。

## 月次の見方

探索レポートを2つ保存します。

- 月次サマリ: `route_search`の回数とユーザー数。
- 入力ファネル: `page_view`、`place_select`、`route_search`、`result_action`の4段。

月50〜70人では、段ごとの1〜2人の差はノイズです。判断は四半期にまとめ、月次は急な増減の検知だけに使います。GAは広告ブロックなどの影響で実利用より少なく出るため、数字は下限として扱います。

`route_search`は、経路が見つからなかった検索も数えます。検索の実行回数を見る指標であり、経路の有無は別に見ます。
