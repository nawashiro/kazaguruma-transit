# Proposal

## Why

「戻る」リンクの実装が画面ごとに異なる。プレーンリンク、ゴーストボタン、プライマリボタンが混在し、h1より上に置かれる画面と下に置かれる画面がある。サイト全体で一つのデザインパターンに統一し、利用者がどの画面でも同じ場所・同じ見た目で親階層へ戻れるようにする。

## What Changes

- DaisyUIの`breadcrumbs`コンポーネントを使うサイト共通のパンくずナビゲーションを導入する。
- `PageHeader`にパンくずのスロットを追加し、パンくずを必ずh1より上に表示する。
- パンくずは親階層を列挙し、現在位置を`aria-current="page"`で示す。
- 場所詳細は「場所一覧 > カテゴリ > 場所名」の複数段のパンくずを表示する。
- 通常画面の戻るリンク（会話一覧・会話作成・場所詳細・経路検索結果）をパンくずへ置き換える。
- 次は対象外とし、現状を維持する。
  - 親階層を持たないページ（トップ、各一覧、設定、使い方など）のパンくず自体の表示。
  - その場のアクションとして機能するボタン（エラー状態・完了カード内の「会話一覧に戻る」「会話画面に戻る」など）。
  - rate-limitページの「発生元の画面へ戻る」リンク。戻り先がクエリパラメーターで動的に決まり、階層構造を成さないため。

## Capabilities

### New Capabilities

- `breadcrumb-navigation`: サイト共通のパンくずナビゲーション。PageHeaderでの配置（h1より上）、親階層の列挙と現在位置の表示、対象外の画面の線切りを要求する。

### Modified Capabilities

- `route-search-results`: 「入力画面へ戻る通常のリンクを提供する」要件を、h1より上のパンくずによる入力画面への遷移へ変更する。ルビ付きの戻るリンクのシナリオをパンくずの読み上げと折り返しに合わせて更新する。

## Impact

- `src/components/layouts/PageHeader.tsx`: パンくずスロットの追加。
- `src/app/locations/location-detail/[id]/page.tsx`: `LocationBackLink`のパンくず化。
- `src/components/discussion/DiscussionTabLayout.tsx`と`src/app/discussions/create/page.tsx`: 戻るボタンのパンくず化。
- `src/components/features/RouteSearchResults.tsx`と`src/app/routes/page.tsx`: 戻るリンクのパンくず化。
- 対応するテスト群（ページテスト、visual-contractテスト、アクセシビリティテスト）。
