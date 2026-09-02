# Issue #126 実装タスクリスト

**Issue**: [#126](https://github.com/nawashiro/kazaguruma-transit/issues/126)

**Repository**: `/opt/data/kazaguruma-transit`

**Branch**: `fix/issue-126-card-title-ruby`

**Base**: `dev` / `d5d85b2c779dfa494ecf381f4429a219ac2b9f6a`

**関連文書**: `investigation.md`、`plan.md`

## 実行規約

- 作業言語は日本語とする。
- `AGENTS.md` と `.specify/memory/constitution.md` の原則を適用する。
- TDDでテストを先に変更し、実装前にcollection/setupではない意味のあるREDを確認する。
- テスト実装タスクの直後に、別fresh read-only subagentによるレビュータスクを置く。必須結果は次のとおり。

```text
SUBAGENT_STATUS: COMPLETE
VERDICT: PASS
```

- test writerは指定test pathだけを変更し、production code、Issue文書、設定、commit、push、reset、clean、stageを行わない。
- production writerは指定production pathだけを変更し、既存のtitle、リンク、ARIA、状態表示、データ取得を変更しない。
- 今回のproduction write boundaryは `src/app/discussions/page.tsx` のみ。test write boundaryは `src/app/discussions/__tests__/page.streaming.test.tsx` のみ。
- 新規CSS、全体`.card-title`上書き、共通コンポーネント改修、Rubyful改修は行わない。
- `npm run build` は最終検証で一度だけ実行する。
- 実装後のreviewは、変更後のbytesを再読込したfresh read-only reviewで行う。自己申告だけを完了根拠にしない。

## Phase 1: 調査・計画

- [x] T001 `origin/dev` をfetchし、ローカル`dev`を最新 `d5d85b2c779dfa494ecf381f4429a219ac2b9f6a` へfast-forwardした。Issue #126の本文・コメント・関連PR、AGENTS、憲章、DaisyUI公式Cardドキュメント、現行source/test、DaisyUI CSS、ブラウザ相当computed styleを確認した。
- [x] T002 `issues/126-daisyui-card-title-ruby/{investigation,plan,tasks}.md` を作成し、根因、KISS/DRY方針、変更境界、受入条件、検証手順を記録した。

**Checkpoint**: Issue状態、基準SHA、root cause、production/testのhard write boundary、実装方式が確定している。

## Phase 2: Contract test（RED → fresh review）

- [x] T003 [TEST] `src/app/discussions/__tests__/page.streaming.test.tsx` だけを変更する。Rubyful対象の会話タイトルを実ページへ渡し、該当`h3`が既存の `card-title`、`text-lg`、`ruby-text`、`gap-0`に加えて`inline`を持つ契約を追加する。実装前にfocused Jestを実行し、collection/setupではない意味のあるREDを記録する。実測: 1 suite / 11 tests中10 passed・1 failed。失敗は`inline`不足の1件のみで、collection/setup failureなし。変更pathは指定test 1件。
  - 実行: `npm test -- --runInBand --runTestsByPath src/app/discussions/__tests__/page.streaming.test.tsx --silent`

- [x] T004 [REVIEW] T003でsettleしたtest pathを別fresh read-only subagentへレビュー委任する。Issueの表示崩れを実際のページレンダーで固定し、vacuous assertionや実装詳細依存になっていないこと、既存の承認済み一覧・リンク・状態・ARIA契約を弱めていないことを確認する。レビュー中はproduction、test、docsを変更しない。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始終了SHA一致を確認する。実測: reviewerは`SUBAGENT_STATUS: COMPLETE` / `VERDICT: PASS` / `modified: false`。exact focused commandは1 suite / 11 tests中10 passed・1 failedの意味あるRED、collection/setup failureなし。対象test SHAは開始・終了で`459464d8d6ddaa0c72c313252f40b3f321704b1953b10810dc4d3b6ca1e28bda`に一致し、statusも変更なし。

**Checkpoint**: T003の意味あるREDとT004の明示的PASSが揃うまでproduction codeを変更しない。

## Phase 3: Production implementation

- [x] T005 [IMPL] T004 PASS後、`src/app/discussions/page.tsx` の会話一覧`h3.card-title`に `inline` を追加する。`ruby-text`、`gap-0`、見出しレベル、タイトル、Link、説明、badge、モデレーター数、loading/partial/error/empty状態、reload callbackは変更しない。実測: productionは指定1ファイルのclass token 1件（1 insertion / 1 deletion）のみ変更。親側focused testはNode 22.23.2で1 suite / 11 tests PASS、strict TypeScript・full lint・diff checkも終了コード0。
  - 実行: T003 focused test、strict TypeScript、対象lint、`git diff --check`

- [x] T006 [VERIFY] T005後、現行sourceとdiffを再読込する。`h3.card-title`のclass tokenが1箇所だけ変更され、全体CSS・共通Card・データ層・未指定production pathに差分がないことを確認する。T003 focused testがGREENであることを確認する。実測: 親側で`page.tsx`全体を再読込し、差分は`card-title inline text-lg ruby-text gap-0`への1トークン追加のみ。test、Issue docs 3件以外のpathは変化なし。production reviewは`SUBAGENT_STATUS: COMPLETE` / `VERDICT: PASS` / `modified: false`、開始終了SHA一致。

**Checkpoint**: 回帰テストGREEN、production変更は許可された1箇所、不要な抽象化・CSS上書きなし。

## Phase 4: 親検証・ブラウザ確認・配送

- [x] T007 Node 22.xを優先し、focused test、`npx tsc --noEmit --incremental false`、`npm run lint`、全Jestを実行する。collection/setup、fixture、assertion、既存baselineを分類し、warningを成功と混同しない。実測: Node `v22.23.2`でfocused 1 suite / 11 tests、strict TypeScript exit 0、lint exit 0、全Jest 139 suites passed / 2 skipped・858 tests passed / 13 skipped。既存warningとconsole出力は失敗と分離した。
- [x] T008 `npm run build` を実行する。Prisma/GTFS import/Next buildの終了コードを分け、`transit-config.json`不足など既存環境要因を失敗と混同しない。実測: build exit 0。Prisma生成・DB同期・Next production build成功。`transit-config.json`不在による既存GTFS importエラー表示とPrisma update noticeは成功と分離した。
- [x] T009 DaisyUI stylesheetと実装後bytesを使ったChromium probeを再実行する。`card-title`の実装前`display=flex`が実装後にflexでなくなり、`gap=0px`を維持することを確認する。Ruby要素と前後文字列のレイアウト境界を確認する。実測: `card-title inline text-lg ruby-text gap-0`、`display=block`、`flexContainer=false`、`gap=0px`、`rubyDisplay=ruby`。
- [x] T010 `investigation.md`、`plan.md`、`tasks.md`へ実測したRED/GREEN、focused/full test、strict TypeScript、lint、build、browser、status/diffを追記し、文書更新後に`git diff --check`と相対リンクを確認する。実測: `investigation.md`と`tasks.md`へ結果を追記し、Issue docs 3件の存在と`git diff --check` exit 0を確認した。planは実装前の計画として保持した。
- [x] T011 最終差分をfreshに再レビューし、短いprefixの日本語commitを作成して`origin/fix/issue-126-card-title-ruby`へpushする。PRを作成する場合はbaseを`dev`に明示し、title/body/head/base/filesを読み戻す。mergeは行わない。実測: commit `a1403a9ea6c8cf1d459ee012267fa024b3028f01`を作成・pushし、PR #127（base=`dev`、head=`fix/issue-126-card-title-ruby`、state=`OPEN`）を作成して本文・変更5ファイルを読み戻した。mergeは行っていない。
- [x] T012 pushしたexact SHAのGitHub checksを終端まで確認する。未triggerは成功扱いにせず、failureは変更起因・baseline・infrastructureに分類する。実測: exact SHA `a1403a9ea6c8cf1d459ee012267fa024b3028f01`のQuality Gate run `33596996309`はexit 0 / success。ESLint、strict TypeScript、Jestを含むjobが完了し、Node.js 20 deprecation annotationのみだった。

## 依存関係

```text
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012
```

T003のtest変更とT005のproduction変更は分離する。同一pathを複数writerが変更しない。T004のfresh reviewがPASSするまでT005を開始しない。

## 受入条件と証拠

| 受入条件 | 主な証拠 |
|---|---|
| Ruby対象の会話一覧`h3`に`inline`がある | T003 RED、T005 GREEN、T006 source/diff |
| DaisyUI flexによるルビ崩れが解消される | T009 Chromium computed style/layout probe |
| 既存の表示・操作・ARIA・データ取得を維持する | T003/T004 review、T006、T007、T008 |
| KISS/DRYで新規CSS・抽象化を導入しない | T005/T006 diff review |
| 指定外pathを変更しない | T006、T010 status/path/SHA |
| 品質ゲートを通過する | T007/T008 |
| リモート配送とCIを確認する | T011 exact SHA、T012 checks |
