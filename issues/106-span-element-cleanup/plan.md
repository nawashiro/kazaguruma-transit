# Issue #106 実装計画

## 目的

Issue #106の「意味を持たないspanを駆逐する」という要求に対し、DOM上の構造ラッパーを減らし、Rubyfulの生成するルビ要素とDaisyUIのflex gapが作る不要な空白を除去する。

## 仕様

1. production TSXに属性なしの構造用 `<span>` を残さない。
2. 見出し・リンク・ボタン・状態メッセージの文字列だけを包むspanは、親の意味要素へ文字列または `ruby-text` を移す。必要なメッセージ境界は `p` 等へ置換する。
3. `badge`、`loading`、`sr-only`、`truncate`、`label-text`、ID・テスト参照・アイコンと文字列を分離する責務を持つspanは保持する。
4. 共通 `Button` は自動生成するspanを撤去し、button自身を `ruby-text gap-0` のレイアウト境界とする。既存のprops、イベント、disabled/loading、ARIA属性は維持する。
5. productionのDaisyUI `btn` と `card-title` は、暗黙のgapへ依存せず `gap-0` を明示する。アイコンとの間隔が必要な箇所は、既存の明示的なレイアウトまたはアイコン側marginで維持する。
6. `ruby-text` の過去仕様を理由に子spanを残さない。Issue #106の対応として、同じ過去仕様を`AGENTS.md`と`.specify/memory/constitution.md`から削除し、憲章の版を`4.0.0`へ更新する。
7. Nostr read/write、認証、router遷移、フォーム値、リンク先、accessible name、loading/error/partial状態を変更しない。
8. `src/app/apple-icon.png` の既存LFS差分、`public/images/map_placeholder.png`は変更しない。憲章・AGENTS.mdはIssue #106の文書タスクで更新対象とし、実装writerの書込範囲からは除外する。

## 実装方針

### A. 共通UI・ナビゲーション

- `Button.tsx`の自動spanを撤去し、buttonへ`ruby-text gap-0`を追加する。
- `Card.tsx`、`CarouselCard.tsx`の`card-title`へ`gap-0`を追加する。
- `ResetButton.tsx`、`Sidebar.tsx`、`SidebarLayout.tsx`、`CategoryTabs.tsx`、`KoFiSupport.tsx`、`RouteSearchResults.tsx`などの文字列専用spanを親へ統合する。
- アイコン付きButtonは、アイコンと文字列の明示間隔を保持する。

### B. 静的ページ・検索系

- `award`、`beginners-guide`、`usage`、`license`、`settings`、`discussions`、`locations`の見出し・目次・ボタン・アラートを整理する。
- 既存リンク先、外部リンク属性、ページ見出し、一覧表示を保持する。

### C. ディスカッション系

- `DiscussionReadStatus`、`DiscussionMetaReadState`、各discussion routeのエラー・partialメッセージを意味要素へ移す。
- ルビ指定だけのボタンspanを親buttonへ移し、`gap-0`を付ける。
- badge・タブカウント・フォームラベル・読み上げ専用要素など、責務を持つspanは保持する。

## 受入条件と証拠

| 受入条件 | 証拠 |
|---|---|
| 属性なしspanがproduction TSXに0件 | Issue専用契約テスト、production再検索 |
| 対象DaisyUI `btn` / `card-title` に`gap-0`がある | Issue専用契約テスト、production再検索 |
| 共通Buttonの自動構造spanがない | Button focused testとsource契約 |
| Rubyful対象・ARIA・リンク・イベントを維持 | 既存focused tests、変更対象テスト |
| badge/loading/sr-only等の責務spanを誤削除しない | 契約テストの許容分類、既存UIテスト |
| `src/app/apple-icon.png`等の凍結pathを変更しない | status、path差分、SHA |
| TDDのRED→fresh review→実装→GREENを満たす | tasks.mdの実測記録 |
| 品質ゲートを通過する | strict TypeScript、lint、全Jest、build、diff check |

## 検証方針

- テスト追加後、実装前にIssue専用契約テストと変更対象focused testを実行し、collection/setupではないREDを確認する。
- テスト実装直後、別fresh read-only subagentへレビューを委任する。レビュー中は対象ファイルを変更しない。
- 実装後は、各sliceのfocused tests、strict TypeScript、対象Lint、`git diff --check`を実行する。
- 最終的にNode 22.23.2をPATH先頭へ置き、全Jest、lint、strict TypeScript、buildを実行する。buildのPrisma/GTFS副作用とwarningは終了コードと分離して記録する。
- ブラウザ上のcomputed layoutが必要な場合は、既存の開発サーバーを再利用せず、readiness確認済みの隔離ポートで補助確認する。静的契約テストをブラウザ検証の代替にはしない。
