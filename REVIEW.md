# パンくずのラベル分断の修正（検証用）

## 事象と原因

実行時ルビ付与スクリプトRubyful v2（SidebarLayoutがS3から読み込む`rubyful.js` v2、initの走査対象は`.ruby-text`）が、パンくず`<nav class="breadcrumbs … ruby-text">`のラベルを辞書セグメント単位の複数の`<ruby role="text">`へ置換する。置換の結果、見た目ではラベル内に単語境界の隙間が入り、読み上げでも語彙ごとに分断される。ルビOFFでは`<rt>`が非表示になるだけでruby区画自体が残るため、分断も消えない。

もう一つの原因はPageHeaderが`<header class="… ruby-text">`として走査対象に自ら入っている点。パンくずnavから`.ruby-text`を外してもheader経由で置換が起きるため、PageHeaderの処理も変更する。

## 修正内容

- `Breadcrumbs.tsx`: navから`.ruby-text`を除く。パンくずは常に単一テキストのラベルで表示・読み上げされ、ルビは振られない。
- `PageHeader.tsx`: headerから`.ruby-text`を除き、eyebrow・h1・descriptionの各要素に付ける。見出し等の本文へのルビは変わらず付く。headerの中に置いたパンくずは走査対象に含まれない。
- 経路検索・会話ページのパンくずも、経路検索はPageHeader経由、会話はBreadcrumbs直指定のため、この2つの変更で全体が被覆される。
- openspec change: `openspec/changes/2026-11-01-fix-breadcrumb-label-split/`（validate済み）。

## テスト

TDDでBreadcrumbs.test.tsxとPageHeader.test.tsxにREDを追加したのち、実装でGREENにした。

| テスト | 主張 |
|---|---|
| Breadcrumbs › パンくずをRubyfulの対象にしない | navが`.ruby-text`を持たず、子孫にruby区画がなく、HTML上にも祖先に`.ruby-text`がない |
| PageHeader › パンくずとh1の両方をRubyfulの対象から分離し、見出しにはルビを保つ | header自身とパンくずnavの祖先に`.ruby-text`がなく、eyebrow・h1・descriptionは`.ruby-text`を持つ |
| routes/page.test.tsx › URLの重複値… | サーバーHTMLでもパンくずnavが`.ruby-text`を持たない（旧契約の`toHaveClass`を`not.toHaveClass`へ差し替え） |

`npx jest --runInBand`: 1541 passed / 12 skipped（skipは変更前と同一）。`npx tsc --noEmit --incremental false`: エラーなし。`npm run lint`: 警告42件（変更前と同数、本変更に由来しない）。

## 検証手順（レビュー時）

devブランチの初点にこのブランチを重ねた実サーバーで、次を確認する。

1. `npm run build`後、`npm start`でサーバーを起動する。
2. 場所詳細ページ（例: `/locations/location-detail/25e30e15-…`千代田区立四番町図書館）を開き、パンくずが「場所一覧 > 図書館 > 図書館名」と語の隙間なしで1行に表示されることを確認する。
3. 同ページでルビのON/OFFを切り替え、両方で見た目が変わらないことを確認する。ラベル内にruby区画の分断が再び現れないことを、開発者ツールのDOMで`nav`の子孫に`ruby`要素が無い形でも確認する。
4. 経路検索`/routes`と会話ページ`/discussions/[naddr]`でも同じ確認をする。
5. 見出し・説明の本文でルビが引き続き付くことを確認する（ルビが付いてよい場所は変わっていない）。

## 未検証事項

実画面・スクリーンリーダーでの確認は検証係のレビュー時に行う。このリポジトリ側では、外部スクリプトRubyful v2が読み込まれて置換する状態そのものを自動テストで再現していない。テストは「`.ruby-text`を付けない＝走査対象外」という契約を固定する。

## マージ・版の扱い

作業ブランチ`fix-breadcrumb-label-split`から出す。dev/masterへのマージ、版の更新は行わない。検証係が検証を行い、dev→master→リリースv1.7.1の流れに合わせる（版の更新はリリース時に検証係が行う）。
