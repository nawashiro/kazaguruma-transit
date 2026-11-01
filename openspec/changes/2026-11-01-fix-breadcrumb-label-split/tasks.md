# Tasks

## 1. パンくずのRubyful対象除外

- [ ] 1.1 RED: nav要素が`.ruby-text`を持たず、子孫にruby要素が生成されないことを検査するテストを`Breadcrumbs.test.tsx`に追加する。
- [ ] 1.2 RED: header要素が`.ruby-text`を持たず、パンくずnavの祖先に`.ruby-text`がなく、eyebrow・h1・descriptionが`.ruby-text`を持つことを`PageHeader.test.tsx`で検査する。
- [ ] 1.3 GREEN: `Breadcrumbs.tsx`から`.ruby-text`を除去する。`PageHeader.tsx`の`.ruby-text`をheaderから本文要素へ移す。

## 2. 影響範囲の契約差し替え

- [ ] 2.1 経路検索ページのサーバーHTML契約テスト（`src/app/routes/__tests__/page.test.tsx`）のnav操作名と`.ruby-text`判定を新しい契約に差し替える。
- [ ] 2.2 会話ページのパンくずは`Breadcrumbs`経由のため同一コンポーネントの検査で被覆されていることを確認する。

## 3. 検証

- [ ] 3.1 `npx tsc --noEmit --incremental false`、`npm run lint`（警告数は変更前と同値）、`npx jest --runInBand`を全GREENで通す。
- [ ] 3.2 実サーバーでの見た目・読み上げ確認（ルビON/OFF、場所詳細・経路検索・会話ページ）は検証係がレビュー時に実施する。
