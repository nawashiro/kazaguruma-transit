# パンくずのラベルがRubyfulで語彙ごとに分断される問題の修正

## Why

場所詳細ページなどで、パンくずのラベル（「場所一覧」「図書館」等）が実行時ルビ付与スクリプトRubyful v2の辞書セグメント boundary で複数の `<ruby role="text">` に置換され、見た目では単語境界に隙間が入り、読み上げでも語彙ごとに分断される。ルビOFFでもruby要素が残るため分断が消えない。WCAG（可読性・アクセシブルネーム）と操作区分の双方で利用者に迷いを与えるマージ阻害レベルの欠陥。

## What Changes

- パンくずのnav要素を`.ruby-text`（Rubyful v2の走査対象セレクタ）から除外する。パンくずにはルビを振らず、ラベルを単一テキストのまま保つ。
- `PageHeader`では`.ruby-text`をheader全体から、eyebrow・h1・description個別の要素に移し、内側のパンくずが走査対象に含まれない種付けにする。見出し等の本文へのルビは現状どおり付く。
- 経路検索・会話ページを含む全パンくずは`Breadcrumbs`単一コンポーネント経由のため、この1か所の除外で全体に適用される。
- ルビのON/OFF preference、toggleボタンの挙動には触れない。

## Impact

- 修正対象: `src/components/layouts/Breadcrumbs.tsx`、`src/components/layouts/PageHeader.tsx`
- 更新する既存テスト: `src/app/routes/__tests__/page.test.tsx`（navが`.ruby-text`を持つことを要求していた契約を差し替え）
- 新規テスト: `src/components/layouts/__tests__/Breadcrumbs.test.tsx`、`PageHeader.test.tsx`

## 対象外

- Rubyful v2スクリプト自体の挙動、辞書、トグルUI。
- パンくず以外の画面要素（ルビ対象のまま）。
