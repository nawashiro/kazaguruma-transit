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
