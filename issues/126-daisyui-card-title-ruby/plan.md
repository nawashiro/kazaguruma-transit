# Issue #126 DaisyUI card-title Ruby崩れ 修正計画

## 目的

会話一覧の `h3.card-title` がRubyfulのルビ要素を含むときにDaisyUIの `display:flex` で崩れる問題を、既存の `inline` ユーティリティを追加する最小変更で修正する。

## 方針

- **KISS**: 表示崩れが発生する会話一覧の見出しだけを修正し、DaisyUIやRubyfulの共通実装は変更しない。
- **DRY**: `Card` / `CarouselCard` ですでに採用している `inline` クラスを再利用し、新規CSSセレクターや重複ヘルパーを作らない。
- **意味論の維持**: `h3`、リンク、タイトル内容、`ruby-text`、`gap-0`、ARIA、状態表示を維持する。
- **憲章準拠**: `AGENTS.md` と `.specify/memory/constitution.md` の Clear Naming、Simple Logic、Structured Organization、Type Safety、Test-First Development、Accessibility & UX、Documentation & Comments を適用する。今回のUI変更に対応するため、レイアウト崩れの再発防止テストとブラウザ相当確認を計画へ含める。

## 実装対象

- `src/app/discussions/page.tsx`
  - `h3.card-title.text-lg.ruby-text.gap-0` を `h3.card-title.inline.text-lg.ruby-text.gap-0` にする。
- `src/app/discussions/__tests__/page.streaming.test.tsx`
  - Rubyful対象の会話タイトルが `card-title` と `inline` を持つことを、実際のページレンダーで検証する。
- `issues/126-daisyui-card-title-ruby/{investigation,plan,tasks}.md`
  - 調査、計画、実測結果を日本語で記録する。

## 手順

1. `origin/dev` をfetchし、cleanな最新 `dev` から `fix/issue-126-card-title-ruby` を作成する。
2. Issue本文、関連PR、リポジトリ規約、憲章、DaisyUI公式Cardドキュメント、現行実装、既存テストを確認する。
3. 現行DaisyUI CSSと、`inline` 追加前後の実ブラウザcomputed styleを確認する。
4. 回帰テストだけを先に変更し、対象Jestを実行してcollection/setupではない意味のあるREDを確認する。
5. テスト変更をsettleし、production実装とは別のfresh read-only reviewerへレビュー委任する。`SUBAGENT_STATUS: COMPLETE` と `VERDICT: PASS`、`modified: false`、開始終了SHA一致を必須とする。
6. レビューPASS後、productionの許可pathだけに `inline` を追加する。
7. focused test、strict TypeScript、対象lint、`git diff --check` を実行する。
8. 変更後の実ブラウザ相当probeで `.card-title` の flex が解除されることを再確認し、タイトルの横溢れ・カードリンク・見出しレベル・状態表示を確認する。
9. 全Jest、lint、strict TypeScript、buildを実行し、既存warningやGTFS設定不足と実失敗を分離する。
10. Issue文書へRED/GREEN、変更path、検証結果を追記し、差分をfreshに再確認する。
11. 日本語の短いprefix commitを作り、feature branchへpushする。PRを作成する場合はbaseを `dev` とし、変更理由・検証結果・未変更範囲を日本語で記録する。mergeは行わない。
12. pushしたexact SHAのGitHub checksを終端まで確認する。未triggerは成功扱いにしない。

## 検証コマンド

```bash
npm test -- --runInBand --runTestsByPath src/app/discussions/__tests__/page.streaming.test.tsx --silent
npx tsc --noEmit --incremental false
npm run lint
npm test -- --runInBand
npm run build
npm run lint -- --file src/app/discussions/page.tsx
```

実装前の回帰テストはRED、実装後はfocused testと全検証を現行bytesへ実行する。buildはPrisma/GTFS importを含むため、終了コード、既存warning、環境由来の設定不足を個別に記録する。

## リスクと判断

- `inline` は `card-body` のflex子要素上では計算値が `block` になるが、`h3` 内部の `display:flex` を解除するという目的は満たす。これは既存 `Card` / `CarouselCard` と同じ採用パターンである。
- `.card-title:has(ruby)` のような全体CSS上書きは、今回の実在する1つの不具合に対して適用範囲が広く、他の見出しのレイアウト意図を変えうるため採用しない。
- Rubyfulは外部スクリプトであり、Jest環境では実際のDOM変換を行わない。そのためJestではRubyful対象境界と必要なclass tokenを固定し、computed styleとルビ折り返しはブラウザprobeで補完する。
