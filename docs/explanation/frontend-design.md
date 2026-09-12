# フロントエンド設計

この文書は、現在のフロントエンド構成と責務を説明します。実在するディレクトリと実装を基準にします。

## 全体構成

```text
src/app                 App Routerの画面とレイアウト
  ↓
src/components/layouts  共通シェルとページ構造
src/components/features 機能単位の画面部品
src/components/discussion 意見交換の画面と状態
src/components/auth     認証画面と認証フォーム
src/components/ui       共有UI部品
  ↓
src/lib                  ドメイン処理、サービス、読み取り調整、設定
src/types・src/utils     型と共通補助処理
```

ページは画面の境界を持ちます。コンポーネントは表示と操作を組み立てます。`src/lib`はデータ変換、外部通信、状態計算を担当します。

## `src/app`

`src/app`はNext.js App Routerのルート正本です。`page.tsx`は画面を提供し、`layout.tsx`は共通構造を提供します。現在の主な画面は次です。

- `/`: `HomeRouteForm`で経路条件を入力
- `/routes`: 経路検索結果を表示
- `/locations`と`/locations/[category-id]`: 場所一覧を表示
- `/locations/location-detail/[id]`: 場所詳細を表示
- `/discussions/**`: 会話、投稿、評価、承認、役割を表示
- `/login`、`/signup`、`/settings`: 認証とアカウントを表示
- `/beginners-guide`、`/usage`、`/award`、`/license`: 案内と情報を表示

ページは、サーバーでデータを読んでから描画する場合と、クライアントで操作状態を管理する場合があります。`force-dynamic`は認証コンテキストやNostr読み取りを必要とする画面で使います。

## `src/components/layouts`

レイアウト部品はページの外枠を担当します。

- `SidebarLayout`: ドロワー、ヘッダー、テーマ切り替え、ルビ、メイン領域、支援フレーム、フッターを配置
- `Sidebar`: サイト内ナビゲーションと外部入口を提供
- `PageHeader`: ページの見出しと説明を表示

`SidebarLayout`は`main#main-content`を1つ提供します。`SkipToContent`はこのIDへ移動します。サイドバーの表示は画面幅で変わります。ページ部品は共通シェルを重複して作りません。

## `src/components/ui`

`ui`は複数の機能で使う共有部品を置きます。例は次です。

- `Button`: ボタンの種類、無効状態、読み込み状態を統一
- `Card`: 情報のまとまりを表示
- `InputField`: ラベル、入力、必須状態、エラーを統一
- `SkipToContent`: メイン領域へのスキップリンクを提供
- `ThemeToggle`: テーマを切り替え
- `UserIdentity`と`NpubDisplay`: 利用者識別子を表示

共有部品はpropsで表示と動作を受け取ります。読み込み表示やフォーカス属性など、共通で守る状態も部品側で扱います。機能固有の通信やドメイン判定は置きません。

## `src/components/features`

`features`は経路検索、場所検索、出力、支援などの機能部品を置きます。

- `HomeRouteForm`: 目的地、出発地、日時、速度優先を管理し、`/routes`へ移動
- `DestinationSelector`と`OriginSelector`: 場所の選択を提供
- `DateTimeSelector`: 出発または到着日時を提供
- `RouteSearchResults`: クエリを検証し、`/api/transit`の結果を表示
- `IntegratedRouteDisplay`: 経路と停留所を表示
- `LocationCategoryNavigation`と`LocationSortControls`: カテゴリ移動と並べ替えを提供
- `RouteCalendarExport`と`RoutePdfExport`: 出力操作を提供
- `KoFiSupport`と`Announcement`: 条件付きの案内を表示

機能部品は共有UI部品を組み合わせます。ルートの検証やURLの生成は`src/lib/transit`へ委譲します。

## `src/components/discussion`と`src/components/auth`

`discussion`は意見交換のドメイン部品を置きます。`DiscussionDetailProvider`と`DiscussionManagementProvider`は読み取り状態とスナップショットを提供します。`DiscussionTabLayout`は会話固有のタブを提供します。`BusStopMemo`と`BusStopDiscussion`は経路結果の停留所別意見交換を提供します。`PermissionGuards`はログイン、管理者、モデレーター、作成者の表示と無効理由を統一します。

`auth`は認証フォームと認証ルートの部品を置きます。ページは`useAuth`を通じて認証状態と署名処理を受け取ります。

## `src/lib`

`src/lib`はUIから独立した処理を置きます。

- `lib/nostr`はNostrイベント、naddr、リレー通信、署名・公開を担当
- `lib/discussion`は会話の設定、権限、読み取り計画、coordinator、承認状態を担当
- `lib/evaluation`は評価変換、Polis合意分析、結果整形を担当
- `lib/location`は場所データ、詳細解決、カテゴリ状態、距離計算を担当
- `lib/transit`は経路クエリ、API境界、結果モデルを担当
- `lib/config`は`app-config.json`の検証と機能設定を担当
- `lib/auth`は認証コンテキストと認証状態を担当
- `lib/navigation`は戻り先と安全なルートの生成を担当
- `lib/preferences`はルビなどの利用者設定を担当

リレー読み取りは`NostrService`と読み取りcoordinatorを通します。UIはリレーの重複除去、タイムアウト、段階読み取りを直接実装しません。評価画面は`EvaluationService`を通して`PolisConsensus`を呼び出します。

## 状態とアクセシビリティ

各ページは読み込み中、成功、部分取得、エラーを区別します。状態メッセージは画面と支援技術へ通知します。フォームは明示的なラベルとエラーを持ちます。操作対象はネイティブの`button`または`a`を使います。

共通の確認先は次です。

- [`SidebarLayout.tsx`](../../src/components/layouts/SidebarLayout.tsx)
- [`SkipToContent.tsx`](../../src/components/ui/SkipToContent.tsx)
- [`accessible-route-pages.test.tsx`](../../src/app/__tests__/accessible-route-pages.test.tsx)
- [`Sidebar.test.tsx`](../../src/components/layouts/__tests__/Sidebar.test.tsx)
- [`SidebarLayout.test.tsx`](../../src/components/layouts/__tests__/SidebarLayout.test.tsx)
- [`location-pages-responsive-contract.test.tsx`](../../src/app/__tests__/location-pages-responsive-contract.test.tsx)

## スタイルと境界

画面はTailwind CSSとDaisyUIのクラスを使います。クラスの採用順をドメイン仕様にしません。見た目だけでなく、ラベル、状態、フォーカス、キーボード操作を同時に実装します。

この文書は構成の説明です。個別のNostrイベント、評価式、設定値の正本ではありません。詳細は対応するreferenceと実装を参照します。
