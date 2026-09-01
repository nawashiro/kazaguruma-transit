# Issue #119 実装タスクリスト

**Issue**: [#119](https://github.com/nawashiro/kazaguruma-transit/issues/119)

**Repository**: `/opt/data/work/kazaguruma-transit-issue-119`

**Branch**: `fix/issue-119-discussion-create-button`

**Base**: `dev` / `b1e722ee339d0eb77942dc23a5fa07c74a08e58c`

**関連文書**: `investigation.md`、`plan.md`

## 実行規約

- 作業言語は日本語とする。
- `.specify/memory/constitution.md` と `AGENTS.md` を作業上の憲章として扱う。
- 親エージェントが受入条件、書込境界、RED/GREEN、最終検証を管理する。サブエージェントの自己申告だけで完了扱いにしない。
- テスト作成タスクの直後に、別fresh read-only subagentのレビュータスクを置く。必須結果は次のとおり。

```text
SUBAGENT_STATUS: COMPLETE
VERDICT: PASS
```

- writerは指定したhard writable pathsだけを変更し、commit、push、reset、clean、stageを行わない。
- `public/images/map_placeholder.png`、`src/app/apple-icon.png`、未指定のproduction sourceは凍結する。
- 実際の会話作成、Nostrイベント発行、公開環境への送信は行わない。
- Buildは副作用があるため最終検証で一度だけ実行し、Node 22.23.2を使う。
- 憲章上の「実装タスクはサブエージェントへ委任する」に従い、テスト作成とレビューを個別に委任する。親は返却後に実ファイルと終了コードを再確認する。

## Phase 1: 現状把握と計画

- [x] T001 `origin/dev`をfetchし、`dev`との差分が`0 0`であること、ベースSHA、Issue本文/comments、重複PR、既存dirty状態を確認する。既存本体ツリーの未コミット変更はユーザー指示で破棄し、Issue専用clean worktreeを`dev`から作成した。

- [x] T002 `AGENTS.md`、`.specify/memory/constitution.md`、`docs/development-handoff.md`、作成ルート、Button実装、関連テスト、#106のgap修正履歴を調査する。公開URLはChromiumで送信なしに観測し、現行devと公開DOMの差分を記録する。実際の作成完了画面はモック検証に限定する。

- [x] T003 `issues/119-discussion-create-button-gap/{investigation,plan,tasks}.md`を日本語で作成する。現行devでgap-0が既にButton共通契約へ入っていること、公開ビルドが古い可能性、Button全体撤去をout of scopeとすること、憲章適合、実行境界を記録する。

**Checkpoint**: ベースが`origin/dev`と一致し、Issueの現要求・公開観測・現行source契約・実装境界が確定している。

## Phase 2: 回帰テスト（REDまたは既存GREENの契約固定）

- [x] T004 [TEST] `src/app/discussions/create/__tests__/page.test.tsx` の成功状態テストへ、作成完了後の2つのCTAが`gap-0`を持つassertionを追加する。既存の見出し、accessible name、router遷移、Nostr creation-flow mock契約は保持する。書込境界はこのtest pathだけとする。実測: `会話を開始する` と `会話一覧に戻る` を実DOMのrole/nameで取得し、両方の`gap-0`を確認。テストは現行Button契約により即時GREEN（1 suite / 4 tests、exit 0）。変更はこのtest pathのみ。
  - 対象: `会話を開始する`、`会話一覧に戻る`
  - 実行:

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/discussions/create/__tests__/page.test.tsx --silent
```

  - 判定: 現行devの`Button`共通契約により即時GREENなら、production sourceが既に受入条件を満たす証拠として記録する。REDになった場合だけ、T006のproduction修正を再計画する。

- [x] T005 [REVIEW] T004でsettleしたtest pathを、別fresh read-only subagentへレビュー委任する。成功状態の再現がモックで閉じていること、2つのCTAの`gap-0`を実際のrendered DOMで検出すること、既存遷移とaccessible nameを弱めていないこと、vacuous assertionでないことを確認する。テスト・production・docsをレビュー中は変更しない。`SUBAGENT_STATUS: COMPLETE` と `VERDICT: PASS` が揃うまで次へ進まない。実測: fresh review `deleg_88f0a1e2` が`SUBAGENT_STATUS: COMPLETE` / `VERDICT: PASS`。focused 1 suite / 4 tests、target lint、strict TypeScript、diff check PASS。レビュー中の変更なし。

**Checkpoint**: T004のテスト結果がcollection/setup errorなしで分類され、T005の明示的PASSが揃っている。

## Phase 3: 最小実装または既存契約の確定

- [x] T006 [IMPL] T005 PASS後、T004の結果に従う。実測: T004が既存GREENだったため、`src/components/ui/Button.tsx` と `src/app/discussions/create/page.tsx` は変更しなかった。primary/secondaryの両方に`ruby-text gap-0`があり、完了CTAは両方とも`Button`を通ることを親が確認した。
  - T004がGREENの場合: `src/components/ui/Button.tsx` と `src/app/discussions/create/page.tsx` のproduction sourceは変更しない。親が現行bytesを再読し、`Button`のprimary/secondary両方に`gap-0`があること、完了CTAが両方とも`Button`を通ることを確認する。
  - T004がREDの場合: 親が原因を再確認し、別途承認された最小production pathだけを対象に、既存機能・ARIA・遷移を保った修正を行う。Button全体の置換・新fallback・大規模抽象化変更は禁止する。

- [x] T007 [VERIFY] 親が成功状態テストとButtonテストを再実行し、`gap-0`、2つのaccessible name、遷移先、変更path、凍結pathを確認する。T004のテストbytesが変わった場合はT005のレビューを無効としてfresh reviewをやり直す。実測: focused 2 suites / 18 tests PASS、`git diff --check` PASS、変更pathはtest 1件とIssue文書3件、production/package/frozen pathは不変。

**Checkpoint**: Issueの作成完了CTA契約が現行bytesでGREENであり、不要なproduction refactorがない。

## Phase 4: 最終検証と配送

- [x] T008 Node 22.23.2で最終focused test、strict TypeScript、Lint、全Jestを実行する。失敗はcollection/setup、fixture、今回の変更起因、既存baseline、環境要因に分類する。実測: focused 2 suites / 18 tests PASS、全Jest 139 suites PASS / 2 skipped、856 tests PASS / 13 skipped、strict TypeScript exit 0、Lint exit 0。Lintは既存warningのみ。

- [x] T009 `npm run build`をNode 22.23.2で一度実行する。Prisma/GTFS importの副作用、`transit-config.json`不足などの環境表示、Next production buildの終了コードを分離記録する。実測: exit 0。Prisma generate/db push、Next production buildは成功。`transit-config.json`不在によるGTFS importエラー表示とPrisma update noticeは既存環境表示として分離。

- [x] T010 `investigation.md`、`plan.md`、`tasks.md`へ親が実測したRED/GREEN、focused/full Jest、strict TypeScript、Lint、Build、公開観測、status、変更pathを反映する。Markdownの相対リンク、placeholder、末尾空白、`git diff --check`を確認する。実測: 3文書へ結果を反映し、3件の文書本文は末尾空白0・placeholder 0。tracked diff checkとuntracked文書の直接検査が成功した。

- [ ] T011 親が最終差分を再レビューし、Issue文書と必要な回帰testだけを日本語conventional commitでcommitして`origin/fix/issue-119-discussion-create-button`へpushする。PRを作成する場合はbase=`dev`を明示し、Issue #119、現行devでの契約、公開buildとの差分、実際の会話作成をしていないこと、検証結果を日本語で記載する。PR作成後にtitle/body/head/base/changed filesを読み戻す。mergeは行わない。

- [ ] T012 pushしたexact SHAのGitHub checksを確認する。CIが未triggerなら成功扱いにせず「未trigger」と記録する。failureは変更起因・baseline・infrastructureに分類する。Issueのcloseは行わない。

## 依存関係

```text
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012
```

同一test pathを複数writerが変更しない。T004が既存GREENでも、T005のfresh reviewを省略しない。production sourceが未変更の場合も、親は実ファイルとテスト終了コードを再確認してT006/T007を完了扱いにする。

## 受入条件と証拠

| 受入条件 | 証拠 |
|---|---|
| 作成完了の開始CTAが`gap-0` | T004 rendered DOM test、T007再実行 |
| 作成完了の一覧CTAが`gap-0` | T004 rendered DOM test、T007再実行 |
| 開始CTAのrouter遷移維持 | 既存T004 assertion、T007 |
| accessible name/ボタン種別維持 | T004/T005 |
| Nostr発行なし | mock実装、ブラウザ操作ログ、T001/T002 |
| Button全体撤去を混入しない | T006 path review、T007 changed-path確認 |
| 憲章・文書整合 | T003/T010、`git diff --check` |
| リモート配送 | T011 exact SHA、T012 checks |
