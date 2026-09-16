# フロントエンド設計

## 範囲

この文書は、現在のフロントエンド構成と責務を説明します。

## 全体構成

ページは画面の境界を持ちます。コンポーネントは表示と操作を組み立てます。`src/lib`はデータ変換、外部通信、状態計算を担当します。

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

## `src/app`

`src/app`はNext.js App Routerです。`page.tsx`は画面を提供し、`layout.tsx`は共通構造を提供します。現在の主な画面は次です。

- `/`: `HomeRouteForm`で経路条件を入力
- `/routes`: 経路検索結果を表示
- `/locations`と`/locations/[category-id]`: 場所一覧を表示
- `/locations/location-detail/[id]`: 場所詳細を表示
- `/discussions/**`: 会話、投稿、評価、承認、役割を表示
- `/login`、`/signup`、`/settings`: 認証とアカウントを表示
- `/beginners-guide`、`/usage`、`/award`、`/license`: 案内と情報を表示

ページは、サーバーでデータを読んでから描画する場合と、クライアントで操作状態を管理する場合があります。`force-dynamic`は認証コンテキストやNostr読み取りを必要とする画面で使います。

## スタイル

画面はTailwind CSSとDaisyUIのクラスを使います。

- 実装者は[DaisyUI ドキュメント](https://daisyui.com/)を参照してください。
- 実装エージェントは[DaisyUI LLMs](https://daisyui.com/llms.txt)を参照してください。

アイコンには`lucide-react`を使います。

## 意味論、アクセシビリティ

見た目だけでなく、ラベル、状態、フォーカス、キーボード操作を同時に実装します。

[ウェブアクセシビリティ・ポリシー](/docs/reference/accessibility/web-accessibility-policy.md)を参照してください。
